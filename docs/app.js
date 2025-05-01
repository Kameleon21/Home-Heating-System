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
  console.log('Preparing series with original items:', items);
  
  // Extract data from Body if present, preserving timestamp
  const cleanItems = items.map(item => {
    if (!item) return null; // Skip null items

    let bodyData = null;
    if (item.Body) {
      if (typeof item.Body === 'string') {
        try {
          bodyData = JSON.parse(item.Body);
        } catch (e) {
          console.warn('Failed to parse Body:', item.Body, e);
          return null; // Skip if Body parsing fails
        }
      } else if (typeof item.Body === 'object') {
        bodyData = item.Body;
      }
    } else {
      // If no Body, assume the item itself contains sensor data + timestamp
      bodyData = item;
    }

    if (!bodyData) return null; // Skip if no usable data found

    // Ensure timestamp exists, preferring 'timestamp' over 'EnqueuedTimeUtc'
    const timestamp = bodyData.timestamp || item.SystemProperties?.enqueuedTime || item.EnqueuedTimeUtc;
    if (!timestamp) {
        console.warn('Missing timestamp for item:', item);
        return null; // Skip if no timestamp found
    }

    // Return a new object with sensor data and a unified 'timestamp' field
    return {
      ...bodyData, // Spread sensor values (temp, hum, etc.)
      timestamp: timestamp // Add the timestamp
    };
    
  }).filter(item => item !== null);

  console.log('Cleaned items with timestamp:', cleanItems);
  
  if (cleanItems.length === 0) {
    console.warn("No valid items left after cleaning and timestamp check.");
    // Return empty series with the correct keys
    return { temperature: [], humidity: [], co2: [], light: [] }; 
  }

  // sort by timestamp
  cleanItems.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // helper to pluck and timestamp-convert
  function pluck(field) {
    const points = cleanItems
      .map(d => {
        // Timestamp is now guaranteed to exist in 'd.timestamp'
        const t = new Date(d.timestamp).getTime(); 
        const v = parseFloat(d[field]);
        
        // Check for NaN timestamp or value
        if (isNaN(t) || isNaN(v)) {
            // console.warn(`Invalid data for field ${field}:`, d); // Optional: more detailed logging
            return null; 
        }
        return [t, v];
      })
      .filter(pt => pt !== null); // Filter out nulls from invalid timestamps/values
      
    console.log(`Field '${field}' has ${points.length} valid points`);
    return points;
  }

  const series = {
    temperature: pluck('temperature'),
    humidity:    pluck('humidity'),
    co2:         pluck('co2'),
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
    if (!Array.isArray(arr) || arr.length === 0) return null; // Return null if no data
    const lastPoint = arr[arr.length - 1];
    // Ensure lastPoint is an array [timestamp, value] and value is numeric
    if (Array.isArray(lastPoint) && typeof lastPoint[1] === 'number' && !isNaN(lastPoint[1])) {
        return lastPoint[1];
    }
    return null; // Return null if data is invalid
  };

  const latest = {
    temp: getLatest(series.temperature),
    hum:  getLatest(series.humidity),
    co2:  getLatest(series.co2),
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

  // Only render chart if data exists
  if (series.temperature.length > 0) {
    Highcharts.chart('temperature', {
      ...commonOpts,
      title: { useHTML: true,
        text: `<i class="thermometer half icon"></i>
               Temperature: ${latest.temp !== null ? latest.temp.toFixed(1) + '℃' : 'N/A'}`
      },
      yAxis: { title: { text: '℃' } },
      series: [{ data: series.temperature }]
    });
  } else {
      document.getElementById('temperature').innerHTML = '<p style="text-align: center; padding-top: 50px;">Temperature data not available.</p>';
  }

  if (series.humidity.length > 0) {
    Highcharts.chart('humidity', {
      ...commonOpts,
      title: { useHTML: true,
        text: `<i class="tint icon"></i>
               Humidity: ${latest.hum !== null ? latest.hum.toFixed(1) + ' %RH' : 'N/A'}`
      },
      yAxis: { title: { text: '%RH' } },
      series: [{ data: series.humidity }]
    });
  } else {
      document.getElementById('humidity').innerHTML = '<p style="text-align: center; padding-top: 50px;">Humidity data not available.</p>';
  }

  if (series.co2.length > 0) {
    Highcharts.chart('co2', {
      ...commonOpts,
      title: { useHTML: true,
        text: `<i class="molecule icon"></i>
               CO2: ${latest.co2 !== null ? Math.round(latest.co2) + ' PPM' : 'N/A'}`
      },
      yAxis: { title: { text: 'PPM' } },
      series: [{ data: series.co2 }]
    });
  } else {
      document.getElementById('co2').innerHTML = '<p style="text-align: center; padding-top: 50px;">CO2 data not available.</p>';
  }

  if (series.light.length > 0) {
    Highcharts.chart('light', {
      ...commonOpts,
      title: { useHTML: true,
        text: `<i class="lightbulb icon"></i>
               Light: ${latest.light !== null ? Math.round(latest.light) + ' lux' : 'N/A'}`
      },
      yAxis: { title: { text: 'Lux' } },
      series: [{ data: series.light }]
    });
  } else {
      document.getElementById('light').innerHTML = '<p style="text-align: center; padding-top: 50px;">Light data not available.</p>';
  }
}