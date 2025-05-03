// =============================================
// Configuration 
// =============================================
const CONFIG = {
  storage: {
    account: 'homeoffice1',
    container: 'telementry',
    sasToken: 'sv=2024-11-04&ss=bfqt&srt=co&sp=rwdlacupiytfx&se=2026-05-01T19:22:12Z&st=2025-05-01T11:22:12Z&spr=https&sig=F1rO3kwekla0ZgwLntABz5KzbhufD1S4zxLMfAsHbTk%3D',
    maxPoints: 300
  },
  charts: {
    colors: {
      temperature: '#ff6384',
      humidity: '#36a2eb',
      co2: '#ffcd56',
      light: '#4bc0c0'
    },
    units: {
      temperature: '℃',
      humidity: '%RH',
      co2: 'PPM',
      light: 'lux'
    }
  },
  timeRanges: {
    // Minutes for time range filters (0 = all data)
    filters: [0, 3, 5, 10, 20]
  }
};

// Blob storage URL
const BASE_URL = `https://${CONFIG.storage.account}.blob.core.windows.net/${CONFIG.storage.container}`;

// Global variables
let charts = [];
let isLoading = false;
let rawData = []; // Store the original data
let activeTimeFilter = 0; // 0 = show all data

// Make activeTimeFilter a proper property so it can be tracked
Object.defineProperty(window, 'activeTimeFilter', {
  get: function() { return activeTimeFilter; },
  set: function(value) { 
    activeTimeFilter = value;
    console.log('Time filter changed to:', value);
    
    // If we have raw data, apply the filter immediately
    if (rawData && rawData.length > 0) {
      applyTimeFilter(value);
    }
  }
});

// Make isLoading a proper property so it can be tracked
Object.defineProperty(window, 'isLoading', {
  get: function() { return isLoading; },
  set: function(value) { 
    isLoading = value;
    console.log('Loading state changed to:', value);
    
    // Disable filter buttons when loading
    const filterButtons = document.querySelectorAll('.time-filter-btn');
    filterButtons.forEach(btn => {
      btn.disabled = value;
      if (value) {
        btn.classList.add('opacity-50');
      } else {
        btn.classList.remove('opacity-50');
      }
    });
  }
});

// =============================================
// Data Loading Functions
// =============================================

/**
 * Lists all blobs in the container
 * @returns {Promise<string[]>} Array of blob names
 */
async function listBlobs() {
  try {
    const url = `${BASE_URL}?restype=container&comp=list&${CONFIG.storage.sasToken}`;
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

/**
 * Loads data from all blobs
 * @returns {Promise<Array>} Combined data from all blobs
 */
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
        const r = await fetch(`${BASE_URL}/${name}?${CONFIG.storage.sasToken}`, {
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

// =============================================
// Data Processing Functions 
// =============================================

/**
 * Prepares data series for charting
 * @param {Array} items - Raw data items
 * @returns {Object} Chart-ready data series
 */
function prepareSeries(items) {
  console.log('Preparing series with original items:', items);
  
  // Extract data from Body if present, preserving timestamp
  const cleanItems = cleanAndNormalizeData(items);

  console.log('Cleaned items with timestamp:', cleanItems);
  
  if (cleanItems.length === 0) {
    console.warn("No valid items left after cleaning and timestamp check.");
    return { temperature: [], humidity: [], co2: [], light: [] };
  }

  // Process all data without date filtering
  let itemsToProcess = cleanItems;
  
  console.log(`Processing all ${cleanItems.length} data points`);
  
  // Sort data by timestamp
  itemsToProcess.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Create series for each measurement type
  const series = {
    temperature: extractDataPoints(itemsToProcess, 'temperature'),
    humidity: extractDataPoints(itemsToProcess, 'humidity'),
    co2: extractDataPoints(itemsToProcess, 'co2'),
    light: extractDataPoints(itemsToProcess, 'light')
  };
  
  console.log('Prepared series:', series);
  return series;
}

/**
 * Cleans and normalizes raw data
 * @param {Array} items - Raw data items
 * @returns {Array} Cleaned data items
 */
function cleanAndNormalizeData(items) {
  return items.map(item => {
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
}

/**
 * Extracts data points for a specific field
 * @param {Array} items - Cleaned data items
 * @param {string} field - Field name to extract
 * @returns {Array} Formatted data points for the field
 */
function extractDataPoints(items, field) {
  const points = items
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

/**
 * Aggregates data into specified minute intervals by averaging
 * @param {Array} data - Data points to aggregate
 * @param {string} field - Field to aggregate (temperature, humidity, etc.)
 * @param {number} intervalMin - Interval in minutes (0 = no aggregation)
 * @returns {Array} Aggregated data points
 */
function aggregateData(data, field, intervalMin) {
  if (!data || data.length === 0) return [];
  
  // If intervalMin is 0 or not specified, return all data without aggregation
  if (!intervalMin) {
    return data.map(item => {
      return {
        x: new Date(item.timestamp),
        y: parseFloat(item[field])
      };
    }).filter(pt => !isNaN(pt.y) && pt.x instanceof Date);
  }

  console.log(`Aggregating ${field} data into ${intervalMin}-minute intervals`);
  
  // Calculate milliseconds per bin
  const msPerBin = intervalMin * 60 * 1000;
  const buckets = new Map();

  // Group data points into time buckets
  data.forEach(item => {
    const timestamp = new Date(item.timestamp);
    if (!(timestamp instanceof Date) || isNaN(timestamp.getTime())) return;
    
    const value = parseFloat(item[field]);
    if (isNaN(value)) return;
    
    // Create a bucket key by flooring the timestamp to the nearest interval
    const key = Math.floor(timestamp.getTime() / msPerBin) * msPerBin;
    
    if (buckets.has(key)) {
      buckets.get(key).push(value);
    } else {
      buckets.set(key, [value]);
    }
  });

  // Convert buckets to data points with averaged values
  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([bucketKey, values]) => ({
      x: new Date(bucketKey),
      y: values.reduce((sum, v) => sum + v, 0) / values.length
    }));
}

// =============================================
// Chart Rendering Functions
// =============================================

/**
 * Renders charts with the provided data
 * @param {Array} rawItems - Raw data items
 * @param {boolean} applyTimeFilter - Whether to apply the time filter
 */
function renderCharts(rawItems, applyTimeFilter = true) {
  if (!rawItems || rawItems.length === 0) {
    console.error('No data points to render');
    return;
  }

  console.log('Rendering charts with', rawItems.length, 'items');
  
  // Store raw data globally for filtering
  if (!applyTimeFilter) {
    rawData = [...rawItems];
  }
  
  // Apply time filter if needed
  const filteredItems = applyTimeFilter ? filterDataByTimeRange(rawItems, activeTimeFilter) : rawItems;
  console.log(`Filtered to ${filteredItems.length} items using ${activeTimeFilter} minute filter`);
  
  const series = prepareSeries(filteredItems);
  const latest = getLatestValues(series);
  const chartOptions = getChartOptions();

  // Clear any existing charts
  destroyExistingCharts();
  
  // Create the charts
  createTemperatureChart(series.temperature, latest.temp, chartOptions);
  createHumidityChart(series.humidity, latest.hum, chartOptions);
  createCO2Chart(series.co2, latest.co2, chartOptions);
  createLightChart(series.light, latest.light, chartOptions);
  
  // Hide any loading overlay
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) {
    loadingOverlay.remove();
  }
}

/**
 * Filters data based on a time range
 * @param {Array} data - Data to filter
 * @param {number} minutes - Minutes to filter (0 = all data)
 * @returns {Array} Filtered data
 */
function filterDataByTimeRange(data, minutes) {
  // If minutes is 0 or not specified, return all data
  if (!minutes) return data;
  
  // Calculate the cutoff time
  const now = new Date();
  const cutoffTime = new Date(now.getTime() - (minutes * 60 * 1000));
  
  console.log(`Filtering data since: ${cutoffTime.toISOString()}`);
  
  // Filter the data to only include items after the cutoff time
  return data.filter(item => {
    try {
      const timestamp = item.timestamp || item.SystemProperties?.enqueuedTime || item.EnqueuedTimeUtc;
      if (!timestamp) return false;
      
      const itemTime = new Date(timestamp);
      return itemTime >= cutoffTime;
    } catch (error) {
      console.warn('Error parsing date for filtering:', error);
      return false;
    }
  });
}

/**
 * Gets the latest values for each measurement type
 * @param {Object} series - Prepared data series
 * @returns {Object} Latest values
 */
function getLatestValues(series) {
  // Helper to get latest value
  const getLatest = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const lastPoint = arr[arr.length - 1];
    if (lastPoint && typeof lastPoint.y === 'number' && !isNaN(lastPoint.y)) {
      return lastPoint.y;
    }
    return null;
  };

  return {
    temp: getLatest(series.temperature),
    hum: getLatest(series.humidity),
    co2: getLatest(series.co2),
    light: getLatest(series.light)
  };
}

/**
 * Gets common chart options
 * @returns {Object} Chart configuration options
 */
function getChartOptions() {
  return {
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
          tooltipFormat: 'MMM dd, yyyy HH:mm',
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
}

/**
 * Safely gets canvas context
 * @param {string} elementId - Canvas element ID
 * @returns {CanvasRenderingContext2D|null} Canvas context or null
 */
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

/**
 * Creates a chart safely
 * @param {string} elementId - Canvas element ID
 * @param {Object} config - Chart configuration
 * @returns {Chart|null} Chart instance or null
 */
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

/**
 * Creates the temperature chart
 * @param {Array} data - Temperature data points
 * @param {number} latestValue - Latest temperature value
 * @param {Object} commonOptions - Common chart options
 */
function createTemperatureChart(data, latestValue, commonOptions) {
  if (data.length > 0) {
    charts[0] = createChart('temperatureChart', {
      type: 'line',
      data: {
        datasets: [{
          data: data,
          borderColor: CONFIG.charts.colors.temperature,
          fill: false
        }]
      },
      options: {
        ...commonOptions,
        plugins: {
          ...commonOptions.plugins,
          title: {
            display: true,
            text: `Temperature: ${latestValue !== null ? latestValue.toFixed(1) + CONFIG.charts.units.temperature : 'N/A'}`,
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
              text: CONFIG.charts.units.temperature,
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
    showNoDataMessage('temperatureChart', 'Temperature');
  }
}

/**
 * Creates the humidity chart
 * @param {Array} data - Humidity data points
 * @param {number} latestValue - Latest humidity value
 * @param {Object} commonOptions - Common chart options
 */
function createHumidityChart(data, latestValue, commonOptions) {
  if (data.length > 0) {
    charts[1] = createChart('humidityChart', {
      type: 'line',
      data: {
        datasets: [{
          data: data,
          borderColor: CONFIG.charts.colors.humidity,
          fill: false
        }]
      },
      options: {
        ...commonOptions,
        plugins: {
          ...commonOptions.plugins,
          title: {
            display: true,
            text: `Humidity: ${latestValue !== null ? latestValue.toFixed(1) + ' ' + CONFIG.charts.units.humidity : 'N/A'}`,
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
              text: CONFIG.charts.units.humidity,
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
    showNoDataMessage('humidityChart', 'Humidity');
  }
}

/**
 * Creates the CO2 chart
 * @param {Array} data - CO2 data points
 * @param {number} latestValue - Latest CO2 value
 * @param {Object} commonOptions - Common chart options
 */
function createCO2Chart(data, latestValue, commonOptions) {
  if (data.length > 0) {
    charts[2] = createChart('co2Chart', {
      type: 'line',
      data: {
        datasets: [{
          data: data,
          borderColor: CONFIG.charts.colors.co2,
          fill: false
        }]
      },
      options: {
        ...commonOptions,
        plugins: {
          ...commonOptions.plugins,
          title: {
            display: true,
            text: `CO2: ${latestValue !== null ? Math.round(latestValue) + ' ' + CONFIG.charts.units.co2 : 'N/A'}`,
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
              text: CONFIG.charts.units.co2,
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
    showNoDataMessage('co2Chart', 'CO2');
  }
}

/**
 * Creates the light chart
 * @param {Array} data - Light data points
 * @param {number} latestValue - Latest light value
 * @param {Object} commonOptions - Common chart options
 */
function createLightChart(data, latestValue, commonOptions) {
  if (data.length > 0) {
    charts[3] = createChart('lightChart', {
      type: 'line',
      data: {
        datasets: [{
          data: data,
          borderColor: CONFIG.charts.colors.light,
          fill: false
        }]
      },
      options: {
        ...commonOptions,
        plugins: {
          ...commonOptions.plugins,
          title: {
            display: true,
            text: `Light: ${latestValue !== null ? Math.round(latestValue) + ' ' + CONFIG.charts.units.light : 'N/A'}`,
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
              text: CONFIG.charts.units.light,
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
    showNoDataMessage('lightChart', 'Light');
  }
}

/**
 * Shows a no data message for a chart
 * @param {string} elementId - Canvas element ID
 * @param {string} sensorName - Sensor name
 */
function showNoDataMessage(elementId, sensorName) {
  const container = document.getElementById(elementId)?.parentElement;
  if (container) {
    container.innerHTML = `<div class="flex items-center justify-center h-full">
      <p class="text-white text-center">${sensorName} data not available.</p>
    </div>`;
  }
}

/**
 * Destroys existing charts
 */
function destroyExistingCharts() {
  charts.forEach(chart => {
    if (chart) chart.destroy();
  });
  charts = [];
}

// =============================================
// App Control Functions
// =============================================

/**
 * Refreshes data and updates charts
 */
function refreshData() {
  if (window.isLoading) return; // Prevent multiple simultaneous requests
  
  // Show loading state
  window.isLoading = true;
  const refreshButton = document.getElementById('refreshButton');
  const originalHTML = refreshButton.innerHTML;
  refreshButton.disabled = true;
  refreshButton.innerHTML = `
    <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    <span class="hidden md:inline ml-1">Loading...</span>
  `;
  
  // Clear existing charts
  destroyExistingCharts();
  
  // Load fresh data with retry mechanism
  let retryCount = 0;
  const maxRetries = 2;
  
  function attemptDataLoad() {
    showLoadingMessage(`Loading data... ${retryCount > 0 ? '(Retry ' + retryCount + ')' : ''}`);
    
    loadData()
      .then(data => {
        if (data && data.length > 0) {
          // Store the raw data first (cleaned and normalized)
          rawData = cleanAndNormalizeData(data);
          console.log(`Loaded ${rawData.length} data points`);
          
          // Apply the current time filter (or all data if filter is 0)
          applyTimeFilter(activeTimeFilter);
          
          // Reset button state right after successful data load
          const refreshButton = document.getElementById('refreshButton');
          if (refreshButton) {
            refreshButton.disabled = false;
            refreshButton.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span class="hidden md:inline ml-1">Refresh</span>
            `;
          }
        } else {
          if (retryCount < maxRetries) {
            retryCount++;
            showLoadingMessage(`No data received. Retrying (${retryCount}/${maxRetries})...`);
            setTimeout(attemptDataLoad, 1500); // Wait before retry
          } else {
            showLoadingMessage("Couldn't load data after multiple attempts. Please try again later.");
            console.error("Failed to load data after retries");
            window.isLoading = false;
          }
        }
      })
      .catch(err => {
        console.error('Error loading data:', err);
        if (retryCount < maxRetries) {
          retryCount++;
          showLoadingMessage(`Error loading data. Retrying (${retryCount}/${maxRetries})...`);
          setTimeout(attemptDataLoad, 1500); // Wait before retry
        } else {
          showLoadingMessage("Couldn't load data. Please check your connection and try again.");
          window.isLoading = false;
        }
      })
      .finally(() => {
        if (retryCount >= maxRetries || charts.length > 0) {
          // Reset button state
          window.isLoading = false;
          refreshButton.disabled = false;
          refreshButton.innerHTML = originalHTML;
        }
      });
  }
  
  // Start loading with retry mechanism
  attemptDataLoad();
}

/**
 * Apply the current time filter to the raw data and update charts
 * @param {number} minutes - Minutes to filter (0 = all data, 3/5/10/20 = aggregation intervals)
 */
function applyTimeFilter(minutes) {
  if (!rawData || rawData.length === 0) return;
  
  showLoadingMessage(`Applying ${minutes ? minutes + 'm' : 'all data'} filter...`);
  
  // Small delay to allow UI to update
  setTimeout(() => {
    // Aggregate data for each sensor type using the interval
    const temperatureData = aggregateData(rawData, 'temperature', minutes);
    const humidityData = aggregateData(rawData, 'humidity', minutes);
    const co2Data = aggregateData(rawData, 'co2', minutes);
    const lightData = aggregateData(rawData, 'light', minutes);
    
    console.log(`Aggregated data points: Temp=${temperatureData.length}, Humidity=${humidityData.length}, CO2=${co2Data.length}, Light=${lightData.length}`);
    
    // Create aggregated series
    const aggregatedSeries = {
      temperature: temperatureData,
      humidity: humidityData,
      co2: co2Data,
      light: lightData
    };
    
    // Update all charts with aggregated data
    updateChartsWithSeries(aggregatedSeries);
  }, 100);
}

/**
 * Updates all charts with the provided data series
 * @param {Object} series - Data series for all chart types
 */
function updateChartsWithSeries(series) {
  // Clear any existing charts
  destroyExistingCharts();
  
  // Get latest values for chart titles
  const latest = getLatestValues(series);
  const chartOptions = getChartOptions();
  
  // Create the charts
  createTemperatureChart(series.temperature, latest.temp, chartOptions);
  createHumidityChart(series.humidity, latest.hum, chartOptions);
  createCO2Chart(series.co2, latest.co2, chartOptions);
  createLightChart(series.light, latest.light, chartOptions);
  
  // Hide any loading overlay
  const loadingOverlay = document.getElementById('loadingOverlay');
  if (loadingOverlay) {
    loadingOverlay.remove();
  }
  
  // Ensure loading state is reset
  window.isLoading = false;
}

// =============================================
// Expose functions to window for HTML access
// =============================================
window.renderCharts = renderCharts;
window.activeTimeFilter = activeTimeFilter;
window.rawData = rawData;
window.refreshData = refreshData;
window.filterDataByTimeRange = filterDataByTimeRange;
window.applyTimeFilter = applyTimeFilter;
window.isLoading = isLoading;