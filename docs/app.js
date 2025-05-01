// ————————————————————————————
//  CONFIGURATION
// ————————————————————————————

const ACCOUNT   = 'homeoffice1';
const CONTAINER = 'telementry';   // <— make sure this exactly matches your container name
const SAS_TOKEN = 'sv=2024-11-04&ss=bfqt&srt=co&sp=rwdlacupiytfx&se=2026-05-01T19:22:12Z&st=2025-05-01T11:22:12Z&spr=https&sig=F1rO3kwekla0ZgwLntABz5KzbhufD1S4zxLMfAsHbTk%3D'; // <— your container‐level SAS token (no leading "?")
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
  console.log('Found blobs:', names);
  
  let all = [];
  for (let name of names) {
    try {
      const r = await fetch(`${BASE_URL}/${name}?${SAS_TOKEN}`);
      if (!r.ok) {
        console.error(`Failed to fetch ${name}: ${r.status}`);
        continue;
      }
      const text = await r.text();
      console.log(`Raw data from ${name}:`, text.substring(0, 200) + '...');
      
      try {
        const json = JSON.parse(text);
        // IoT Hub writes an array per file; could also be a single object
        if (Array.isArray(json)) {
          console.log(`${name} contains array of ${json.length} items`);
          all = all.concat(json);
        } else {
          console.log(`${name} contains single object:`, json);
          all.push(json);
        }
      } catch (parseError) {
        console.error(`Failed to parse JSON from ${name}:`, parseError);
      }
    } catch (fetchError) {
      console.error(`Failed to fetch ${name}:`, fetchError);
    }
  }
  
  console.log('Total items loaded:', all.length);
  if (all.length > 0) {
    console.log('Sample item:', all[0]);
  }
  
  return all;
}

// ————————————————————————————
//  3) Prepare series for Highcharts
// ————————————————————————————
function prepareSeries(items) {
  console.log('Preparing series with items:', items);
  
  // Extract data from Body if present (IoT Hub format)
  const cleanItems = items.map(item => {
    if (item.Body) {
      // If Body is a string, parse it
      if (typeof item.Body === 'string') {
        try {
          return JSON.parse(item.Body);
        } catch (e) {
          console.warn('Failed to parse Body:', e);
          return null;
        }
      }
      // If Body is already an object, use it directly
      return item.Body;
    }
    // If no Body property, assume direct sensor data
    return item;
  }).filter(item => item !== null);

  console.log('Cleaned items:', cleanItems);
  
  // sort by timestamp (use EnqueuedTimeUtc if no timestamp)
  cleanItems.sort((a, b) => {
    const timeA = new Date(a.timestamp || a.EnqueuedTimeUtc);
    const timeB = new Date(b.timestamp || b.EnqueuedTimeUtc);
    return timeA - timeB;
  });

  // helper to pluck and timestamp-convert
  function pluck(field) {
    const points = cleanItems
      .map(d => {
        if (!d) {
          console.warn('Invalid data point:', d);
          return null;
        }
        // Use EnqueuedTimeUtc if no timestamp
        const t = new Date(d.timestamp || d.EnqueuedTimeUtc).getTime();
        const v = parseFloat(d[field]);
        return isNaN(v) ? null : [t, v];
      })
      .filter(pt => pt !== null);
      
    console.log(`Field ${field} has ${points.length} valid points`);
    return points;
  }

  const series = {
    temperature: pluck('temperature'),
    humidity:    pluck('humidity'),
    pressure:    pluck('pressure'),
    light:       pluck('light')
  };
  
  console.log('Prepared series:', series);
  return series;
}

// ————————————————————————————
//  4) Render 4 charts with Highcharts
// ————————————————————————————
function renderCharts(rawItems) {
  if (!rawItems || rawItems.length === 0) {
    console.error('No data points to render');
    return;
  }

  console.log('Rendering charts with', rawItems.length, 'items');
  const series = prepareSeries(rawItems);
  
  // Safely get latest values with better error handling
  const getLatest = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return '–';
    const lastPoint = arr[arr.length - 1];
    return Array.isArray(lastPoint) ? lastPoint[1] : '–';
  };

  const latest = {
    temp: getLatest(series.temperature),
    hum:  getLatest(series.humidity),
    pres: getLatest(series.pressure),
    light: getLatest(series.light)
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