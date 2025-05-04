import logging
import os
import json
from datetime import datetime, timedelta, timezone

import azure.functions as func
from azure.storage.blob import BlobServiceClient, ContentSettings

# name of your two containers (set in App Settings)
RAW_CONTAINER = os.getenv("RAW_CONTAINER")  # e.g. "sensor-raw"
ROLLUP_CONTAINER = os.getenv("ROLLUP_CONTAINER")  # e.g. "sensor-rollups"

# interval → (look-back window, blob-path under each interval folder)
ROLLUPS = {
    3: (timedelta(hours=1), "3min/last1h.json"),
    5: (timedelta(hours=6), "5min/last6h.json"),
    10: (timedelta(hours=24), "10min/last24h.json"),
    20: (timedelta(days=7), "20min/last7d.json"),
}


def bin_and_average(points, interval_min):
    """Bucket + average (datetime, value) pairs into interval_min-minute bins."""
    if interval_min == 3:
        # for 3-min we just pass through raw points
        return [{"t": dt.isoformat(), "y": v} for dt, v in points]

    ms = interval_min * 60 * 1000
    buckets = {}
    for dt, v in points:
        key = (int(dt.timestamp() * 1000) // ms) * ms
        buckets.setdefault(key, []).append(v)

    out = []
    for key in sorted(buckets):
        vals = buckets[key]
        avg = sum(vals) / len(vals)
        out.append(
            {
                "t": datetime.fromtimestamp(key / 1000, tz=timezone.utc).isoformat(),
                "y": avg,
            }
        )
    return out


def main(timer: func.TimerRequest):
    logging.info("Roll-up run at %s UTC", datetime.now(timezone.utc).isoformat())

    svc = BlobServiceClient.from_connection_string(os.getenv("AzureWebJobsStorage"))
    raw_ct = svc.get_container_client(RAW_CONTAINER)
    roll_ct = svc.get_container_client(ROLLUP_CONTAINER)

    now = datetime.now(timezone.utc)

    # collect raw points for each metric
    temp_pts, hum_pts, co2_pts, light_pts = [], [], [], []

    for b in raw_ct.list_blobs():
        if not b.name.lower().endswith(".json"):
            continue

        try:
            raw = raw_ct.get_blob_client(b.name).download_blob().readall()
            msg = json.loads(raw)
        except Exception as e:
            logging.error("Could not parse %s: %s", b.name, e)
            continue

        ts = msg.get("EnqueuedTimeUtc") or msg.get("SystemProperties", {}).get(
            "enqueuedTime"
        )
        if not ts:
            logging.error("No timestamp in %s", b.name)
            continue

        dt = datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(timezone.utc)
        body = msg.get("Body", {})

        try:
            temp_pts.append((dt, float(body["temperature"])))
            hum_pts.append((dt, float(body["humidity"])))
            co2_pts.append((dt, float(body["co2"])))
            light_pts.append((dt, float(body["light"])))
        except KeyError as e:
            logging.error("Missing field %s in %s", e, b.name)

    # for each interval, build a roll-up containing *all* four series
    for interval, (window, blob_path) in ROLLUPS.items():
        cutoff = now - window

        # filter & bin each metric
        rollup = {
            "temperature": bin_and_average(
                [(dt, v) for dt, v in temp_pts if dt >= cutoff], interval
            ),
            "humidity": bin_and_average(
                [(dt, v) for dt, v in hum_pts if dt >= cutoff], interval
            ),
            "co2": bin_and_average(
                [(dt, v) for dt, v in co2_pts if dt >= cutoff], interval
            ),
            "light": bin_and_average(
                [(dt, v) for dt, v in light_pts if dt >= cutoff], interval
            ),
        }

        try:
            roll_ct.get_blob_client(blob_path).upload_blob(
                json.dumps(rollup),
                overwrite=True,
                content_settings=ContentSettings(content_type="application/json"),
            )
            logging.info(
                "Wrote roll-up for %d-min to %s (pts: %s)",
                interval,
                blob_path,
                {k: len(v) for k, v in rollup.items()},
            )
        except Exception as e:
            logging.error("Failed writing %s: %s", blob_path, e)

