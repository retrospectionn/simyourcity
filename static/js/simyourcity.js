/* SimYourCity - Main Application Script */

const LAT = 37.9601;
const LNG = 58.3261;

const STYLES = {
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  satellite: {
    version: 8, name: 'Satellite', glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf', sources: {
      esri: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 19, attribution: '© Esri' },
      labels: { type: 'vector', url: 'https://demotiles.maplibre.org/tiles/tiles.json', maxzoom: 4 }
    }, layers: [
      { id: 'sat-bg', type: 'raster', source: 'esri' },
      { id: 'sat-labels', type: 'symbol', source: 'labels', 'source-layer': 'countries', minzoom: 0, maxzoom: 4, layout: { 'text-field': '{name}', 'text-font': ['Open Sans Semibold'], 'text-size': 11 }, paint: { 'text-color': '#fff', 'text-halo-color': '#000', 'text-halo-width': 1.2 } }
    ]
  }
};

const SVG_ICONS = {
  fuel: '<svg viewBox="0 0 24 24" fill="none" stroke="#FF6B35" stroke-width="2"><rect x="9" y="2" width="6" height="14" rx="1"/><path d="M5 22h14M5 16h14M3 16v6M21 16v6"/><path d="M15 6l4 2v4l-4 2"/><circle cx="7" cy="11" r="1" fill="#FF6B35"/></svg>',
  police: '<svg viewBox="0 0 24 24" fill="none" stroke="#004E89" stroke-width="2"><path d="M12 2l8 4v6c0 4-8 10-8 10s-8-6-8-10V6l8-4z"/><text x="12" y="15" text-anchor="middle" font-size="9" fill="#004E89" font-weight="bold">P</text></svg>',
  fire_station: '<svg viewBox="0 0 24 24" fill="none" stroke="#E63946" stroke-width="2"><path d="M12 2C8 6 6 10 6 14c0 3.3 2.7 6 6 6s6-2.7 6-6c0-4-2-8-6-12z"/><path d="M12 10v4M10 12h4"/></svg>',
  hospital: '<svg viewBox="0 0 24 24" fill="none" stroke="#D62828" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/><circle cx="20" cy="20" r="3" fill="#D62828" stroke="none"/></svg>',
  school: '<svg viewBox="0 0 24 24" fill="none" stroke="#2A9D8F" stroke-width="2"><path d="M4 19.5v-10l8-5 8 5v10"/><path d="M4 19.5l8-5 8 5"/><path d="M8 15v4h8v-4M12 11v2"/></svg>',
  graveyard: '<svg viewBox="0 0 24 24" fill="none" stroke="#6B705C" stroke-width="2"><rect x="9" y="8" width="6" height="12" rx="1"/><line x1="12" y1="3" x2="12" y2="7"/><path d="M3 20h18"/><line x1="7" y1="14" x2="7" y2="20"/><line x1="17" y1="14" x2="17" y2="20"/></svg>',
  bank: '<svg viewBox="0 0 24 24" fill="none" stroke="#F4A261" stroke-width="2"><path d="M3 10l9-7 9 7"/><rect x="4" y="10" width="16" height="3"/><path d="M6 13v5h12v-5"/><line x1="10" y1="16" x2="10" y2="13"/><line x1="14" y1="16" x2="14" y2="13"/></svg>',
  post_office: '<svg viewBox="0 0 24 24" fill="none" stroke="#264653" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="1"/><path d="M22 6l-10 7L2 6"/></svg>',
  library: '<svg viewBox="0 0 24 24" fill="none" stroke="#1D3557" stroke-width="2"><path d="M4 19.5v-15l8-3 8 3v15"/><path d="M4 19.5l8-3 8 3"/><path d="M12 6.5v10"/><path d="M8 8.5v6"/><path d="M16 8.5v6"/></svg>',
  townhall: '<svg viewBox="0 0 24 24" fill="none" stroke="#457B9D" stroke-width="2"><rect x="4" y="10" width="16" height="10"/><path d="M8 10V6h8v4"/><rect x="11" y="15" width="2" height="5"/><path d="M3 20h18"/><path d="M12 4V2"/></svg>',
  pharmacy: '<svg viewBox="0 0 24 24" fill="none" stroke="#2EC4B6" stroke-width="2"><rect x="6" y="4" width="12" height="16" rx="2"/><line x1="10" y1="8" x2="14" y2="8"/><line x1="12" y1="6" x2="12" y2="10"/><circle cx="12" cy="15" r="2"/></svg>',
  place_of_worship: '<svg viewBox="0 0 24 24" fill="none" stroke="#9B5DE5" stroke-width="2"><path d="M12 2l-6 6v2h12V8l-6-6z"/><rect x="9" y="10" width="6" height="10"/><line x1="7" y1="20" x2="17" y2="20"/><circle cx="12" cy="6" r="1" fill="#9B5DE5"/></svg>',
  restaurant: '<svg viewBox="0 0 24 24" fill="none" stroke="#F15BB5" stroke-width="2"><path d="M18 2v20M6 2v4c0 2.2 1.8 4 4 4M6 22v-8"/><path d="M14 2v4c0 2.2 1.8 4 4 4"/></svg>',
  cafe: '<svg viewBox="0 0 24 24" fill="none" stroke="#FEE440" stroke-width="2"><path d="M18 10H4v6a4 4 0 004 4h6a4 4 0 004-4v-6z"/><path d="M18 8a2 2 0 012 2v2a2 2 0 01-2 2"/><line x1="4" y1="10" x2="18" y2="10"/></svg>',
  parking: '<svg viewBox="0 0 24 24" fill="none" stroke="#00BBF9" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><text x="12" y="16" text-anchor="middle" font-size="12" fill="#00BBF9" font-weight="bold">P</text></svg>',
  construction: '<svg viewBox="0 0 24 24" fill="none" stroke="#FF9800" stroke-width="2"><path d="M6 21V8l7-4v17"/><path d="M13 8h6v13"/><path d="M2 21h20"/><rect x="9" y="12" width="2" height="5" fill="#FF9800" stroke="none"/><circle cx="17" cy="11" r="1" fill="#FF9800" stroke="none"/></svg>',
  bus_stop: '<svg viewBox="0 0 24 24" fill="none" stroke="#FFB300" stroke-width="2"><rect x="3" y="2" width="5" height="6" rx="1"/><path d="M3 2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1"/><rect x="4" y="6" width="16" height="15" rx="1.5"/><path d="M4 12h16"/><path d="M8 15h8"/><circle cx="8" cy="17.5" r="1.2" fill="#FFB300"/><circle cx="16" cy="17.5" r="1.2" fill="#FFB300"/></svg>',
  bench: '<svg viewBox="0 0 24 24" fill="none" stroke="#A1887F" stroke-width="2"><path d="M3 15h18" stroke-width="2.6"/><path d="M6 6h12"/><path d="M6 6L4 15M18 6l2 9M8 6l1 8M16 6l-1 8"/></svg>',
  atm: '<svg viewBox="0 0 24 24" fill="none" stroke="#B0BEC5" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><rect x="6" y="8" width="12" height="2.4" rx="0.5"/><path d="M6 13.5h2.5"/><path d="M15 12.5v5.5"/><circle cx="15" cy="15.5" r="1.6" fill="#B0BEC5"/></svg>',
  post_box: '<svg viewBox="0 0 24 24" fill="none" stroke="#795548" stroke-width="2"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M5 8h14"/><path d="M10 3v5"/><path d="M8 14l2 2 2-2"/><path d="M12 16V4"/></svg>',
  recycling: '<svg viewBox="0 0 24 24" fill="none" stroke="#63A66A" stroke-width="2"><path d="M3 12a9 9 0 0 1 16.5-4.9L21 9"/><path d="M21 12a9 9 0 0 1-16.5 4.9L3 15"/><path d="M19.5 5v4h-4M4.5 19v-4h4"/></svg>',
  toilets: '<svg viewBox="0 0 24 24" fill="none" stroke="#90A4AE" stroke-width="2"><circle cx="8.5" cy="8.5" r="2.4"/><path d="M6 13.5h5v6.5H6z"/><circle cx="16.5" cy="8.5" r="1.7"/><path d="M14.5 13.5h4v6.5h-4z"/></svg>',
  water: '<svg viewBox="0 0 24 24" fill="none" stroke="#26C6DA" stroke-width="2"><path d="M12 2.5c3 3.4 4.5 6 4.5 8a4.5 4.5 0 0 1-9 0c0-2 1.5-4.6 4.5-8z"/><path d="M10.5 12v1.5a1.8 1.8 0 0 0 3.4.3"/></svg>',
  taxi: '<svg viewBox="0 0 24 24" fill="none" stroke="#FDD835" stroke-width="2"><path d="M5.5 11l1.3-4h10.4l1.3 4"/><rect x="3.5" y="11" width="17" height="7" rx="1.5"/><rect x="10.5" y="6" width="3" height="3"/><circle cx="7.5" cy="16.8" r="1.1" fill="#FDD835"/><circle cx="16.5" cy="16.8" r="1.1" fill="#FDD835"/></svg>',
  charging: '<svg viewBox="0 0 24 24" fill="none" stroke="#00E676" stroke-width="2"><path d="M9 2v6M7 2v2"/><rect x="5" y="8" width="7" height="12" rx="1.5"/><rect x="6.5" y="10" width="4" height="2" rx="0.5"/><path d="M14.5 9h2a2 2 0 0 1 2 2v7"/><rect x="14.5" y="9" width="4.5" height="4.5" rx="1"/><path d="M14 17l3-4 3 4"/></svg>',
  car_wash: '<svg viewBox="0 0 24 24" fill="none" stroke="#5C6BC0" stroke-width="2"><path d="M5 15l2-7h10l2 7"/><rect x="3" y="15" width="18" height="6" rx="1.5"/><circle cx="8" cy="15" r="1.2" fill="#5C6BC0"/><circle cx="16" cy="15" r="1.2" fill="#5C6BC0"/><path d="M5 3v3M8 2v3M11 3v3"/></svg>',
  university: '<svg viewBox="0 0 24 24" fill="none" stroke="#9C27B0" stroke-width="2"><path d="M2 9l10-5 10 5-10 5-10-5z"/><path d="M6 11.5v4.5c0 1.7 2.7 3.5 6 3.5s6-1.8 6-3.5v-4.5"/><path d="M22 9v6"/></svg>',
  green_space: '<svg viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2"><path d="M12 2l3.5 5.5h-2.3L16 12h-2.3L16.5 17h-9L10.3 12H8l2.8-4.5H8.5L12 2z"/><rect x="11.2" y="17" width="1.6" height="5"/></svg>'
};

let map, activeSource, isRunning = false, eventSource = null;
let amenityLayers = {}, amenityCounts = {}, consoleCount = 0, zoomPxFactor = 1;
let polygonLayers = {}, polygonCounts = {};
let transitLayers = {}, transitCounts = {}, transitStops = null, isTransitRunning = false;
let selectMode = false;

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
let IS_STATIC = false;

function detectStatic() {
  return fetch('/api/pbf/status', { method: 'GET' })
    .then(r => {
      if (!r.ok) throw new Error('no backend');
      IS_STATIC = false;
      return false;
    })
    .catch(() => { IS_STATIC = true; return true; });
}

function overpassQuery(q) {
  return fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: q
  }).then(r => {
    if (!r.ok) throw new Error('Overpass HTTP ' + r.status);
    return r.json();
  });
}

function buildAmenityOverpass(amenities, bbox) {
  const bboxStr = bbox.join(',');
  const parts = [];
  amenities.forEach(key => {
    const cfg = AMENITY_TYPES[key] || {};
    const tags = cfg.tags || [['amenity', key]];
    tags.forEach(([k, v]) => {
      parts.push(`  node["${k}"="${v}"](${bboxStr});`);
    });
  });
  if (!parts.length) return null;
  return `[out:json][timeout:90];\n(\n${parts.join('\n')}\n);\nout center;`;
}

function buildPolygonOverpass(polyKey, bbox) {
  const cfg = POLYGON_TYPES[polyKey] || {};
  const tags = cfg.tags || [];
  if (!tags.length) return null;
  const bboxStr = bbox.join(',');
  const parts = tags.map(([k, v]) => `  way["${k}"="${v}"](${bboxStr});`);
  return `[out:json][timeout:90];\n(\n${parts.join('\n')}\n);\nout geom;`;
}

function buildTransitOverpass(transitKinds, bbox) {
  if (!transitKinds.length) return null;
  const bboxStr = bbox.join(',');
  const kinds = transitKinds.join('|');
  return `[out:json][timeout:90];\nrelation["type"="route"]["route"~"^(${kinds})$"](${bboxStr});\nout geom;`;
}

function groupOverpassAmenities(elements, amenities) {
  const results = {};
  amenities.forEach(key => { results[key] = { type: 'FeatureCollection', features: [] }; });
  elements.forEach(el => {
    if (el.type !== 'node' || !el.tags) return;
    amenities.forEach(key => {
      const cfg = AMENITY_TYPES[key] || {};
      const tags = cfg.tags || [['amenity', key]];
      if (tags.some(([k, v]) => el.tags[k] === v)) {
        results[key].features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [el.lon, el.lat] },
          properties: { id: el.id, name: el.tags.name || '', amenity: key }
        });
      }
    });
  });
  return results;
}

function polygonOverpassToFeature(elements, polyKey) {
  const features = [];
  const seen = new Set();
  elements.forEach(el => {
    if (el.type !== 'way' || seen.has(el.id) || !el.geometry || el.geometry.length < 3) return;
    seen.add(el.id);
    const coords = el.geometry.map(g => [g.lon, g.lat]);
    features.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [coords] },
      properties: { id: el.id, name: (el.tags || {}).name || '', kind: polyKey }
    });
  });
  return { type: 'FeatureCollection', features };
}

function transitOverpassToFeature(elements, transitKinds) {
  const routes = {};
  const stopFeatures = [];
  elements.forEach(el => {
    if (el.type !== 'relation' || !el.tags) return;
    const kind = el.tags.route;
    if (!transitKinds.includes(kind)) return;
    const lines = [];
    (el.members || []).forEach(m => {
      if (m.type === 'way' && m.geometry && m.geometry.length >= 2) {
        const coords = m.geometry.map(g => [g.lon, g.lat]);
        if (coords.length > 40) {
          const simplified = [];
          for (let i = 0; i < coords.length; i += Math.ceil(coords.length / 40)) simplified.push(coords[i]);
          lines.push(simplified);
        } else {
          lines.push(coords);
        }
      }
    });
    if (!lines.length) return;
    const geometry = lines.length === 1
      ? { type: 'LineString', coordinates: lines[0] }
      : { type: 'MultiLineString', coordinates: lines };
    if (!routes[kind]) routes[kind] = { type: 'FeatureCollection', features: [] };
    routes[kind].features.push({
      type: 'Feature',
      geometry,
      properties: { id: el.id, name: el.tags.name || '', ref: el.tags.ref || '', kind }
    });
    (el.members || []).forEach(m => {
      if (m.type === 'node' && m.geometry && m.geometry[0]) {
        stopFeatures.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [m.geometry[0].lon, m.geometry[0].lat] },
          properties: { name: (m.tags || {}).name || '' }
        });
      }
    });
  });
  return { routes, stops: { type: 'FeatureCollection', features: stopFeatures } };
}
const layerOpacity = 0.25;
const polyFillOpacity = 0.28;

function init() {
  initMap();
  initAmenities();
  initPolygons();
  initTransit();
  initResize();
  initToolbar();
  updateLegend();
  addLog('i', 'SimYourCity initialized — ready');
  detectStatic().then(isStatic => {
    if (isStatic) {
      document.getElementById('dataSource').textContent = 'Source: Overpass API (static)';
      document.getElementById('toolbarFile').textContent = 'Static mode — Overpass API';
      document.getElementById('toolbarRunBtn').disabled = false;
      const dlBtn = document.querySelector('button[onclick="showModal(\'downloadModal\")"]');
      const impBtn = document.querySelector('button[onclick="showModal(\'importModal\")"]');
      if (dlBtn) dlBtn.style.display = 'none';
      if (impBtn) impBtn.style.display = 'none';
      addLog('i', 'Running in static mode (GitHub Pages) — queries go directly to Overpass API');
      addLog('i', 'PBF download/import disabled. Use local server for PBF features.');
    }
  });
  document.getElementById('toggleRadius').addEventListener('change', toggleRadiusVisibility);
  document.getElementById('toggleDissolve').addEventListener('change', () => {
    if (isRunning) return;
    if (Object.keys(amenityLayers).length || Object.keys(polygonLayers).length) {
      runQuery();
    }
  });
}

/* ─── Toolbar / PBF file management ────────────────────────────────────── */

let geofabrikCatalog = {};
let geofabrikBase = '';
let downloadTaskId = null;

function initToolbar() {
  refreshPbfStatus();
  fetch('/api/pbf/geofabrik')
    .then(r => r.json())
    .then(data => {
      geofabrikCatalog = data.catalog || {};
      geofabrikBase = data.base || '';
      populateContinents();
    });
}

function refreshPbfStatus() {
  fetch('/api/pbf/status')
    .then(r => r.json())
    .then(data => {
      const el = document.getElementById('toolbarFile');
      const btn = document.getElementById('toolbarRunBtn');
      const src = document.getElementById('dataSource');
      if (data.active) {
        el.textContent = data.active + ' (' + (data.files.find(f => f.name === data.active)?.size_mb || '?') + ' MB)';
        el.classList.add('loaded');
        btn.disabled = false;
        src.textContent = 'Source: Local PBF';
      } else {
        el.textContent = 'No data loaded';
        el.classList.remove('loaded');
        btn.disabled = true;
        src.textContent = 'Source: Overpass API';
      }
    });
}

function resetView() {
  map.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: 600 });
  clearAllAmenityLayers();
  clearTransitLayers();
}

/* ─── Modal helpers ─────────────────────────────────────────────────────── */

function showModal(id) {
  document.getElementById(id).classList.add('show');
  if (id === 'downloadModal') {
    if (!downloadTaskId) resetDownloadModal();
    populateContinents();
  }
  if (id === 'filesModal') populateFilesList();
}
function hideModal(id) {
  document.getElementById(id).classList.remove('show');
}

/* ─── Download modal ────────────────────────────────────────────────────── */

function populateContinents() {
  const sel = document.getElementById('dlContinent');
  sel.innerHTML = '';
  Object.keys(geofabrikCatalog).sort().forEach(c => {
    const o = document.createElement('option');
    o.value = c; o.textContent = c;
    sel.appendChild(o);
  });
  populateCountries();
}

function populateCountries() {
  const continent = document.getElementById('dlContinent').value;
  const sel = document.getElementById('dlCountry');
  sel.innerHTML = '';
  const countries = geofabrikCatalog[continent] || {};
  Object.keys(countries).sort().forEach(name => {
    const o = document.createElement('option');
    o.value = geofabrikBase + countries[name]; o.textContent = name;
    sel.appendChild(o);
  });
}

function startDownload() {
  const url = document.getElementById('dlCountry').value;
  const btn = document.getElementById('dlBtn');
  const status = document.getElementById('dlStatus');
  const progress = document.getElementById('dlProgress');
  const fill = document.getElementById('dlProgressFill');
  const detail = document.getElementById('dlDetail');
  const form = document.getElementById('dlForm');
  if (!url) return;
  btn.disabled = true;
  status.className = 'modal-status';
  status.textContent = 'Starting download...';
  progress.style.display = 'block';
  fill.style.width = '0%';
  detail.style.display = 'flex';
  document.getElementById('dlSizeText').textContent = '';
  document.getElementById('dlEtaText').textContent = '';

  fetch('/api/pbf/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  }).then(r => r.json()).then(data => {
    if (data.error) { status.className = 'modal-status error'; status.textContent = data.error; btn.disabled = false; return; }
    downloadTaskId = data.task_id;
    form.style.display = 'none';
    pollDownload(data.task_id);
  }).catch(err => {
    status.className = 'modal-status error'; status.textContent = err.message; btn.disabled = false;
  });
}

function minimizeDownload() {
  if (downloadTaskId) {
    hideModal('downloadModal');
    showDlIndicator();
  } else {
    hideModal('downloadModal');
  }
}

function cancelDownload() {
  downloadTaskId = null;
  hideModal('downloadModal');
  hideDlIndicator();
  resetDownloadModal();
}

function resetDownloadModal() {
  const btn = document.getElementById('dlBtn');
  const status = document.getElementById('dlStatus');
  const progress = document.getElementById('dlProgress');
  const fill = document.getElementById('dlProgressFill');
  const detail = document.getElementById('dlDetail');
  const form = document.getElementById('dlForm');
  btn.disabled = false;
  status.textContent = '';
  status.className = 'modal-status';
  progress.style.display = 'none';
  fill.style.width = '0%';
  detail.style.display = 'none';
  form.style.display = '';
}

function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
  return (b / 1073741824).toFixed(2) + ' GB';
}

function formatEta(seconds) {
  if (seconds < 60) return Math.round(seconds) + 's';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ' + Math.round(seconds % 60) + 's';
  return Math.floor(seconds / 3600) + 'h ' + Math.floor((seconds % 3600) / 60) + 'm';
}

function pollDownload(taskId) {
  const status = document.getElementById('dlStatus');
  const fill = document.getElementById('dlProgressFill');
  const btn = document.getElementById('dlBtn');
  const detail = document.getElementById('dlDetail');
  fetch('/api/pbf/download/' + taskId).then(r => r.json()).then(data => {
    if (data.status === 'downloading') {
      const pct = data.progress || 0;
      const bytes = data.bytes || 0;
      const total = data.total || 0;
      const elapsed = data.elapsed || 0;
      fill.style.width = pct + '%';

      let sizeText = formatBytes(bytes);
      if (total > 0) sizeText += ' / ' + formatBytes(total);
      document.getElementById('dlSizeText').textContent = sizeText;

      if (bytes > 0 && total > 0 && elapsed > 1) {
        const rate = bytes / elapsed;
        const remaining = (total - bytes) / rate;
        document.getElementById('dlEtaText').textContent = '~' + formatEta(remaining) + ' left';
      } else {
        document.getElementById('dlEtaText').textContent = '';
      }

      const pctText = pct + '%';
      if (!document.getElementById('downloadModal').classList.contains('show')) {
        updateDlIndicator(pct, sizeText);
      } else {
        status.textContent = 'Downloading... ' + pctText;
      }
      setTimeout(() => pollDownload(taskId), 500);
    } else if (data.status === 'done') {
      status.className = 'modal-status ok'; status.textContent = 'Downloaded ' + data.filename + '!';
      fill.style.width = '100%';
      document.getElementById('dlSizeText').textContent = formatBytes(data.total || 0);
      document.getElementById('dlEtaText').textContent = 'Complete';
      btn.disabled = false;
      hideDlIndicator();
      refreshPbfStatus();
      setTimeout(resetDownloadModal, 2000);
    } else if (data.status === 'error') {
      status.className = 'modal-status error'; status.textContent = data.error || 'Download failed';
      btn.disabled = false;
      hideDlIndicator();
      resetDownloadModal();
    }
  });
}

function showDlIndicator() {
  document.getElementById('dlIndicator').style.display = 'flex';
}
function hideDlIndicator() {
  document.getElementById('dlIndicator').style.display = 'none';
}
function updateDlIndicator(pct, sizeText) {
  document.getElementById('dlIndicatorFill').style.width = pct + '%';
  document.getElementById('dlIndicatorText').textContent = pct + '% ' + sizeText;
}

/* ─── Import modal ──────────────────────────────────────────────────────── */

function startImport() {
  const path = document.getElementById('importPath').value.trim();
  const status = document.getElementById('importStatus');
  const btn = document.getElementById('importBtn');
  if (!path) { status.className = 'modal-status error'; status.textContent = 'Enter a file path'; return; }
  btn.disabled = true;
  status.className = 'modal-status';
  status.textContent = 'Importing...';

  fetch('/api/pbf/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path })
  }).then(r => r.json()).then(data => {
    if (data.error) { status.className = 'modal-status error'; status.textContent = data.error; btn.disabled = false; return; }
    status.className = 'modal-status ok'; status.textContent = 'Imported ' + data.active;
    btn.disabled = false;
    refreshPbfStatus();
    setTimeout(() => hideModal('importModal'), 1200);
  }).catch(err => {
    status.className = 'modal-status error'; status.textContent = err.message; btn.disabled = false;
  });
}

/* ─── Files modal ───────────────────────────────────────────────────────── */

function populateFilesList() {
  const list = document.getElementById('filesList');
  const status = document.getElementById('filesStatus');
  list.innerHTML = '';
  status.textContent = 'Loading...';
  fetch('/api/pbf/status').then(r => r.json()).then(data => {
    status.textContent = '';
    if (!data.files.length) { status.textContent = 'No PBF files found. Download or import one first.'; return; }
    data.files.forEach(f => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid #1a2a3a';
      const isActive = f.name === data.active;
      row.innerHTML =
        '<span style="flex:1;font-size:12px;color:' + (isActive ? '#4caf50' : '#c8d8e8') + '">' +
        (isActive ? '● ' : '○ ') + f.name + '</span>' +
        '<span style="font-size:10px;color:#5a7a95">' + f.size_mb + ' MB</span>' +
        (!isActive
          ? '<button class="mbtn primary" style="padding:4px 10px;font-size:10px" onclick="selectPbf(\'' + f.name + '\')">Use</button>'
          : '<span style="font-size:10px;color:#4caf50">Active</span>') +
        '<button class="mbtn danger" style="padding:4px 8px;font-size:10px" onclick="deletePbf(\'' + f.name + '\')">✕</button>';
      list.appendChild(row);
    });
  });
}

function selectPbf(filename) {
  fetch('/api/pbf/select', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename })
  }).then(r => r.json()).then(data => {
    if (data.error) return;
    refreshPbfStatus();
    populateFilesList();
  });
}

function deletePbf(filename) {
  if (!confirm('Delete ' + filename + '?')) return;
  fetch('/api/pbf/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename })
  }).then(r => r.json()).then(() => { refreshPbfStatus(); populateFilesList(); });
}

function initResize() {
  const sb = document.getElementById('sidebar');
  const cp = document.querySelector('.console-panel');
  const sbHandle = document.getElementById('sidebarResize');
  const cpH = document.getElementById('consoleHeader');

  const savedW = parseInt(localStorage.getItem('syc_sidebar_w'));
  if (savedW && !sb.classList.contains('hidden')) sb.style.width = savedW + 'px';
  const savedH = parseInt(localStorage.getItem('syc_console_h'));
  if (savedH && !cp.classList.contains('hidden')) cp.style.height = savedH + 'px';

  let raf = null;
  function scheduleResize() {
    if (!raf) raf = requestAnimationFrame(() => { raf = null; map.resize(); });
  }

  function drag(handle, axis, apply) {
    handle.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const parent = handle.parentElement;
      const startX = e.clientX, startY = e.clientY;
      const startW = parent.offsetWidth, startH = parent.offsetHeight;
      parent.style.transition = 'none';
      document.body.style.userSelect = 'none';
      document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize';

      function move(ev) {
        const dx = ev.clientX - startX, dy = ev.clientY - startY;
        if (axis === 'x') apply(startW + dx);
        else apply(startH - dy);
        scheduleResize();
      }
      function up() {
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
        parent.style.transition = '';
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        map.resize();
      }
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
  }

  drag(sbHandle, 'x', (w) => {
    w = Math.min(500, Math.max(160, Math.round(w)));
    sb.style.width = w + 'px';
    localStorage.setItem('syc_sidebar_w', w);
  });
  drag(cpH, 'y', (h) => {
    h = Math.min(560, Math.max(60, Math.round(h)));
    cp.style.height = h + 'px';
    localStorage.setItem('syc_console_h', h);
  });

  const trPanel = document.getElementById('transitPanel');
  drag(document.getElementById('transitResize'), 'x', (w) => {
    w = Math.min(340, Math.max(150, Math.round(w)));
    if (trPanel) {
      trPanel.style.width = w + 'px';
      localStorage.setItem('syc_transit_w', w);
    }
  });
}

function initMap() {
  map = new maplibregl.Map({
    container: 'map',
    style: STYLES.dark,
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
    pitch: 0,
    bearing: 0,
    antialias: true,
    fadeDuration: 0,
    attributionControl: true,
    minZoom: 3,
    maxZoom: 19,
    dragRotate: false,
    touchPitch: false,
    renderWorldCopies: false
  });

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-right');

  map.on('load', () => {
    updateZoomFactor();
  });

  map.on('zoom', updateZoomFactor);
  map.on('mousemove', (e) => {
    document.getElementById('coordDisplay').textContent =
      e.lngLat.lat.toFixed(4) + ', ' + e.lngLat.lng.toFixed(4);
  });

  map.on('click', (e) => {
    const layers = [
      ...Object.keys(amenityLayers).map(k => 'points-' + k),
      ...Object.keys(polygonLayers).map(k => 'polyfill-' + k),
      ...Object.keys(transitLayers).map(k => 'tr-' + k)
    ];
    const feats = map.queryRenderedFeatures(e.point, { layers });
    if (feats.length) {
      const f = feats[0];
      const p = f.properties;
      let html, lngLat;
      if (f.geometry.type === 'Polygon') {
        const cfg = POLYGON_TYPES[p.kind] || {};
        html = `<strong>${escHtml(p.name || '(unnamed)')}</strong><br>Type: ${escHtml(cfg.label || p.kind)}<br>Area: polygon`;
        lngLat = f.geometry.coordinates[0][0];
      } else if (f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString') {
        const cfg = TRANSIT_TYPES[p.kind] || {};
        const name = escHtml(p.name || p.ref || '(unnamed route)');
        html = `<strong>${name}</strong><br>${escHtml(cfg.label || p.kind)}${p.ref ? ' · ' + escHtml(p.ref) : ''}`;
        const coords = f.geometry.type === 'LineString' ? f.geometry.coordinates : f.geometry.coordinates[0];
        lngLat = coords[Math.min(20, coords.length - 1)];
      } else {
        html = `<strong>${escHtml(p.name || '(unnamed)')}</strong><br>Type: ${escHtml(p.amenity || 'poi')}<br>(${f.geometry.coordinates[1].toFixed(5)}, ${f.geometry.coordinates[0].toFixed(5)})`;
        lngLat = f.geometry.coordinates;
      }
      new maplibregl.Popup({ offset: 12, closeButton: true })
        .setLngLat(lngLat)
        .setHTML(html)
        .addTo(map);
    }
  });
}

function updateZoomFactor() {
  const z = map.getZoom();
  zoomPxFactor = Math.pow(2, z) / (156543.03 * Math.cos(LAT * Math.PI / 180));
}

function getRadiusPixels(radiusMeters) {
  return radiusMeters * zoomPxFactor;
}

function switchLayer(name) {
  document.querySelectorAll('.layer-btn').forEach(b => b.classList.toggle('active', b.dataset.layer === name));

  const style = STYLES[name];
  if (!style) return;

  if (typeof style === 'string') {
    const current = map.getStyle();
    if (current && current.name === 'Satellite') {
      map.setStyle(style, { diff: false });
    } else {
      map.setStyle(style, { diff: true });
    }
  } else {
    map.setStyle(style, { diff: false });
  }

  map.once('style.load', () => {
    map.setPitch(0);
    map.setBearing(0);
    rebuildLayers();
  });
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const btn = document.getElementById('btnSidebar');
  sb.classList.toggle('hidden');
  btn.classList.toggle('active', !sb.classList.contains('hidden'));
  setTimeout(() => map.resize(), 260);
}

function toggleConsole() {
  const cp = document.querySelector('.console-panel');
  const btn = document.getElementById('btnConsole');
  const hiding = !cp.classList.contains('hidden');
  if (hiding) {
    cp.classList.add('hidden');
    cp.style.height = '';
  } else {
    cp.classList.remove('hidden');
    const savedH = parseInt(localStorage.getItem('syc_console_h'));
    if (savedH) cp.style.height = savedH + 'px';
  }
  btn.classList.toggle('active', !hiding);
  setTimeout(() => map.resize(), 300);
}

function toggleMode() {
  selectMode = !selectMode;
  const btn = document.getElementById('btnMode');
  if (selectMode) {
    btn.textContent = 'Select';
    btn.classList.add('active');
    map.getCanvas().style.cursor = 'crosshair';
    map.dragPan.disable();
    map.scrollZoom.disable();
  } else {
    btn.textContent = 'Pan';
    btn.classList.remove('active');
    map.getCanvas().style.cursor = '';
    map.dragPan.enable();
    map.scrollZoom.enable();
  }
}

function rebuildLayers() {
  for (const [k, v] of Object.entries(amenityLayers)) {
    try {
      if (!map.getSource('points-' + k)) {
        map.addSource('points-' + k, { type: 'geojson', data: v.fc });
      }
      if (!map.getSource('radius-' + k)) {
        map.addSource('radius-' + k, { type: 'geojson', data: v.fc });
      }
      if (v.dissolvedGeom && !map.getSource('dissolved-' + k)) {
        map.addSource('dissolved-' + k, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: v.dissolvedGeom, properties: {} }] }
        });
      }
    } catch (e) {}
    addLayerToMap(k, v.color, v.radius, v.dissolvedGeom);
  }
  for (const k of Object.keys(polygonLayers)) {
    ensurePolygonLayer(k);
  }
  for (const [k, v] of Object.entries(transitLayers)) {
    try {
      if (!map.getSource('tr-' + k)) {
        map.addSource('tr-' + k, { type: 'geojson', data: v.fc });
      }
    } catch (e) {}
    if (!map.getLayer('tr-casing-' + k)) {
      try {
        map.addLayer({
          id: 'tr-casing-' + k, source: 'tr-' + k, type: 'line',
          paint: { 'line-color': '#000', 'line-opacity': 0.35, 'line-width': 5, 'line-blur': 2 }
        });
      } catch (e) {}
    }
    if (!map.getLayer('tr-' + k)) {
      try {
        map.addLayer({
          id: 'tr-' + k, source: 'tr-' + k, type: 'line',
          paint: { 'line-color': v.color, 'line-opacity': 0.9, 'line-width': 2.8 }
        });
      } catch (e) {}
    }
  }
  if (transitStops && !map.getSource('tr-stops')) {
    try {
      map.addSource('tr-stops', { type: 'geojson', data: transitStops });
      map.addLayer({
        id: 'tr-stops', source: 'tr-stops', type: 'circle',
        layout: { visibility: document.getElementById('chkTransitStops').checked ? 'visible' : 'none' },
        paint: { 'circle-radius': 3.2, 'circle-color': '#fff', 'circle-stroke-width': 1.5, 'circle-stroke-color': '#111' }
      });
    } catch (e) {}
  }
}

const SVG_TOGGLE_ON = '<svg viewBox="0 0 16 16" style="width:12px;height:12px;vertical-align:middle"><circle cx="8" cy="8" r="6" fill="none" stroke="#4a6a85" stroke-width="1.5"/><circle cx="8" cy="8" r="3" fill="#4fc3f7"/></svg>';
const SVG_TOGGLE_OFF = '<svg viewBox="0 0 16 16" style="width:12px;height:12px;vertical-align:middle"><circle cx="8" cy="8" r="6" fill="none" stroke="#4a6a85" stroke-width="1.5"/></svg>';

function initAmenities() {
  const el = document.getElementById('amenityList');
  el.innerHTML = '';
  Object.entries(AMENITY_TYPES).forEach(([key, cfg]) => {
    const item = document.createElement('div');
    item.className = 'amenity-item';
    item.style.setProperty('--acolor', cfg.color);
    item.dataset.amenity = key;
    item.innerHTML = `
      <input type="checkbox" id="chk-${key}" data-amenity="${key}" onchange="onCheckChange(this)">
      <span class="aicon">${SVG_ICONS[key] || ''}</span>
      <span class="alabel">${cfg.label}</span>
      <span class="acount" id="cnt-${key}"></span>
    `;
    el.appendChild(item);
    amenityCounts[key] = 0;
  });
}

function onCheckChange(el) {
  const item = el.closest('.amenity-item');
  item.classList.toggle('checked', el.checked);
  updateLegend();
}

function initPolygons() {
  const el = document.getElementById('polygonList');
  el.innerHTML = '';
  Object.entries(POLYGON_TYPES).forEach(([key, cfg]) => {
    const item = document.createElement('div');
    item.className = 'amenity-item';
    item.style.setProperty('--acolor', cfg.color);
    item.dataset.polygon = key;
    item.innerHTML = `
      <input type="checkbox" id="chkp-${key}" data-polygon="${key}" onchange="onCheckChange(this)">
      <span class="aicon">${SVG_ICONS[key] || ''}</span>
      <span class="alabel">${cfg.label}</span>
      <span class="acount" id="pcnt-${key}"></span>
    `;
    el.appendChild(item);
    polygonCounts[key] = 0;
  });
}

function getSelectedPolygons() {
  return Array.from(document.querySelectorAll('#polygonList input[type=checkbox]:checked'))
    .map(c => c.dataset.polygon);
}

function toggleAllChecks() {
  const all = document.querySelectorAll('#amenityList input[type=checkbox]');
  const anyUnchecked = Array.from(all).some(c => !c.checked);
  all.forEach(c => { c.checked = anyUnchecked; onCheckChange(c); });
}

function getSelectedAmenities() {
  return Array.from(document.querySelectorAll('#amenityList input[type=checkbox]:checked'))
    .map(c => c.dataset.amenity);
}

function getBbox() {
  const b = map.getBounds();
  return [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()];
}

function runQuery() {
  if (isRunning) return;
  const amenities = getSelectedAmenities();
  const polygons = getSelectedPolygons();
  if (!amenities.length && !polygons.length) {
    addLog('w', 'Select at least one amenity type or polygon layer.');
    return;
  }

  const bbox = getBbox();
  const radiusVal = parseInt(document.getElementById('radiusInput').value) || 500;

  clearAllAmenityLayers();
  document.getElementById('consoleBody').innerHTML = '';
  document.getElementById('progressFill').style.width = '0%';
  amenityCounts = {};
  amenities.forEach(a => { amenityCounts[a] = 0; document.getElementById('cnt-' + a).textContent = ''; });
  polygonCounts = {};
  polygons.forEach(p => { polygonCounts[p] = 0; document.getElementById('pcnt-' + p).textContent = ''; });
  updateLegend();
  consoleCount = 0;

  isRunning = true;
  const btn = document.getElementById('runBtn');
  btn.disabled = true;
  btn.classList.add('running');
  btn.innerHTML = '⏳ Running...';

  if (eventSource) { eventSource.close(); }

  addLog('i', `SimYourCity v1.0 — Starting query for ${amenities.length} point + ${polygons.length} polygon type(s)`);
  addLog('i', `BBox: ${bbox.map(v => v.toFixed(4)).join(', ')}`);
  addLog('i', 'Connecting to data source...');

  const radii = {};
  amenities.forEach(a => { radii[a] = radiusVal; });
  const doDissolve = document.getElementById('toggleDissolve').checked;

  if (doDissolve) addLog('i', 'Dissolve mode ON — merging overlapping rings');

  if (IS_STATIC) {
    runStaticQuery(amenities, polygons, bbox, radii, doDissolve, btn);
    return;
  }

  fetch('/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amenities, polygons, bbox, radius: radii, dissolve: doDissolve })
  }).then(resp => {
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    function read() {
      reader.read().then(({ done, value }) => {
        if (done) {
          isRunning = false;
          btn.disabled = false;
          btn.classList.remove('running');
          btn.innerHTML = '▶ Run Query';
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop();
        parts.forEach(part => {
          if (!part.trim()) return;
          parseSSE(part);
        });
        read();
      });
    }
    read();
  }).catch(err => {
    addLog('e', 'Connection error: ' + err.message);
    isRunning = false;
    btn.disabled = false;
    btn.classList.remove('running');
    btn.innerHTML = '▶ Run Query';
  });
}

function runStaticQuery(amenities, polygons, bbox, radii, doDissolve, btn) {
  addLog('i', 'Static mode — querying Overpass API directly from browser');
  const promises = [];

  if (amenities.length) {
    const q = buildAmenityOverpass(amenities, bbox);
    if (q) {
      addLog('q', 'Overpass: ' + amenities.length + ' amenity type(s)');
      promises.push(
        overpassQuery(q).then(data => {
          const grouped = groupOverpassAmenities(data.elements || [], amenities);
          amenities.forEach(key => {
            const fc = grouped[key] || { type: 'FeatureCollection', features: [] };
            const cfg = AMENITY_TYPES[key] || {};
            const count = fc.features.length;
            amenityCounts[key] = count;
            document.getElementById('cnt-' + key).textContent = count;
            addLog('s', `Found ${count} ${cfg.label || key}`);
            if (count > 0) {
              let dissolved = null;
              if (doDissolve) dissolved = dissolveCirclesJS(fc, radii[key] || cfg.radius || 500);
              addAmenityLayer(key, fc, cfg.color, radii[key] || cfg.radius || 500, dissolved);
            }
          });
          updateLegend();
        }).catch(e => addLog('e', 'Amenity query failed: ' + e.message))
      );
    }
  }

  polygons.forEach(polyKey => {
    const q = buildPolygonOverpass(polyKey, bbox);
    if (!q) return;
    const cfg = POLYGON_TYPES[polyKey] || {};
    addLog('q', 'Overpass: ' + (cfg.label || polyKey));
    promises.push(
      overpassQuery(q).then(data => {
        const fc = polygonOverpassToFeature(data.elements || [], polyKey);
        polygonCounts[polyKey] = fc.features.length;
        const el = document.getElementById('pcnt-' + polyKey);
        if (el) el.textContent = fc.features.length;
        addLog('s', `Found ${fc.features.length} ${(cfg.label || polyKey)}`);
        if (fc.features.length > 0) {
          addPolygonLayer(polyKey, fc, cfg.color, cfg.label || polyKey, fc.features.length);
        }
        updateLegend();
      }).catch(e => addLog('e', 'Polygon query failed: ' + e.message))
    );
  });

  document.getElementById('progressFill').style.width = '50%';

  Promise.all(promises).then(() => {
    document.getElementById('progressFill').style.width = '100%';
    isRunning = false;
    btn.disabled = false;
    btn.classList.remove('running');
    btn.innerHTML = '▶ Run Query';
    addLog('s', 'All queries complete');
    updateLegend();
  });
}

function dissolveCirclesJS(fc, radiusMeters) {
  const degPerMeterLat = 1 / 111320;
  const lat = fc.features[0] ? fc.features[0].geometry.coordinates[1] : 33;
  const degPerMeterLon = 1 / (111320 * Math.cos(lat * Math.PI / 180));
  const rLat = radiusMeters * degPerMeterLat;
  const rLon = radiusMeters * degPerMeterLon;
  const circles = fc.features.map(f => {
    const [cx, cy] = f.geometry.coordinates;
    const pts = [];
    for (let a = 0; a < 32; a++) {
      const t = (a / 32) * 2 * Math.PI;
      pts.push([cx + rLon * Math.cos(t), cy + rLat * Math.sin(t)]);
    }
    pts.push(pts[0]);
    return pts;
  });
  if (!circles.length) return null;
  if (circles.length === 1) return { type: 'Polygon', coordinates: circles };
  try {
    if (typeof turf !== 'undefined') {
      const polys = circles.map(c => turf.polygon([c]));
      let merged = polys[0];
      for (let i = 1; i < polys.length; i++) merged = turf.union(merged, polys[i]);
      return merged.geometry;
    }
  } catch (e) {}
  return { type: 'MultiPolygon', coordinates: circles.map(c => [c]) };
}

function parseSSE(chunk) {
  const lines = chunk.split('\n');
  let eventType = 'message', dataStr = '';
  lines.forEach(l => {
    if (l.startsWith('event: ')) eventType = l.slice(7);
    else if (l.startsWith('data: ')) dataStr = l.slice(6);
  });
  if (!dataStr) return;

  let data;
  try { data = JSON.parse(dataStr); } catch (e) { return; }

  switch (eventType) {
    case 'log':
      addLog(data.level[0], data.message);
      break;
    case 'progress':
      document.getElementById('progressFill').style.width = Math.min(data.percent, 100) + '%';
      break;
    case 'result':
      if (data.amenity && data.geojson) {
        if (!data.dissolved && document.getElementById('toggleDissolve').checked) {
          console.warn('[dissolve]', data.amenity, 'dissolve ON but no dissolved geometry in SSE');
        }
        addAmenityLayer(data.amenity, data.geojson, data.color, data.radius || 500, data.dissolved || null);
      }
      break;
    case 'polygon_result':
      if (data.key && data.geojson) {
        addPolygonLayer(data.key, data.geojson, data.color, data.label || data.key, data.count || 0);
      }
      break;
    case 'query':
      if (data.batch && data.amenities) {
        addLog('q', `BATCH QUERY: ${data.amenities.join(', ')} (${data.amenities.length} types)`);
      } else if (data.amenity) {
        addLog('q', `QUERY: node["amenity"="${data.amenity}"]`);
      }
      if (data.polygons && data.polygons.length) {
        addLog('q', `POLYGON QUERY: ways(${data.polygons.join(', ')})`);
      }
      if (data.transit && data.transit.length) {
        addLog('q', `TRANSIT QUERY: relations route=(${data.transit.join(', ')})`);
      }
      break;
    case 'transit_routes':
      if (data.type && data.geojson) {
        addTransitLayer(data.type, data.geojson, data.color, data.label || data.type, data.count || 0);
      }
      break;
    case 'transit_stops':
      if (data.geojson) {
        setTransitStops(data.geojson, data.count || 0);
      }
      break;
    case 'transit_done':
      addLog('s', data.message || 'Transit done!');
      isTransitRunning = false;
      const tBtn = document.getElementById('transitRunBtn');
      if (tBtn) {
        tBtn.disabled = false;
        tBtn.classList.remove('running');
        tBtn.innerHTML = '▶ Query Transit';
      }
      const tStatus = document.getElementById('transitStatus');
      if (tStatus) {
        const stops = data.stops || 0;
        tStatus.textContent = `${data.total || 0} routes${stops ? ' · ' + stops + ' stops' : ''}`;
      }
      break;
    case 'done':
      addLog('s', data.message || 'Done!');
      const total = Object.values(amenityCounts).reduce((a, b) => a + b, 0);
      const polyTotal = Object.values(polygonCounts).reduce((a, b) => a + b, 0);
      addLog('i', `Total on map: ${total} POIs + ${polyTotal} polygon areas`);
      updateConsoleStats(total + polyTotal);
      isRunning = false;
      document.getElementById('runBtn').disabled = false;
      document.getElementById('runBtn').classList.remove('running');
      document.getElementById('runBtn').innerHTML = '▶ Run Query';
      break;
    case 'error':
      addLog('e', data.message || 'Unknown error');
      break;
    case 'config':
      break;
  }
}

function addLog(level, msg) {
  const body = document.getElementById('consoleBody');
  const time = new Date().toLocaleTimeString();
  const levelMap = { i: 'INFO', s: 'OK', w: 'WARN', e: 'ERR', q: 'EXEC' };
  const levelClass = { i: 'level-i', s: 'level-s', w: 'level-w', e: 'level-e', q: 'level-q' };
  const div = document.createElement('div');
  div.className = 'clog';
  div.innerHTML = `<span class="ts">[${time}]</span><span class="level ${levelClass[level] || 'level-i'}">${levelMap[level] || 'INFO'}</span>${escHtml(msg)}`;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
  consoleCount++;
  const total = Object.values(amenityCounts).reduce((a, b) => a + b, 0);
  const polyTotal = Object.values(polygonCounts).reduce((a, b) => a + b, 0);
  document.getElementById('consoleStats').textContent = `${consoleCount} lines · ${total + polyTotal} features`;
}

function updateConsoleStats(total) {
  document.getElementById('consoleStats').textContent = `${consoleCount} lines · ${total || 0} features · Ready`;
}

function clearAllAmenityLayers() {
  Object.keys(amenityLayers).forEach(key => removeAmenityLayer(key));
  Object.keys(polygonLayers).forEach(key => removePolygonLayer(key));
  amenityLayers = {};
  polygonLayers = {};
  document.getElementById('legendItems').innerHTML = '';
  document.getElementById('legendWrap').classList.remove('show');
}

function removeAmenityLayer(key) {
  const layers = [`points-${key}`, `radius-${key}`, `dissolved-${key}`];
  layers.forEach(l => { if (map.getLayer(l)) map.removeLayer(l); });
  ['points-' + key, 'radius-' + key, 'dissolved-' + key].forEach(s => { if (map.getSource(s)) map.removeSource(s); });
  delete amenityLayers[key];
}

function addAmenityLayer(amenity, geojson, color, radiusMeters, dissolvedGeom) {
  if (!geojson || !geojson.features || !geojson.features.length) return;

  const key = amenity;
  if (amenityLayers[key]) removeAmenityLayer(key);

  const features = geojson.features;
  amenityCounts[key] = features.length;
  document.getElementById('cnt-' + key).textContent = features.length;

  const geo0 = { type: 'FeatureCollection', features };

  amenityLayers[key] = { color, radius: radiusMeters, count: features.length, dissolved: !!dissolvedGeom, dissolvedGeom, fc: geo0 };

  try {
    map.addSource('points-' + key, { type: 'geojson', data: geo0 });
    map.addSource('radius-' + key, { type: 'geojson', data: geo0 });
    if (dissolvedGeom) {
      map.addSource('dissolved-' + key, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: dissolvedGeom, properties: {} }] }
      });
    }
  } catch (e) { return; }

  addLayerToMap(key, color, radiusMeters, dissolvedGeom);

  updateLegend();
}

function addLayerToMap(key, color, radiusMeters, dissolvedGeom) {
  if (map.getLayer('points-' + key)) return;

  const layersToAdd = [];
  const showRadius = document.getElementById('toggleRadius').checked;

  if (dissolvedGeom) {
    // Dissolved mode — single merged polygon instead of N circles.
    // Layer always exists; the Rings toggle controls visibility live.
    layersToAdd.push({
      id: 'dissolved-' + key,
      source: 'dissolved-' + key,
      type: 'fill',
      layout: { visibility: showRadius ? 'visible' : 'none' },
      paint: {
        'fill-color': color,
        'fill-opacity': layerOpacity,
        'fill-outline-color': color + '80'
      }
    });
  } else if (showRadius) {
    // Classic mode — individual radius circles
    layersToAdd.push({
      id: 'radius-' + key,
      source: 'radius-' + key,
      type: 'circle',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'],
          10, radiusMeters * 0.008,
          12, radiusMeters * 0.032,
          14, radiusMeters * 0.126,
          16, radiusMeters * 0.5,
          18, radiusMeters * 2.0
        ],
        'circle-color': color,
        'circle-opacity': layerOpacity,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': color,
        'circle-stroke-opacity': 0.5
      }
    });
  }

  layersToAdd.push({
    id: 'points-' + key,
    source: 'points-' + key,
    type: 'circle',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3.5, 14, 5.5, 18, 9],
      'circle-color': color,
      'circle-opacity': 1,
      'circle-stroke-width': 0
    }
  });

  layersToAdd.forEach(l => {
    if (!map.getLayer(l.id)) {
      try { map.addLayer(l); } catch (e) { /* layer exists */ }
    }
  });
}

function removePolygonLayer(key) {
  ['polyfill-' + key, 'polyline-' + key].forEach(l => { if (map.getLayer(l)) map.removeLayer(l); });
  if (map.getSource('poly-' + key)) map.removeSource('poly-' + key);
  delete polygonLayers[key];
}

function addPolygonLayer(key, geojson, color, label, count) {
  if (!geojson || !geojson.features || !geojson.features.length) return;

  if (polygonLayers[key]) removePolygonLayer(key);

  polygonLayers[key] = { color, label, count, fc: geojson };
  polygonCounts[key] = count;
  document.getElementById('pcnt-' + key).textContent = count;

  ensurePolygonLayer(key);
  updateLegend();
}

function ensurePolygonLayer(key) {
  const info = polygonLayers[key];
  if (!info || map.getLayer('polyfill-' + key)) return;

  try {
    if (!map.getSource('poly-' + key)) {
      map.addSource('poly-' + key, { type: 'geojson', data: info.fc });
    }
    if (!map.getLayer('polyfill-' + key)) {
      map.addLayer({
        id: 'polyfill-' + key,
        source: 'poly-' + key,
        type: 'fill',
        paint: {
          'fill-color': info.color,
          'fill-opacity': polyFillOpacity
        }
      });
    }
    if (!map.getLayer('polyline-' + key)) {
      map.addLayer({
        id: 'polyline-' + key,
        source: 'poly-' + key,
        type: 'line',
        paint: {
          'line-color': info.color,
          'line-width': 1.2,
          'line-opacity': 0.7
        }
      });
    }
  } catch (e) {}
}

function toggleRadiusVisibility() {
  const show = document.getElementById('toggleRadius').checked;
  Object.keys(amenityLayers).forEach(key => {
    const info = amenityLayers[key];
    if (info.dissolved) {
      const dl = 'dissolved-' + key;
      if (map.getLayer(dl)) map.setLayoutProperty(dl, 'visibility', show ? 'visible' : 'none');
    } else {
      const rl = 'radius-' + key;
      if (map.getLayer(rl)) {
        map.setLayoutProperty(rl, 'visibility', show ? 'visible' : 'none');
      } else if (show && info) {
        try {
          const src = map.getSource(rl);
          if (src) {
            map.addLayer({
              id: rl, source: rl, type: 'circle',
              paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'],
                  10, info.radius * 0.008, 12, info.radius * 0.032,
                  14, info.radius * 0.126, 16, info.radius * 0.5, 18, info.radius * 2.0],
                'circle-color': info.color,
                'circle-opacity': layerOpacity,
                'circle-stroke-width': 1.5,
                'circle-stroke-color': info.color,
                'circle-stroke-opacity': 0.5
              }
            });
          }
        } catch (e) {}
      }
    }
  });
}

function initTransit() {
  const el = document.getElementById('transitList');
  if (!el) return;
  el.innerHTML = '';
  Object.entries(TRANSIT_TYPES).forEach(([key, cfg]) => {
    const item = document.createElement('div');
    item.className = 'amenity-item';
    item.style.setProperty('--acolor', cfg.color);
    item.dataset.transit = key;
    item.innerHTML = `
      <input type="checkbox" id="chkt-${key}" data-transit="${key}" onchange="onTransitCheck(this)">
      <span class="aicon"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="${cfg.color}" stroke-width="2"><path d="M4 13h16M4 13l1.2-7.5h13.6L20 13"/><path d="M7 13v5h10v-5"/><circle cx="8" cy="18" r="1" fill="${cfg.color}"/><circle cx="16" cy="18" r="1" fill="${cfg.color}"/><rect x="8" y="6.5" width="8" height="2" rx="1" fill="${cfg.color}"/></svg></span>
      <span class="alabel">${cfg.label}</span>
      <span class="acount" id="tcnt-${key}"></span>
    `;
    el.appendChild(item);
    transitCounts[key] = 0;
  });
  el.querySelectorAll('input[type=checkbox]').forEach(c => {
    c.checked = true;
    c.closest('.amenity-item').classList.add('checked');
  });

  const panel = document.getElementById('transitPanel');
  const savedW = parseInt(localStorage.getItem('syc_transit_w'));
  if (savedW && panel) panel.style.width = savedW + 'px';
  if (localStorage.getItem('syc_transit_collapsed') === '1') collapseTransit();
}

function toggleTransitPanel() {
  const p = document.getElementById('transitPanel');
  const btn = document.getElementById('btnTransit');
  p.classList.toggle('hidden');
  btn.classList.toggle('active', !p.classList.contains('hidden'));
}

function collapseTransit() {
  const p = document.getElementById('transitPanel');
  const chev = document.getElementById('transitCollapse');
  const collapsed = p.classList.toggle('collapsed');
  chev.textContent = collapsed ? '▸' : '▾';
  localStorage.setItem('syc_transit_collapsed', collapsed ? '1' : '0');
}

function getSelectedTransit() {
  return Array.from(document.querySelectorAll('#transitList input[type=checkbox]:checked'))
    .map(c => c.dataset.transit);
}

function onTransitCheck(el) {
  const item = el.closest('.amenity-item');
  item.classList.toggle('checked', el.checked);
  updateLegend();
  if (Object.keys(transitLayers).length && !isTransitRunning) runTransitQuery();
}

function onStopsChange() {
  const show = document.getElementById('chkTransitStops').checked;
  if (map && map.getLayer('tr-stops')) {
    map.setLayoutProperty('tr-stops', 'visibility', show ? 'visible' : 'none');
  }
}

function runTransitQuery() {
  if (isTransitRunning) return;
  const types = getSelectedTransit();
  if (!types.length) {
    addLog('w', 'Select at least one transit route type.');
    return;
  }
  const bbox = getBbox();
  const stops = document.getElementById('chkTransitStops').checked;

  clearTransitLayers();
  transitCounts = {};
  types.forEach(t => {
    transitCounts[t] = 0;
    document.getElementById('tcnt-' + t).textContent = '';
  });
  updateLegend();

  isTransitRunning = true;
  const btn = document.getElementById('transitRunBtn');
  btn.disabled = true;
  btn.classList.add('running');
  btn.innerHTML = '⏳ Running...';
  document.getElementById('transitStatus').textContent = 'Querying...';
  addLog('i', `Starting transit query for ${types.length} route type(s)`);

  if (IS_STATIC) {
    runStaticTransit(types, bbox, stops, btn);
    return;
  }

  fetch('/api/transit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ types, bbox, stops })
  }).then(resp => {
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    function read() {
      reader.read().then(({ done, value }) => {
        if (done) {
          isTransitRunning = false;
          btn.disabled = false;
          btn.classList.remove('running');
          btn.innerHTML = '▶ Query Transit';
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop();
        parts.forEach(part => { if (part.trim()) parseSSE(part); });
        read();
      });
    }
    read();
  }).catch(err => {
    addLog('e', 'Transit connection error: ' + err.message);
    isTransitRunning = false;
    btn.disabled = false;
    btn.classList.remove('running');
    btn.innerHTML = '▶ Query Transit';
    document.getElementById('transitStatus').textContent = 'Error';
  });
}

function runStaticTransit(types, bbox, stops, btn) {
  addLog('i', 'Static mode — querying Overpass for transit routes');
  const q = buildTransitOverpass(types, bbox);
  if (!q) { finishTransitBtn(btn, 'No query'); return; }
  addLog('q', 'Overpass: ' + types.length + ' transit type(s)');
  overpassQuery(q).then(data => {
    const result = transitOverpassToFeature(data.elements || [], types);
    Object.entries(result.routes).forEach(([kind, fc]) => {
      const cfg = TRANSIT_TYPES[kind] || {};
      addTransitLayer(kind, fc, cfg.color, cfg.label || kind, fc.features.length);
      addLog('s', `Found ${fc.features.length} ${cfg.label || kind}`);
    });
    if (stops && result.stops.features.length) {
      transitStops = result.stops;
      setTransitStops(result.stops, result.stops.features.length);
      addLog('s', `Found ${result.stops.features.length} stops`);
    }
    updateLegend();
    document.getElementById('transitStatus').textContent = 'Done';
    finishTransitBtn(btn, '▶ Query Transit');
    addLog('s', 'Transit query complete');
  }).catch(e => {
    addLog('e', 'Transit query failed: ' + e.message);
    document.getElementById('transitStatus').textContent = 'Error';
    finishTransitBtn(btn, '▶ Query Transit');
  });
}

function finishTransitBtn(btn, label) {
  isTransitRunning = false;
  btn.disabled = false;
  btn.classList.remove('running');
  btn.innerHTML = label;
}

function addTransitLayer(key, geojson, color, label, count) {
  if (!geojson || !geojson.features || !geojson.features.length) return;

  if (transitLayers[key]) removeTransitLayer(key);

  transitLayers[key] = { color, label, count, fc: geojson };
  transitCounts[key] = count;
  document.getElementById('tcnt-' + key).textContent = count;

  try {
    if (!map.getSource('tr-' + key)) {
      map.addSource('tr-' + key, { type: 'geojson', data: geojson });
    }
  } catch (e) { return; }

  const layersToAdd = [
    {
      id: 'tr-casing-' + key, source: 'tr-' + key, type: 'line',
      paint: { 'line-color': '#000', 'line-opacity': 0.35, 'line-width': 5, 'line-blur': 2 }
    },
    {
      id: 'tr-' + key, source: 'tr-' + key, type: 'line',
      paint: { 'line-color': color, 'line-opacity': 0.9, 'line-width': 2.8 }
    }
  ];
  layersToAdd.forEach(l => {
    if (!map.getLayer(l.id)) { try { map.addLayer(l); } catch (e) {} }
  });
  updateLegend();
}

function removeTransitLayer(key) {
  ['tr-casing-' + key, 'tr-' + key].forEach(l => { if (map.getLayer(l)) map.removeLayer(l); });
  if (map.getSource('tr-' + key)) map.removeSource('tr-' + key);
  delete transitLayers[key];
  delete transitCounts[key];
  const cnt = document.getElementById('tcnt-' + key);
  if (cnt) cnt.textContent = '';
}

function clearTransitLayers() {
  Object.keys(transitLayers).forEach(k => removeTransitLayer(k));
  removeStopsLayer();
  transitLayers = {};
}

function setTransitStops(geojson, count) {
  removeStopsLayer();
  transitStops = geojson;
  const show = document.getElementById('chkTransitStops').checked;
  try {
    map.addSource('tr-stops', { type: 'geojson', data: geojson });
    map.addLayer({
      id: 'tr-stops', source: 'tr-stops', type: 'circle',
      layout: { visibility: show ? 'visible' : 'none' },
      paint: { 'circle-radius': 3.2, 'circle-color': '#fff', 'circle-stroke-width': 1.5, 'circle-stroke-color': '#111' }
    });
  } catch (e) {}
  updateLegend();
}

function removeStopsLayer() {
  if (map.getLayer('tr-stops')) map.removeLayer('tr-stops');
  if (map.getSource('tr-stops')) map.removeSource('tr-stops');
  transitStops = null;
}

function updateLegend() {
  const el = document.getElementById('legendItems');
  el.innerHTML = '';
  const active = Object.entries(amenityLayers).filter(([k, v]) => v.count > 0);
  const activePoly = Object.entries(polygonLayers).filter(([k, v]) => v.count > 0);
  const activeTr = Object.entries(transitLayers).filter(([k, v]) => v.count > 0);
  const hasStops = !!(transitStops && transitStops.features && transitStops.features.length
    && document.getElementById('chkTransitStops').checked);
  if (!active.length && !activePoly.length && !activeTr.length && !hasStops) {
    document.getElementById('legendWrap').classList.remove('show');
    return;
  }
  document.getElementById('legendWrap').classList.add('show');
  active.forEach(([key, cfg]) => {
    const info = AMENITY_TYPES[key] || {};
    const div = document.createElement('div');
    div.className = 'litem';
    div.innerHTML = `<span class="ldot" style="background:${cfg.color}"></span>${info.label || key} <span style="color:#4a6a85">(${cfg.count})</span>`;
    el.appendChild(div);
  });
  activePoly.forEach(([key, cfg]) => {
    const info = POLYGON_TYPES[key] || {};
    const div = document.createElement('div');
    div.className = 'litem';
    div.innerHTML = `<span class="lsq" style="background:${cfg.color}"></span>${info.label || cfg.label || key} <span style="color:#4a6a85">(${cfg.count})</span>`;
    el.appendChild(div);
  });
  if (activeTr.length) {
    const h = document.createElement('div');
    h.className = 'legend-title';
    h.style.marginTop = '4px';
    h.textContent = '🚍 Transit';
    el.appendChild(h);
    activeTr.forEach(([key, cfg]) => {
      const info = TRANSIT_TYPES[key] || {};
      const div = document.createElement('div');
      div.className = 'litem';
      div.innerHTML = `<span class="lsw" style="background:${cfg.color}"></span>${info.label || cfg.label || key} <span style="color:#4a6a85">(${cfg.count})</span>`;
      el.appendChild(div);
    });
  }
  if (hasStops) {
    const div = document.createElement('div');
    div.className = 'litem';
    div.innerHTML = `<span class="ldot" style="background:#fff;border:1.5px solid #111;box-sizing:border-box"></span>Stops <span style="color:#4a6a85">(${transitStops.features.length})</span>`;
    el.appendChild(div);
  }
}

document.addEventListener('DOMContentLoaded', init);
