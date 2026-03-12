'use strict';

// ============================================================
// Config
// ============================================================
const GEOJSON_URL =
  'https://raw.githubusercontent.com/codigourbano/distritos-sp/master/distritos-sp.geojson';

const CSV_PATH = 'data/neighborhoods.csv';
const BAIRROS_PATH = 'data/districts-to-bairros.json';

const DEFAULT_DISTRICT_SCORE = 5;

const CRITERIA = [
  { key: 'distance_to_nubank', label: 'Distance to Nubank', weight: 2 },
  { key: 'public_transport',   label: 'Public Transport',   weight: 2 },
  { key: 'safety',             label: 'Safety',             weight: 1.5 },
  { key: 'walkability',        label: 'Walkability',        weight: 1.5 },
  { key: 'traffic',            label: 'Low Traffic',        weight: 1 },
  { key: 'rent_price',         label: 'Affordable Rent',    weight: 1 },
  { key: 'buy_price',          label: 'Affordable Purchase',weight: 0.5 },
  { key: 'green_spaces',       label: 'Green Spaces',       weight: 1 },
  { key: 'nightlife',          label: 'Nightlife',          weight: 0.5 },
  { key: 'family_friendly',    label: 'Family Friendly',    weight: 0.5 },
];

// Weight per criterion (mutable by sliders)
const weights = {};
CRITERIA.forEach(c => { weights[c.key] = c.weight; });

// Default weights snapshot for reset
const defaultWeights = {};
CRITERIA.forEach(c => { defaultWeights[c.key] = c.weight; });

// Minimum score filters (0 = no filter)
const minFilters = {};
CRITERIA.forEach(c => { minFilters[c.key] = 0; });

// ============================================================
// State
// ============================================================
let districtData = {};   // key: normalized district name → scores object
let bairrosData = {};    // key: normalized district name → array of bairro names
let geoLayer = null;
let mapOpacity = 0.82;

// Compare mode state
let compareMode = false;
let compareDistricts = []; // [{ rawName, normName }, ...], max 4
let radarChart = null;
let currentDetailRawName = null;
let currentDetailNormName = null;

const COMPARE_COLORS = [
  { fill: 'rgba(194,110,240,0.2)', border: '#c26ef0' }, // purple
  { fill: 'rgba(34,204,68,0.2)',   border: '#22cc44' }, // green
  { fill: 'rgba(255,204,0,0.2)',   border: '#ffcc00' }, // yellow
  { fill: 'rgba(255,100,68,0.2)',  border: '#ff6444' }, // orange-red
];

// ============================================================
// Map init
// ============================================================
const map = L.map('map', {
  center: [-23.55, -46.63],
  zoom: 12,
  zoomControl: true,
  preferCanvas: true,
}).setView([-23.55, -46.63], 12);

// Dark tile layer (CartoDB dark matter)
L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19,
  }
).addTo(map);

// ============================================================
// Scoring helpers
// ============================================================
function compositeScore(district) {
  let weightedSum = 0;
  let totalWeight = 0;
  CRITERIA.forEach(({ key }) => {
    const w = weights[key] || 0;
    const score = (district && district[key] != null)
      ? parseFloat(district[key])
      : DEFAULT_DISTRICT_SCORE;
    weightedSum += w * score;
    totalWeight += w;
  });
  return totalWeight > 0 ? weightedSum / totalWeight : DEFAULT_DISTRICT_SCORE;
}

let colorScale = chroma.scale(['#ff4444', '#ffcc00', '#22cc44']).domain([1, 10]);

function rebuildColorScale() {
  if (!geoLayer) return;
  const scores = [];
  geoLayer.eachLayer(layer => {
    const name = normalizeName(
      layer.feature.properties.ds_nome || layer.feature.properties.NM_DISTRITO || ''
    );
    scores.push(compositeScore(districtData[name]));
  });
  if (scores.length === 0) return;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  // Keep a small padding so extreme districts get full red/green
  const pad = (max - min) * 0.05;
  colorScale = chroma.scale(['#ff4444', '#ffcc00', '#22cc44'])
    .domain([min - pad, (min + max) / 2, max + pad]);
}

function scoreToColor(score) {
  return colorScale(score).hex();
}

function meetsFilters(district) {
  return CRITERIA.every(({ key }) => {
    const min = minFilters[key] || 0;
    if (min === 0) return true;
    const val = district && district[key] != null
      ? parseFloat(district[key])
      : DEFAULT_DISTRICT_SCORE;
    return val >= min;
  });
}

// ============================================================
// Normalize district names for matching
// ============================================================
function normalizeName(name) {
  return (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // strip accents
    .replace(/[^a-z0-9 ]/gi, '')
    .trim()
    .toUpperCase();
}

// ============================================================
// GeoJSON layer
// ============================================================
function styleFeature(feature) {
  const name = normalizeName(
    feature.properties.ds_nome || feature.properties.NM_DISTRITO || ''
  );
  const district = districtData[name];
  const score = compositeScore(district);
  const filtered = !meetsFilters(district);
  return {
    fillColor: filtered ? '#444' : scoreToColor(score),
    fillOpacity: filtered ? 0.2 : mapOpacity,
    color: '#1a0028',
    weight: 1,
    opacity: filtered ? 0.3 : 0.6,
  };
}

function onEachFeature(feature, layer) {
  const rawName = feature.properties.ds_nome || feature.properties.NM_DISTRITO || 'Unknown';
  const name = normalizeName(rawName);

  layer.on({
    mouseover(e) {
      const district = districtData[name];
      const score = compositeScore(district).toFixed(1);
      layer.setStyle({ weight: 2.5, fillOpacity: 0.88, color: '#c26ef0' });
      layer.getTooltip() && layer.closeTooltip();
      layer.bindTooltip(
        `<div class="district-tooltip"><b>${rawName}</b>Score: <span class="tooltip-score">${score} / 10</span></div>`,
        { sticky: true, permanent: false, opacity: 1, className: 'dark-tooltip' }
      ).openTooltip(e.latlng);
    },
    mouseout() {
      geoLayer.resetStyle(layer);
    },
    click() {
      showDistrictDetail(rawName, name);
      openPopup(rawName, name, layer);
    },
  });
}

function openPopup(rawName, name, layer) {
  const district = districtData[name];
  const score = compositeScore(district).toFixed(1);

  const rows = CRITERIA.map(({ key, label }) => {
    const val = district && district[key] != null ? parseFloat(district[key]).toFixed(0) : '—';
    return `<tr><td>${label}</td><td>${val}</td></tr>`;
  }).join('');

  layer.bindPopup(
    `<div class="popup-name">${rawName}</div>
     <div class="popup-score">${score} <small>/ 10</small></div>
     <table class="popup-table">${rows}</table>`,
    { maxWidth: 220 }
  ).openPopup();
}

// ============================================================
// District detail sidebar panel
// ============================================================
function showDistrictDetail(rawName, normName) {
  currentDetailRawName = rawName;
  currentDetailNormName = normName;

  const panel = document.getElementById('district-detail');
  const content = document.getElementById('detail-content');
  const district = districtData[normName];
  const score = compositeScore(district);

  const bars = CRITERIA.map(({ key, label }) => {
    const val = district && district[key] != null ? parseFloat(district[key]) : DEFAULT_DISTRICT_SCORE;
    const pct = (val / 10) * 100;
    return `
      <div class="detail-bar-row">
        <span class="detail-bar-label">${label}</span>
        <span class="detail-bar-val">${val.toFixed(0)}</span>
        <div class="detail-bar-track">
          <div class="detail-bar-fill" style="width:${pct}%"></div>
        </div>
      </div>`;
  }).join('');

  const notes = district && district.notes
    ? `<div class="detail-notes">${district.notes}</div>`
    : '';

  const bairros = bairrosData[normName];
  const bairrosHTML = bairros && bairros.length > 0
    ? `<div class="detail-bairros">
        <h4 class="detail-bairros-title">Neighbourhoods <span class="bairros-info" data-tooltip="Sources: saopauloaqui.com.br, Wikipedia, Prefeitura SP, saopaulobairros.com.br, spbairros.com.br">ⓘ</span></h4>
        <ul class="detail-bairros-list">${bairros.map(b => `<li>${b}</li>`).join('')}</ul>
      </div>`
    : '';

  const alreadyAdded = compareDistricts.some(d => d.normName === normName);
  const atMax = compareDistricts.length >= 4 && !alreadyAdded;
  const checkboxHTML = compareMode ? `
    <div class="compare-checkbox-row">
      <label class="compare-checkbox-label">
        <input type="checkbox" id="compare-checkbox"
          ${alreadyAdded ? 'checked' : ''}
          ${atMax ? 'disabled' : ''} />
        Add to comparison
        ${atMax ? '<span class="compare-max-hint">(max 4)</span>' : ''}
      </label>
    </div>` : '';

  content.innerHTML = `
    <div class="detail-name">${rawName}</div>
    <div class="detail-score">${score.toFixed(1)} <span>/ 10 composite</span></div>
    ${checkboxHTML}
    <div class="detail-bars">${bars}</div>
    ${notes}
    ${bairrosHTML}
  `;

  if (compareMode) {
    const checkbox = document.getElementById('compare-checkbox');
    if (checkbox) {
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          if (!compareDistricts.some(d => d.normName === normName)) {
            compareDistricts.push({ rawName, normName });
          }
        } else {
          compareDistricts = compareDistricts.filter(d => d.normName !== normName);
        }
        renderCompareDistrictsList();
        updateRadarChart();
        showDistrictDetail(rawName, normName);
      });
    }
  }

  panel.style.display = 'block';

  // Scroll sidebar to detail panel
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ============================================================
// Compare panel functions
// ============================================================
function initRadarChart() {
  const ctx = document.getElementById('compare-chart').getContext('2d');
  radarChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: CRITERIA.map(c => c.label),
      datasets: [],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: {
            color: '#f0e6fa',
            font: { size: 10 },
            boxWidth: 12,
            padding: 10,
          },
        },
      },
      scales: {
        x: {
          min: 0,
          max: 10,
          ticks: {
            stepSize: 2,
            color: '#a080c0',
            font: { size: 9 },
          },
          grid: { color: '#2a0040' },
          border: { color: '#2a0040' },
        },
        y: {
          ticks: {
            color: '#f0e6fa',
            font: { size: 9 },
          },
          grid: { color: '#2a0040' },
          border: { color: '#2a0040' },
        },
      },
    },
  });
}

function updateRadarChart() {
  if (!radarChart) return;
  radarChart.data.datasets = compareDistricts.map((d, i) => {
    const district = districtData[d.normName];
    const data = CRITERIA.map(({ key }) =>
      district && district[key] != null ? parseFloat(district[key]) : DEFAULT_DISTRICT_SCORE
    );
    const color = COMPARE_COLORS[i % COMPARE_COLORS.length];
    return {
      label: d.rawName,
      data,
      backgroundColor: color.fill.replace('0.2', '0.75'),
      borderColor: color.border,
      borderWidth: 1,
      borderRadius: 3,
    };
  });
  radarChart.update();
}

function renderCompareDistrictsList() {
  const list = document.getElementById('compare-districts-list');
  list.innerHTML = '';
  compareDistricts.forEach((d, i) => {
    const color = COMPARE_COLORS[i % COMPARE_COLORS.length];
    const chip = document.createElement('div');
    chip.className = 'compare-chip';
    chip.innerHTML = `
      <span class="compare-chip-dot" style="background:${color.border}"></span>
      <span class="compare-chip-name">${d.rawName}</span>
      <button class="compare-chip-remove" data-norm="${d.normName}">✕</button>
    `;
    chip.querySelector('.compare-chip-remove').addEventListener('click', () => {
      compareDistricts = compareDistricts.filter(x => x.normName !== d.normName);
      renderCompareDistrictsList();
      updateRadarChart();
      if (currentDetailNormName === d.normName || currentDetailNormName) {
        showDistrictDetail(currentDetailRawName, currentDetailNormName);
      }
    });
    list.appendChild(chip);
  });
}

function openComparePanel() {
  const panel = document.getElementById('compare-panel');
  panel.classList.remove('compare-panel-closed');
  panel.classList.add('compare-panel-open');
  if (!radarChart) initRadarChart();
  renderCompareDistrictsList();
  updateRadarChart();
  setTimeout(() => map.invalidateSize(), 310);
}

function closeComparePanel() {
  const panel = document.getElementById('compare-panel');
  panel.classList.remove('compare-panel-open');
  panel.classList.add('compare-panel-closed');
  compareMode = false;
  const toggleBtn = document.getElementById('compare-toggle-btn');
  if (toggleBtn) {
    toggleBtn.textContent = 'Compare';
    toggleBtn.classList.remove('compare-toggle-active');
  }
  setTimeout(() => map.invalidateSize(), 310);
}

// ============================================================
// Recolor map
// ============================================================
function recolorMap() {
  if (!geoLayer) return;
  rebuildColorScale();
  geoLayer.setStyle(styleFeature);
}

// ============================================================
// Sliders
// ============================================================
function buildSliders() {
  const container = document.getElementById('sliders-container');
  container.innerHTML = '';

  CRITERIA.forEach(({ key, label }) => {
    const row = document.createElement('div');
    row.className = 'slider-row';

    const lbl = document.createElement('span');
    lbl.className = 'slider-label';
    lbl.textContent = label;

    const val = document.createElement('span');
    val.className = 'slider-value';
    val.textContent = weights[key].toFixed(1) + '×';

    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '5';
    input.step = '0.1';
    input.value = weights[key];
    input.dataset.key = key;

    input.addEventListener('input', () => {
      weights[key] = parseFloat(input.value);
      val.textContent = weights[key].toFixed(1) + '×';
      recolorMap();
    });

    row.append(lbl, val, input);
    container.appendChild(row);
  });
}

document.getElementById('reset-weights').addEventListener('click', () => {
  CRITERIA.forEach(c => { weights[c.key] = defaultWeights[c.key]; });
  buildSliders();
  recolorMap();
});

// ============================================================
// Filter sliders
// ============================================================
function buildFilterSliders() {
  const container = document.getElementById('filters-container');
  container.innerHTML = '';

  CRITERIA.forEach(({ key, label }) => {
    const row = document.createElement('div');
    row.className = 'slider-row';

    const lbl = document.createElement('span');
    lbl.className = 'slider-label';
    lbl.textContent = label;

    const val = document.createElement('span');
    val.className = 'slider-value';
    val.textContent = minFilters[key] === 0 ? 'Off' : '≥ ' + minFilters[key];

    const input = document.createElement('input');
    input.type = 'range';
    input.min = '0';
    input.max = '9';
    input.step = '1';
    input.value = minFilters[key];
    input.dataset.key = key;

    input.addEventListener('input', () => {
      minFilters[key] = parseInt(input.value);
      val.textContent = minFilters[key] === 0 ? 'Off' : '≥ ' + minFilters[key];
      recolorMap();
    });

    row.append(lbl, val, input);
    container.appendChild(row);
  });
}

document.getElementById('reset-filters').addEventListener('click', () => {
  CRITERIA.forEach(c => { minFilters[c.key] = 0; });
  buildFilterSliders();
  recolorMap();
});

// ============================================================
// Section collapse toggles
// ============================================================
function initSectionToggles() {
  document.querySelectorAll('.section-header').forEach(header => {
    header.addEventListener('click', () => {
      header.closest('.sidebar-section').classList.toggle('section-collapsed');
    });
  });
}

document.getElementById('opacity-slider').addEventListener('input', function () {
  mapOpacity = parseInt(this.value) / 100;
  document.getElementById('opacity-value').textContent = this.value + '%';
  recolorMap();
});

// ============================================================
// CSV parsing & loading
// ============================================================
function parseCSV(csvText) {
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  const data = {};
  result.data.forEach(row => {
    const name = normalizeName(row.district);
    if (name) data[name] = row;
  });
  return data;
}

function setCSVStatus(msg, type = '') {
  const el = document.getElementById('csv-status');
  el.textContent = msg;
  el.className = type;
}

async function loadDefaultCSV() {
  try {
    const resp = await fetch(CSV_PATH);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();
    districtData = parseCSV(text);
    setCSVStatus(`Loaded ${Object.keys(districtData).length} districts.`, 'success');
    recolorMap();
  } catch (err) {
    setCSVStatus('Could not load default CSV. Using fallback scores.', 'error');
    console.warn('CSV load error:', err);
  }
}

async function loadBairros() {
  try {
    const resp = await fetch(BAIRROS_PATH);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    Object.entries(json).forEach(([key, val]) => {
      bairrosData[normalizeName(key)] = val;
    });
  } catch (err) {
    console.warn('Bairros JSON load error:', err);
  }
}

// File input handler
document.getElementById('csv-input').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    districtData = parseCSV(e.target.result);
    recolorMap();
    setCSVStatus(`Loaded ${Object.keys(districtData).length} districts from "${file.name}".`, 'success');
  };
  reader.onerror = () => setCSVStatus('Error reading file.', 'error');
  reader.readAsText(file);
  this.value = ''; // reset so same file can be reloaded
});

// Download CSV
document.getElementById('download-csv').addEventListener('click', () => {
  const csvText = Papa.unparse(
    Object.values(districtData),
    { columns: ['district', ...CRITERIA.map(c => c.key), 'notes'] }
  );
  const blob = new Blob([csvText], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'neighborhoods.csv';
  a.click();
  URL.revokeObjectURL(url);
});

// ============================================================
// Sidebar toggle (mobile)
// ============================================================
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebarBody = document.getElementById('sidebar-body');

sidebarToggle.addEventListener('click', () => {
  sidebarBody.classList.toggle('collapsed');
  sidebarToggle.classList.toggle('open');
  sidebarToggle.textContent = sidebarBody.classList.contains('collapsed') ? '▲' : '▼';
});

// ============================================================
// Compare panel event listeners
// ============================================================
document.getElementById('compare-toggle-btn').addEventListener('click', () => {
  compareMode = !compareMode;
  const btn = document.getElementById('compare-toggle-btn');
  if (compareMode) {
    btn.textContent = 'Done';
    btn.classList.add('compare-toggle-active');
    openComparePanel();
  } else {
    closeComparePanel();
  }
  if (currentDetailRawName) {
    showDistrictDetail(currentDetailRawName, currentDetailNormName);
  }
});

document.getElementById('compare-close-btn').addEventListener('click', () => {
  closeComparePanel();
  if (currentDetailRawName) {
    showDistrictDetail(currentDetailRawName, currentDetailNormName);
  }
});

// ============================================================
// Bootstrap: load GeoJSON + CSV
// ============================================================
async function init() {
  buildSliders();
  buildFilterSliders();
  initSectionToggles();

  // Load CSV + bairros (fast, local)
  await loadDefaultCSV();
  await loadBairros();

  // Load GeoJSON
  try {
    const resp = await fetch(GEOJSON_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const geojson = await resp.json();

    geoLayer = L.geoJSON(geojson, {
      style: styleFeature,
      onEachFeature,
    }).addTo(map);

    // Fit map to SP districts
    map.fitBounds(geoLayer.getBounds(), { padding: [20, 20] });

    // Stretch color scale to actual data range now that layer is built
    recolorMap();
  } catch (err) {
    console.error('GeoJSON load error:', err);
    setCSVStatus('Error loading district polygons. Check your internet connection.', 'error');
  }
}

init();
