// ————————————————————————————
//  CONFIGURATION
// ————————————————————————————

const ACCOUNT   = 'homeoffice1';
const CONTAINER = 'telementry';   // <— make sure this exactly matches your container name
const SAS_TOKEN = 'sv=2024-11-04&ss=bfqt&srt=co&sp=rwdlacupiytfx&se=2026-05-01T19:22:12Z&st=2025-05-01T11:22:12Z&spr=https&sig=F1rO3kwekla0ZgwLntABz5KzbhufD1S4zxLMfAsHbTk%3D'; // <— your container‐level SAS token (no leading “?”)
const BASE_URL  = `https://${ACCOUNT}.blob.core.windows.net/${CONTAINER}`;

// How many past points to show (optional)
const MAX_POINTS = 300;

// ————————————————————————————
//  1) List blobs in container
// ————————————————————————————
async function listBlobs() {
  const url = `${BASE_URL}?restype=container&comp=list&${SAS_TOKEN}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`List blobs failed: ${res.status}`);
  const xml = await res.text();
  const dom = new DOMParser().parseFromString(xml, 'application/xml');
  return Array.from(dom.getElementsByTagName('Blob'))
    .map(b => b.getElementsByTagName('Name')[0].textContent)
    .filter(n => n.endsWith('.json'));
}

// ————————————————————————————
//  2) Download & flatten JSON from each blob
// ————————————————————————————
async function loadData() {
  const names = await listBlobs();
  // limit to last N blobs if you like:
  // names.sort(); names.splice(0, names.length - MAX_POINTS);
  
  let all = [];
  for (let name of names) {
    try {
      const r = await fetch(`${BASE_URL}/${name}?${SAS_TOKEN}`);
      if (!r.ok) continue;
      const json = await r.json();
      // IoT Hub writes an array per file; could also be a single object
      all = all.concat(Array.isArray(json) ? json : [json]);
    } catch (_) { /* skip errors */ }
  }
  return all;
}

// ————————————————————————————
//  3) Prepare series for Highcharts
// ————————————————————————————
function prepareSeries(items) {
  // sort by timestamp
  items.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // helper to pluck and timestamp-convert
  function pluck(field) {
    return items
      .map(d => {
        const t = new Date(d.timestamp).getTime();
        const v = parseFloat(d[field]);
        return isNaN(v) ? null : [t, v];
      })
      .filter(pt => pt[1] !== null);
  }

  return {
    temperature: pluck('temperature'),
    humidity:    pluck('humidity'),
    pressure:    pluck('pressure'),
    light:       pluck('light')
  };
}

// ————————————————————————————
//  4) Render 4 charts with Highcharts
// ————————————————————————————
function renderCharts(rawItems) {
  if (!rawItems || rawItems.length === 0) {
    console.error('No data points to render');
    return;
  }

  const series = prepareSeries(rawItems);
  const latest = {
    temp: series.temperature.slice(-1)[0]?.[1] ?? '–',
    hum:  series.humidity.slice(-1)[0]?.[1]    ?? '–',
    pres: series.pressure.slice(-1)[0]?.[1]    ?? '–',
    light:series.light.slice(-1)[0]?.[1]      ?? '–'
  };

  const commonOpts = {
    time: { timezone: moment.tz.guess() },
    chart: { backgroundColor: 'transparent' },
    xAxis: { type: 'datetime' },
    legend: { enabled: false },
    credits: { enabled: false },
    plotOptions: { series: { marker: { enabled: false } } }
  };

  Highcharts.setOptions(Highcharts.theme);

  Highcharts.chart('temperature', {
    ...commonOpts,
    title: { useHTML: true,
      text: `<i class="thermometer half icon"></i>
             Temperature: ${latest.temp.toFixed(1)}℃`
    },
    yAxis: { title: { text: '℃' } },
    series: [{ data: series.temperature }]
  });

  Highcharts.chart('humidity', {
    ...commonOpts,
    title: { useHTML: true,
      text: `<i class="tint icon"></i>
             Humidity: ${latest.hum.toFixed(1)} %RH`
    },
    yAxis: { title: { text: '%RH' } },
    series: [{ data: series.humidity }]
  });

  Highcharts.chart('pressure', {
    ...commonOpts,
    title: { useHTML: true,
      text: `<i class="sun icon"></i>
             Pressure: ${Math.round(latest.pres)} hPa`
    },
    yAxis: { title: { text: 'hPa' } },
    series: [{ data: series.pressure }]
  });

  Highcharts.chart('light', {
    ...commonOpts,
    title: { useHTML: true,
      text: `<i class="lightbulb icon"></i>
             Light: ${Math.round(latest.light)} lux`
    },
    yAxis: { title: { text: 'Lux' } },
    series: [{ data: series.light }]
  });
}