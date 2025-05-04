// =============================================
// Configuration 
// =============================================
const CONFIG = {
  storage: {
    account: 'homeoffice1',
    container: 'sensor-rollups',
    sasToken: 'sv=2024-11-04&ss=bfqt&srt=co&sp=rwdlacupiytfx&se=2026-05-01T19:22:12Z&st=2025-05-01T11:22:12Z&spr=https&sig=F1rO3kwekla0ZgwLntABz5KzbhufD1S4zxLMfAsHbTk%3D'
  },
  charts: {
    colors: {
      temperature: '#ff6384',
      humidity:    '#36a2eb',
      co2:         '#ffcd56',
      light:       '#4bc0c0'
    },
    units: {
      temperature: '℃',
      humidity:    '%RH',
      co2:         'PPM',
      light:       'lux'
    }
  },
  timeRanges: [0, 3, 5, 10, 20]  // 0=All, else minutes
};

// build base URL
const BASE_URL = `https://${CONFIG.storage.account}.blob.core.windows.net/${CONFIG.storage.container}`;

// track state
let charts = [];
let isLoading = false;
let activeTimeFilter = 0;  // 0=All

// make isLoading reactive
Object.defineProperty(window, 'isLoading', {
  get: () => isLoading,
  set: v => {
    isLoading = v;
    document.querySelectorAll('.time-filter-btn').forEach(btn => {
      btn.disabled = v;
      btn.classList.toggle('opacity-50', v);
    });
  }
});

// make activeTimeFilter reactive
Object.defineProperty(window, 'activeTimeFilter', {
  get: () => activeTimeFilter,
  set: v => {
    activeTimeFilter = v;
    refreshData();
  }
});

// map minutes → blob filename
const INTERVAL_FILE = {
  3:  '3min/last1h.json',
  5:  '5min/last6h.json',
  10: '10min/last24h.json',
  20: '20min/last7d.json'
};

// =============================================
// Fetch one aggregated file
// =============================================
async function fetchAggregated(minutes) {
  const interval = minutes || 3;            // default 3min when "All"
  const filename = INTERVAL_FILE[interval];
  const url = `${BASE_URL}/${filename}?${CONFIG.storage.sasToken}`;

  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`Fetch ${filename} failed: ${res.status}`);
  return await res.json();  // should be { temperature: [...], humidity: [...], co2: [...], light: [...] }
}

// =============================================
// Chart plumbing (context, create, destroy, etc.)
// (You can lift these from your existing code verbatim.)
// =============================================
function getCanvasContext(id) {
  const c = document.getElementById(id);
  if (!c) return null;
  return c.getContext('2d');
}
function destroyExistingCharts() {
  charts.forEach(c => c && c.destroy());
  charts = [];
}
function getChartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { type:'time', time:{unit:'minute',displayFormats:{minute:'HH:mm'}}, grid:{color:'rgba(255,255,255,0.1)'}, ticks:{color:'#eee'} },
      y: { grid:{color:'rgba(255,255,255,0.1)'}, ticks:{color:'#eee'} }
    },
    plugins: { legend:{display:false}, tooltip:{backgroundColor:'rgba(0,0,0,0.7)'} },
    backgroundColor: 'transparent'
  };
}
function createLineChart(ctx, data, color, title) {
  return new Chart(ctx, {
    type:'line',
    data:{ 
      datasets:[{ 
        data, 
        borderColor: color, 
        fill: false,
        backgroundColor: 'transparent'
      }] 
    },
    options:{
      ...getChartOptions(),
      plugins:{
        ...getChartOptions().plugins,
        title:{ display:true, text:title, color:'#eee', font:{size:18} }
      }
    }
  });
}

// =============================================
// Refresh & render
// =============================================
async function refreshData() {
  if (window.isLoading) return;
  window.isLoading = true;
  const btn = document.getElementById('refreshButton');
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<svg class="animate-spin h-5 w-5" …></svg>`;

  try {
    const raw = await fetchAggregated(activeTimeFilter);
    console.log('Aggregated payload:', raw);

    // for each sensor, map {t,y}→{x:Date,y}
    const series = {};
    ['temperature','humidity','co2','light'].forEach(key => {
      const arr = raw[key] || [];
      series[key] = arr.map(pt => ({ x:new Date(pt.t), y:pt.y }));
    });

    // clear & draw
    destroyExistingCharts();
    const opts = getChartOptions();
    charts.push(
      createLineChart(getCanvasContext('temperatureChart'), series.temperature, CONFIG.charts.colors.temperature, `Temperature (${CONFIG.charts.units.temperature})`),
      createLineChart(getCanvasContext('humidityChart'),    series.humidity,    CONFIG.charts.colors.humidity,    `Humidity (${CONFIG.charts.units.humidity})`),
      createLineChart(getCanvasContext('co2Chart'),         series.co2,         CONFIG.charts.colors.co2,         `CO₂ (${CONFIG.charts.units.co2})`),
      createLineChart(getCanvasContext('lightChart'),       series.light,       CONFIG.charts.colors.light,       `Light (${CONFIG.charts.units.light})`)
    );
  } catch (e) {
    console.error('Error loading data:', e);
    alert(`Could not load data:\n${e.message}`);
  } finally {
    window.isLoading = false;
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

// =============================================
// UI wiring
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  // time-filter buttons
  document.querySelectorAll('.time-filter-btn').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.time-filter-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      window.activeTimeFilter = parseInt(btn.dataset.minutes,10);
    });
  });
  // refresh button
  document.getElementById('refreshButton')
          .addEventListener('click', refreshData);
  // initial load
  refreshData();
});