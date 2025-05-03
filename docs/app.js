// Configuration
const ACCOUNT   = 'homeoffice1';
const CONTAINER = 'telementry';
const SAS_TOKEN = 'sv=2024-11-04&ss=bfqt&srt=co&sp=rwdlacupiytfx&se=2026-05-01T19:22:12Z&st=2025-05-01T11:22:12Z&spr=https&sig=F1rO3kwekla0ZgwLntABz5KzbhufD1S4zxLMfAsHbTk%3D'; // Replace with your actual SAS token
const BASE_URL  = `https://${ACCOUNT}.blob.core.windows.net/${CONTAINER}`;
const MAX_POINTS = 300;

// List blobs in container
async function listBlobs() {
  try {
    const url = `${BASE_URL}?restype=container&comp=list&${SAS_TOKEN}`;
    const res = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'x-ms-version': '2020-04-08'
      }
    });
    
    if (!res.ok) throw new Error(`List blobs failed: ${res.status}`);
    const xml = await res.text();
    const dom = new DOMParser().parseFromString(xml, 'application/xml');
    return Array.from(dom.getElementsByTagName('Blob'))
      .map(b => b.getElementsByTagName('Name')[0].textContent)
      .filter(n => n.endsWith('.json'));
  } catch (error) {
    console.error('Error listing blobs:', error);
    return [];
  }
}

// Download & flatten JSON from each blob
async function loadData() {
  try {
    const names = await listBlobs();
    console.log('Found blobs:', names);
    
    if (names.length === 0) {
      console.warn('No blobs found. Check your storage account configuration.');
      return [];
    }
    
    let all = [];
    for (let name of names) {
      try {
        const r = await fetch(`${BASE_URL}/${name}?${SAS_TOKEN}`, {
          method: 'GET',
          mode: 'cors',
          cache: 'no-cache',
          headers: {
            'x-ms-version': '2020-04-08'
          }
        });
        
        if (!r.ok) {
          console.error(`Failed to fetch ${name}: ${r.status}`);
          continue;
        }
        const text = await r.text();
        console.log(`Raw data from ${name}:`, text.substring(0, 200) + '...');
        
        try {
          const json = JSON.parse(text);
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
  } catch (error) {
    console.error('Error loading data:', error);
    return [];
  }
}

// Prepare series for Chart.js
function prepareSeries(items) {
  console.log('Preparing series with original items:', items);
  
  // Extract data from Body if present, preserving timestamp
  const cleanItems = items.map(item => {
    if (!item) return null;

    let bodyData = null;
    if (item.Body) {
      if (typeof item.Body === 'string') {
        try {
          bodyData = JSON.parse(item.Body);
        } catch (e) {
          console.warn('Failed to parse Body:', item.Body, e);
          return null;
        }
      } else if (typeof item.Body === 'object') {
        bodyData = item.Body;
      }
    } else {
      bodyData = item;
    }

    if (!bodyData) return null;

    const timestamp = bodyData.timestamp || item.SystemProperties?.enqueuedTime || item.EnqueuedTimeUtc;
    if (!timestamp) {
      console.warn('Missing timestamp for item:', item);
      return null;
    }

    return {
      ...bodyData,
      timestamp: timestamp
    };
  }).filter(item => item !== null);

  console.log('Cleaned items with timestamp:', cleanItems);
  
  if (cleanItems.length === 0) {
    console.warn("No valid items left after cleaning and timestamp check.");
    return { temperature: [], humidity: [], co2: [], light: [] };
  }

  // Always filter for today's data
  // Create today at midnight in local timezone
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  console.log('Filtering items starting from:', today.toISOString());
  
  const todayItems = cleanItems.filter(item => {
    try {
      const itemDate = new Date(item.timestamp);
      const isToday = itemDate >= today;
      return isToday;
    } catch (error) {
      console.warn('Error parsing date:', item.timestamp, error);
      return false;
    }
  });
  
  console.log(`Filtered to ${todayItems.length} items from today out of ${cleanItems.length} total items`);
  
  // Use today's items if available, otherwise fall back to all data
  let itemsToProcess = todayItems.length > 0 ? todayItems : cleanItems;
  
  // For debugging
  if (todayItems.length === 0) {
    console.warn('No items found for today, showing all data instead');
    // Log the earliest and latest timestamps in the data
    if (cleanItems.length > 0) {
      const dates = cleanItems.map(item => new Date(item.timestamp));
      const earliest = new Date(Math.min(...dates));
      const latest = new Date(Math.max(...dates));
      console.log('Date range in data:', earliest.toISOString(), 'to', latest.toISOString());
    }
  }
  
  itemsToProcess.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Helper to pluck and format data for Chart.js
  function pluck(field) {
    const points = itemsToProcess
      .map(d => {
        const t = new Date(d.timestamp);
        const v = parseFloat(d[field]);
        if (isNaN(t.getTime()) || isNaN(v)) return null;
        return { x: t, y: v };
      })
      .filter(pt => pt !== null);
      
    console.log(`Field '${field}' has ${points.length} valid points`);
    return points;
  }

  const series = {
    temperature: pluck('temperature'),
    humidity: pluck('humidity'),
    co2: pluck('co2'),
    light: pluck('light')
  };
  
  console.log('Prepared series:', series);
  return series;
}

// Render charts with Chart.js
function renderCharts(rawItems) {
  if (!rawItems || rawItems.length === 0) {
    console.error('No data points to render');
    return;
  }

  console.log('Rendering charts with', rawItems.length, 'items');
  const series = prepareSeries(rawItems);

  // Get latest values for chart titles
  const getLatest = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const lastPoint = arr[arr.length - 1];
    if (lastPoint && typeof lastPoint.y === 'number' && !isNaN(lastPoint.y)) {
      return lastPoint.y;
    }
    return null;
  };

  const latest = {
    temp: getLatest(series.temperature),
    hum: getLatest(series.humidity),
    co2: getLatest(series.co2),
    light: getLatest(series.light)
  };

  // Common chart options
  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        top: 10,
        right: 10,
        bottom: 5,
        left: 5
      }
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'minute',
          tooltipFormat: 'MMM DD, YYYY HH:mm',
          displayFormats: {
            minute: 'HH:mm'
          }
        },
        title: {
          display: false, // Hide x-axis title on mobile
          text: 'Time',
          color: '#eee'
        },
        ticks: {
          color: '#eee',
          maxRotation: 45,
          autoSkip: true,
          maxTicksLimit: window.innerWidth < 768 ? 6 : 10,
          autoSkipPadding: window.innerWidth < 768 ? 15 : 5,
          font: {
            size: window.innerWidth < 768 ? 10 : 12
          }
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      },
      y: {
        ticks: {
          color: '#eee',
          font: {
            size: window.innerWidth < 768 ? 10 : 12
          }
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        }
      }
    },
    plugins: {
      legend: {
        display: false
      },
      title: {
        font: {
          size: window.innerWidth < 768 ? 18 : 20,
          weight: 'bold'
        },
        padding: {
          top: 10,
          bottom: 10
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        titleFont: {
          size: 14
        },
        bodyFont: {
          size: 13
        },
        padding: 10
      }
    },
    elements: {
      point: {
        radius: window.innerWidth < 768 ? 3 : 4,
        hoverRadius: window.innerWidth < 768 ? 4 : 6
      },
      line: {
        tension: 0.2,
        borderWidth: window.innerWidth < 768 ? 2 : 3
      }
    }
  };

  // Helper function to safely get canvas context
  function getCanvasContext(elementId) {
    try {
      const canvas = document.getElementById(elementId);
      
      if (!canvas) {
        console.error(`Canvas element '${elementId}' not found`);
        return null;
      }
      
      // Ensure we're working with a proper canvas element
      if (!(canvas instanceof HTMLCanvasElement)) {
        console.error(`Element '${elementId}' is not a canvas element`);
        return null;
      }
      
      // Get 2d context
      const context = canvas.getContext('2d');
      if (!context) {
        console.error(`Could not get 2d context for canvas '${elementId}'`);
        return null;
      }
      
      return context;
    } catch (error) {
      console.error(`Error getting canvas context for '${elementId}':`, error);
      return null;
    }
  }

  // Helper function to safely create chart
  function createChart(elementId, config) {
    const ctx = getCanvasContext(elementId);
    if (!ctx) {
      // If we can't get the context, show error in the chart container
      const container = document.getElementById(elementId)?.parentElement;
      if (container) {
        container.innerHTML = `<div class="flex items-center justify-center h-full">
          <p class="text-white text-center">Error rendering chart. Please refresh the page.</p>
        </div>`;
      }
      return null;
    }
    
    try {
      return new Chart(ctx, config);
    } catch (error) {
      console.error(`Error creating chart for '${elementId}':`, error);
      return null;
    }
  }

  // Temperature chart
  if (series.temperature.length > 0) {
    charts[0] = createChart('temperatureChart', {
      type: 'line',
      data: {
        datasets: [{
          data: series.temperature,
          borderColor: '#ff6384',
          fill: false
        }]
      },
      options: {
        ...commonOptions,
        plugins: {
          ...commonOptions.plugins,
          title: {
            display: true,
            text: `Temperature: ${latest.temp !== null ? latest.temp.toFixed(1) + '℃' : 'N/A'}`,
            color: '#eee',
            font: {
              size: 20
            }
          }
        },
        scales: {
          ...commonOptions.scales,
          y: {
            title: {
              display: true,
              text: '℃',
              color: '#eee'
            },
            ticks: {
              color: '#eee'
            }
          }
        }
      }
    });
  } else {
    const container = document.getElementById('temperatureChart')?.parentElement;
    if (container) {
      container.innerHTML = '<div class="flex items-center justify-center h-full"><p class="text-white text-center">Temperature data not available.</p></div>';
    }
  }

  // Humidity chart
  if (series.humidity.length > 0) {
    charts[1] = createChart('humidityChart', {
      type: 'line',
      data: {
        datasets: [{
          data: series.humidity,
          borderColor: '#36a2eb',
          fill: false
        }]
      },
      options: {
        ...commonOptions,
        plugins: {
          ...commonOptions.plugins,
          title: {
            display: true,
            text: `Humidity: ${latest.hum !== null ? latest.hum.toFixed(1) + ' %RH' : 'N/A'}`,
            color: '#eee',
            font: {
              size: 20
            }
          }
        },
        scales: {
          ...commonOptions.scales,
          y: {
            title: {
              display: true,
              text: '%RH',
              color: '#eee'
            },
            ticks: {
              color: '#eee'
            }
          }
        }
      }
    });
  } else {
    const container = document.getElementById('humidityChart')?.parentElement;
    if (container) {
      container.innerHTML = '<div class="flex items-center justify-center h-full"><p class="text-white text-center">Humidity data not available.</p></div>';
    }
  }

  // CO2 chart
  if (series.co2.length > 0) {
    charts[2] = createChart('co2Chart', {
      type: 'line',
      data: {
        datasets: [{
          data: series.co2,
          borderColor: '#ffcd56',
          fill: false
        }]
      },
      options: {
        ...commonOptions,
        plugins: {
          ...commonOptions.plugins,
          title: {
            display: true,
            text: `CO2: ${latest.co2 !== null ? Math.round(latest.co2) + ' PPM' : 'N/A'}`,
            color: '#eee',
            font: {
              size: 20
            }
          }
        },
        scales: {
          ...commonOptions.scales,
          y: {
            title: {
              display: true,
              text: 'PPM',
              color: '#eee'
            },
            ticks: {
              color: '#eee'
            }
          }
        }
      }
    });
  } else {
    const container = document.getElementById('co2Chart')?.parentElement;
    if (container) {
      container.innerHTML = '<div class="flex items-center justify-center h-full"><p class="text-white text-center">CO2 data not available.</p></div>';
    }
  }

  // Light chart
  if (series.light.length > 0) {
    charts[3] = createChart('lightChart', {
      type: 'line',
      data: {
        datasets: [{
          data: series.light,
          borderColor: '#4bc0c0',
          fill: false
        }]
      },
      options: {
        ...commonOptions,
        plugins: {
          ...commonOptions.plugins,
          title: {
            display: true,
            text: `Light: ${latest.light !== null ? Math.round(latest.light) + ' lux' : 'N/A'}`,
            color: '#eee',
            font: {
              size: 20
            }
          }
        },
        scales: {
          ...commonOptions.scales,
          y: {
            title: {
              display: true,
              text: 'Lux',
              color: '#eee'
            },
            ticks: {
              color: '#eee'
            }
          }
        }
      }
    });
  } else {
    const container = document.getElementById('lightChart')?.parentElement;
    if (container) {
      container.innerHTML = '<div class="flex items-center justify-center h-full"><p class="text-white text-center">Light data not available.</p></div>';
    }
  }
  
  // Hide any loading overlay
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) {
    loadingOverlay.remove();
  }
}