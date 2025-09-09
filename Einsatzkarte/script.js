/* ===========================================
 * Feuerwehr Map – kompletter Script-Stand (POI-Suche & BMA Fix)
 * =========================================== */

/* ================== Marker-CSS (injected) ================== */
(() => {
  const css = `
    :root{
      --marker-h: 32px;
      --bma-scale: .65;
      --bma-offset: 35px;
      --app-bg: #10A6C9;
    }
    body, #map, .leaflet-container{ background: var(--app-bg) !important; }

    /* Mittelpunkt = Koordinate */
    .marker-wrap{
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      transform: translate(-50%, -50%);
      pointer-events: auto;
    }

    /* Sichtbarkeit erst ab letzter Kachelstufe */
    .marker-wrap .poi-img-icon{ display: none; }
    .marker-wrap .bma-symbol{ display: none; }
    body.icons-on .marker-wrap .poi-img-icon{ display: block; }
    body.icons-on.bma-on .marker-wrap .bma-symbol{ display: block; }

    .marker-wrap .poi-img-icon{
      width: var(--marker-h);
      height: var(--marker-h);
      object-fit: contain;
    }
    .marker-wrap .bma-symbol{
      margin-top: var(--bma-offset);
      width: calc(var(--marker-h) * var(--bma-scale));
      height: calc(var(--marker-h) * var(--bma-scale));
      object-fit: contain;
    }
  `;
  const tag = document.createElement('style');
  tag.textContent = css;
  document.head.appendChild(tag);
})();

/* ================== Projektion / Grundwerte ================== */
const tileSize = 256;
const minZoom = 0;
const nativeMaxZoom = 5;   // letzte echte Kachelstufe
const visualMaxZoom = 7;   // +2 virtuelle Stufen
const size = tileSize * Math.pow(2, nativeMaxZoom);

const mapRef1 = { lng: 34.90625,  lat: -7.62500 };
const gtaRef1 = { x: -4000,       y: 8000 };
const mapRef2 = { lng: 241.12500, lat: -255.1875 };
const gtaRef2 = { x: 6000,        y: -4000 };

const scaleX = (mapRef2.lng - mapRef1.lng) / (gtaRef2.x - gtaRef1.x);
const scaleY = (mapRef2.lat - mapRef1.lat) / (gtaRef2.y - gtaRef1.y);
function toMap(x, y){ return { lng: mapRef1.lng + (x - gtaRef1.x) * scaleX, lat: mapRef1.lat + (y - gtaRef1.y) * scaleY }; }
function fromMap(lat, lng){ return { x: Math.round(gtaRef1.x + (lng - mapRef1.lng) / scaleX), y: Math.round(gtaRef1.y + (lat - mapRef1.lat) / scaleY) }; }

/* ================== Karte ================== */
const map = L.map('map', {
  crs: L.CRS.Simple,
  minZoom,
  maxZoom: visualMaxZoom,
  zoomAnimation: true,        // Smooth Zoom
  markerZoomAnimation: false, // Marker bleiben stabil
  fadeAnimation: true,
  inertia: true
});
const sw = map.unproject([0, size], nativeMaxZoom);
const ne = map.unproject([size, 0], nativeMaxZoom);
const bounds = L.latLngBounds(sw, ne);
map.setMaxBounds(bounds).fitBounds(bounds);

/* --- Basiskarten --- */
const BASESETS = [
  { key: 'atl', name: 'Atlas',     path: 'tiles_atl' },
  { key: 'sat', name: 'Satellit',  path: 'tiles_sat' }
];
const basemapLayers = {};
let currentBasemapKey = 'atl';

async function detectExtForTileset(basePath){
  const tryExt = async (ext) => {
    try { const url = `${basePath}/0/0/0.${ext}`; const res = await fetch(url, { method: 'HEAD', cache: 'no-store' }); return res.ok; }
    catch { return false; }
  };
  if (await tryExt('jpg')) return 'jpg';
  if (await tryExt('png')) return 'png';
  return 'jpg';
}
async function buildBasemaps(){
  for (const set of BASESETS){
    const ext = await detectExtForTileset(set.path);
    basemapLayers[set.key] = L.tileLayer(`${set.path}/{z}/{x}/{y}.${ext}`, {
      tileSize,
      minZoom,
      maxZoom: visualMaxZoom,
      maxNativeZoom: nativeMaxZoom,
      noWrap: true,
      bounds,
      attribution: '© FeuerwehrAUSTRIAX'
    });
  }
  setBasemap(currentBasemapKey);
}
function setBasemap(key){
  if (currentBasemapKey === key && map.hasLayer(basemapLayers[key])) return;
  Object.values(basemapLayers).forEach(l => { if (l && map.hasLayer(l)) map.removeLayer(l); });
  const layer = basemapLayers[key];
  if (layer) { layer.addTo(map); currentBasemapKey = key; }
}
function initBasemapToggle(){
  const opts = document.querySelectorAll('#basemapSwitch .switch-option');
  opts.forEach(opt=>{
    opt.addEventListener('click', ()=>{
      opts.forEach(o=>o.classList.remove('active'));
      opt.classList.add('active');
      setBasemap(opt.dataset.key);
    });
  });
}
buildBasemaps();
initBasemapToggle();

/* ================== Koordinaten-Tipp & Copy ================== */
const coordTip = document.getElementById('coordTip');
map.on('mousemove', (e)=>{
  const p = fromMap(e.latlng.lat, e.latlng.lng);
  coordTip.textContent = `x:${p.x} y:${p.y}`;
  coordTip.style.display = 'block';
  coordTip.style.left = `${e.originalEvent.clientX + 12}px`;
  coordTip.style.top = `${e.originalEvent.clientY + 12}px`;
});
map.on('mouseout', ()=>{ coordTip.style.display='none'; });
map.on('click', (e)=>{
  const p = fromMap(e.latlng.lat, e.latlng.lng);
  const txt = `${p.x}, ${p.y}`;
  try{
    if (navigator.clipboard?.writeText){ navigator.clipboard.writeText(txt).then(()=>toast(txt)).catch(()=>fallbackCopy(txt)); }
    else{ fallbackCopy(txt); }
  }catch(_){ fallbackCopy(txt); }
});
function fallbackCopy(text){
  const ta = document.createElement('textarea'); ta.value = text;
  ta.style.position = 'absolute'; ta.style.left = '-9999px'; document.body.appendChild(ta);
  ta.select(); try{ document.execCommand('copy'); toast(text);}catch(e){}
  document.body.removeChild(ta);
}
function toast(text){
  const fb = document.createElement('div');
  fb.textContent = `GTA-Koordinaten kopiert: ${text}`;
  Object.assign(fb.style, {position:'absolute',top:'10px',right:'10px',padding:'6px 10px',
    background:'rgba(0,0,0,.7)',color:'#fff',borderRadius:'4px',fontFamily:'sans-serif',zIndex:2000});
  document.body.appendChild(fb); setTimeout(()=>fb.remove(),1500);
}

/* ================== Suche / Controls ================== */
const searchBox = document.getElementById('searchBox');
const clearBtn  = document.getElementById('clearBtn');

const categoriesBox = document.getElementById('categories');
const toggleAllEl  = document.getElementById('toggle-all');
const togglePlzEl  = document.getElementById('toggle-plz');
const bmaToggleEl  = document.getElementById('bmaToggle');

document.getElementById("categoryFilterHeader").addEventListener("click", function(){
  const contentDiv = document.getElementById("categoryFilterContent");
  const toggleArrow = document.getElementById("toggleArrow");
  const open = contentDiv.style.display === "block";
  contentDiv.style.display = open ? "none" : "block";
  toggleArrow.innerText = open ? "►" : "▼";
});

/* ================== MODALS ================== */
function openInfoModalFromPOI(p){
  document.getElementById('infoPOI').textContent = p.POI || '—';
  document.getElementById('infoKategorie').textContent = p.Kategorie || '—';

  const adresse = [
    [p.Adresse_Strasse || p['Adresse Straße'] || '', p.Hausnummer || ''].filter(Boolean).join(' ').trim(),
    [p.PLZ || p['Adresse PLZ'] || '', p.Bezirk || p['Adresse Bezirk'] || ''].filter(Boolean).join(' ').trim()
  ].filter(Boolean).join(', ');
  document.getElementById('infoAdresse').textContent = adresse || '—';

  const bmaTxt = (p.BMA || '').toString().trim() ? (String(p.BMA).toUpperCase()) : '—';
  document.getElementById('infoBMA').textContent = bmaTxt;
  document.getElementById('infoBMACode').textContent = p['BMA-Code'] || p.BMA_Code || '—';

  const img = document.getElementById('infoObjektbild');
  if (p.Objektbild){ img.src = p.Objektbild; img.style.display = 'block'; }
  else { img.removeAttribute('src'); img.style.display = 'none'; }

  const bes = (p.Besonderheit || '').replace(/\r?\n/g, '<br>');
  const kd  = (p.Kontaktdaten || '').replace(/^"+|"+$/g,'').replace(/\r?\n/g, '<br>');
  document.getElementById('infoBesonderheit').innerHTML = bes || '—';
  document.getElementById('infoKontaktdaten').innerHTML = kd  || '—';
  document.getElementById('boxBesonderheit').hidden = true;
  document.getElementById('boxKontakt').hidden = true;

  document.getElementById('btnBesonderheit').onclick = () => {
    const box = document.getElementById('boxBesonderheit');
    box.hidden = !box.hidden;
  };
  document.getElementById('btnKontakt').onclick = () => {
    const box = document.getElementById('boxKontakt');
    box.hidden = !box.hidden;
  };
  document.getElementById('btnPlan').onclick = () => {
    closeInfoModal();
    openPlanModalFromPOI(p);
  };

  document.getElementById('infoModal').setAttribute('aria-hidden','false');
}
function closeInfoModal(){ document.getElementById('infoModal').setAttribute('aria-hidden','true'); }

function openPlanModalFromPOI(p){
  const planUrl = p.Brandschutzplan || p.Objektbild || "";
  const img = document.getElementById('planImage');
  img.src = planUrl || "";
  img.alt = `Brandschutzplan – ${p.POI ?? ""}`;
  document.getElementById('planModal').setAttribute('aria-hidden','false');
}
function closePlanModal(){ document.getElementById('planModal').setAttribute('aria-hidden','true'); }

document.getElementById('infoClose').addEventListener('click', closeInfoModal);
document.getElementById('planClose').addEventListener('click', closePlanModal);
document.addEventListener('keydown', (e)=>{
  if (e.key==='Escape'){
    if (document.getElementById('planModal').getAttribute('aria-hidden')==='false') closePlanModal();
    else if (document.getElementById('infoModal').getAttribute('aria-hidden')==='false') closeInfoModal();
  }
});
document.getElementById('infoModal').addEventListener('click', (e)=>{ if(e.target.id==='infoModal') closeInfoModal(); });
document.getElementById('planModal').addEventListener('click', (e)=>{ if(e.target.id==='planModal') closePlanModal(); });

/* ================== Autocomplete ================== */
const AC_MIN = 2;
const AC_MAX = 8;
let AC_DATA = []; // [{value, kind:'poi'|'plz'}]
let acIndex = -1;

const acBox = document.createElement('div');
acBox.id = 'acBox';
document.body.appendChild(acBox);

function positionAcBox(){
  const r = searchBox.getBoundingClientRect();
  acBox.style.left = `${r.left + window.scrollX}px`;
  acBox.style.top = `${r.bottom + window.scrollY + 4}px`;
  acBox.style.width = `${r.width}px`;
}
window.addEventListener('resize', positionAcBox);
window.addEventListener('scroll', positionAcBox, true);

function renderAc(items){
  acBox.innerHTML = '';
  items.forEach((it,i)=>{
    const row = document.createElement('div');
    row.className = 'ac-row';
    const label = document.createElement('span');
    label.className = 'ac-text';
    label.textContent = it.value;
    const tag = document.createElement('span');
    tag.className = 'ac-tag';
    tag.textContent = it.kind === 'plz' ? 'PLZ' : 'POI';
    row.appendChild(label);
    row.appendChild(tag);
    row.addEventListener('mouseenter', ()=>setAcIndex(i));
    row.addEventListener('mousedown', e=>{ e.preventDefault(); chooseSuggestion(i); });
    acBox.appendChild(row);
  });
  setAcIndex(items.length ? 0 : -1);
  positionAcBox();
  acBox.style.display = items.length ? 'block' : 'none';
}
function setAcIndex(i){
  acIndex = i;
  [...acBox.children].forEach((el,idx)=>{
    el.classList.toggle('active', idx === acIndex);
  });
}
function hideAc(){ acBox.style.display='none'; acIndex = -1; }

searchBox.addEventListener('input', ()=>{
  const q = searchBox.value.trim().toLowerCase();
  if (q.length < AC_MIN){ hideAc(); return; }
  const list = AC_DATA.filter(it =>
    it.kind === 'plz'
      ? it.value.toLowerCase().startsWith(q)
      : it.value.toLowerCase().includes(q)
  ).slice(0, AC_MAX);
  renderAc(list);
});
searchBox.addEventListener('focus', ()=>{
  if (searchBox.value.trim().length >= AC_MIN) searchBox.dispatchEvent(new Event('input'));
});
searchBox.addEventListener('blur', ()=> setTimeout(hideAc, 120));
searchBox.addEventListener('keydown', e=>{
  const visible = acBox.style.display === 'block';
  if (!visible){
    if (e.key === 'Enter'){ e.preventDefault(); performSearch(searchBox.value.trim()); }
    return;
  }
  if (e.key === 'ArrowDown'){ e.preventDefault(); if (acBox.children.length) setAcIndex((acIndex+1)%acBox.children.length); }
  else if (e.key === 'ArrowUp'){ e.preventDefault(); if (acBox.children.length) setAcIndex((acIndex-1+acBox.children.length)%acBox.children.length); }
  else if (e.key === 'Enter'){ e.preventDefault(); if (acIndex < 0 && acBox.children.length) setAcIndex(0); if (acIndex >= 0) chooseSuggestion(acIndex); }
  else if (e.key === 'Escape'){ hideAc(); }
});
function chooseSuggestion(i){
  const row = acBox.children[i];
  if (!row) return;
  const val = row.querySelector('.ac-text').textContent;
  hideAc();
  searchBox.value = val;
  performSearch(val);
}

/* ================== Ebenen / Daten ================== */
const categoryLayers = {};
const layerStates = {};
const highlightLayer = L.layerGroup().addTo(map);
const plzLayer = L.layerGroup();
const PLZ_MIN_ZOOM = nativeMaxZoom;

/* ===== Dateien & Quellen ===== */
const plzFile = 'source/plz.txt';
const SHEET_TSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQTiTQbW09ek6xRFa7YFwFWbm-Sn6WuApvVtdyxv0-FO7xmbT1hMhGw7Qswg1BrSXdVhUdReX6BlpQj/pub?gid=1389818837&single=true&output=tsv";
const ICON_CSV  = 'source/icons.csv';

let ALL_MARKERS = [];   // POIs
let PLZ_DATA = [];      // {x,y,lat,lng,code}
let PLZ_MARKERS = [];   // Leaflet Marker für PLZ

/* ================== Utils ================== */
function isIconAvailable(url){
  return new Promise(resolve=>{
    if (!url) return resolve(false);
    const img = new Image(); img.onload=()=>resolve(true); img.onerror=()=>resolve(false); img.src=url;
  });
}
function slugify(s){ return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
function toNumber(n){ const s=String(n||'').trim().replace(',', '.'); const v=parseFloat(s); return Number.isFinite(v)?v:null; }
function parseLage(lageStr){
  const m = String(lageStr||'').match(/(-?\d+(?:[.,]\d+)?)\s*[,;|]\s*(-?\d+(?:[.,]\d+)?)/);
  if (!m) return [0,0];
  return [toNumber(m[1]) ?? 0, toNumber(m[2]) ?? 0];
}
function parseTSV(text) {
  const lines = text.replace(/\r/g,'').split('\n').filter(l => l.trim().length);
  if (!lines.length) return [];
  const headers = lines[0].split('\t').map(h => h.trim());
  return lines.slice(1).map(line => {
    const cells = line.split('\t');
    const row = {};
    headers.forEach((h, i) => row[h] = (cells[i] ?? "").trim());
    return row;
  });
}
function parseCSV(text){
  const clean = text.replace(/\r/g,'').trim();
  const delimiter = clean.includes(';') && !clean.includes(',') ? ';' : ',';
  const lines = clean.split('\n').filter(Boolean);
  const headers = lines[0].split(delimiter).map(h=>h.trim());
  return lines.slice(1).map(line=>{
    const cells = line.split(delimiter).map(c=>c.trim());
    const o = {}; headers.forEach((h,i)=>o[h]=cells[i]??''); return o;
  });
}
function normalizeRow(r){
  const [x,y] = parseLage(r['Lage']);
  return {
    POI: r['POI'] || '',
    Kategorie: r['Kategorie'] || 'Sonstiges',
    'Adresse Straße': r['Adresse Straße'] || '',
    Adresse_Strasse: r['Adresse Straße'] || r['Adresse_Strasse'] || '',
    Hausnummer: r['Hausnummer'] || '',
    'Adresse PLZ': r['Adresse PLZ'] || '',
    'Adresse Bezirk': r['Adresse Bezirk'] || '',
    PLZ: r['Adresse PLZ'] || '',
    Bezirk: r['Adresse Bezirk'] || '',
    Lage: [x, y],
    ICON: r['ICON'] || '',
    BMA: r['BMA'] || '',
    'BMA-Code': r['BMA-Code'] || r['BMA_Code'] || '',
    BMA_Code: r['BMA-Code'] || r['BMA_Code'] || '',
    Objektbild: r['Objektbild'] || '',
    Brandschutzplan: r['Brandschutzplan'] || '',
    Besonderheit: r['Besonderheit'] || '',
    Kontaktdaten: r['Kontaktdaten'] || ''
  };
}

/* Hilfsfunktionen für Suche */
function norm(s){
  return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
}

/* ============ PLZ-Pin ============ */
const PLZ_PIN_SVG = `
<svg width="20" height="32" viewBox="0 0 20 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M10 31 C10 31 0 19 0 12 a10 10 0 0 1 20 0 c0 7 -10 19 -10 19z" fill="#e53935"/>
  <circle cx="10" cy="12" r="4.5" fill="#fff"/>
</svg>`;

/* PLZ laden & Pins EINMAL bauen */
fetch(plzFile).then(r=>r.text()).then(text=>{
  const entries = text.match(/\{[^}]*\}/g) || [];
  PLZ_DATA = entries.map(block=>{
    const x = parseFloat(block.match(/\["x"\]\s*=\s*([-0-9\.]+)/)[1]);
    const y = parseFloat(block.match(/\["y"\]\s*=\s*([-0-9\.]+)/)[1]);
    const code = block.match(/\["code"\]\s*=\s*"(\d+)"/)[1];
    const { lat, lng } = toMap(x,y);
    return { x,y,lat,lng,code };
  });

  const makePlzIcon = () => L.divIcon({ className:'plz-pin', html:PLZ_PIN_SVG, iconSize:[20,32], iconAnchor:[10,32] });
  PLZ_MARKERS = PLZ_DATA.map(p=>{
    const m = L.marker([p.lat,p.lng], { icon: makePlzIcon() });
    m.plz = String(p.code).toLowerCase();
    m.addTo(plzLayer);
    return m;
  });

  updatePlzVisibility();
  rebuildAcData();
});
function updatePlzVisibility(){
  const show = togglePlzEl?.checked && map.getZoom() >= PLZ_MIN_ZOOM;
  if (show){ if (!map.hasLayer(plzLayer)) plzLayer.addTo(map); }
  else { if (map.hasLayer(plzLayer)) map.removeLayer(plzLayer); }
}
togglePlzEl?.addEventListener('change', updatePlzVisibility);
map.on('zoomend', updatePlzVisibility);

/* ================== ICON-Mapping (CSV) ================== */
let ICON_BY_POI = new Map();
let ICON_BY_KATEGORIE = new Map();
async function loadIconCsv(){
  try{
    const res = await fetch(ICON_CSV, { cache:'no-store' });
    if (!res.ok) throw new Error(`ICON CSV: HTTP ${res.status}`);
    const rows = parseCSV(await res.text());
    ICON_BY_POI.clear(); ICON_BY_KATEGORIE.clear();
    for (const r of rows){
      const poi = (r.POI||'').trim().toLowerCase();
      const kat = (r.Kategorie||'').trim().toLowerCase();
      const url = (r.ICON_URL || r.ICON || '').trim();
      if (!url) continue;
      if (poi) ICON_BY_POI.set(poi, url);
      else if (kat) ICON_BY_KATEGORIE.set(kat, url);
    }
  }catch(e){
    console.warn('ICON-CSV konnte nicht geladen werden – nutze ICON aus TSV, wenn vorhanden.', e);
  }
}
function resolveIconUrl(poiObj){
  const poiKey = String(poiObj.POI||'').toLowerCase();
  const katKey = String(poiObj.Kategorie||'Sonstiges').toLowerCase();
  return ICON_BY_POI.get(poiKey) || ICON_BY_KATEGORIE.get(katKey) || poiObj.ICON || '';
}

/* ================== POIs laden (TSV) ================== */
const ICONS_START_ZOOM = nativeMaxZoom;
function updateIconZoomVisibility(){
  const on = map.getZoom() >= ICONS_START_ZOOM;
  document.body.classList.toggle('icons-on', on);
}
map.on('zoomend', updateIconZoomVisibility);

(async function(){
  try{
    await loadIconCsv();

    const res = await fetch(SHEET_TSV, { cache: 'no-store' });
    if (!res.ok) throw new Error(`TSV laden fehlgeschlagen: HTTP ${res.status}`);
    const rows = parseTSV(await res.text());
    const data = rows.map(normalizeRow);

    const poiNames = new Set(); const plzFromPois = new Set();
    ALL_MARKERS = [];

    // evtl. alte Kategorien entfernen
    Object.values(categoryLayers).forEach(grp => map.removeLayer(grp));
    for (const key of Object.keys(categoryLayers)) delete categoryLayers[key];
    for (const key of Object.keys(layerStates)) delete layerStates[key];

    for (const poi of data){
      poi.ICON = resolveIconUrl(poi);

      if (poi.POI) poiNames.add(poi.POI);
      if (poi.PLZ) plzFromPois.add(String(poi.PLZ));

      const [x,y] = poi.Lage || [0,0];
      const { lat, lng } = toMap(x,y);

      // ---------- BMA LOGIK (robust) ----------
      const bmaRaw = (poi.BMA ?? '').toString().trim();
      const hasBma = !!bmaRaw && !/^(nein|no|false|0|off)$/i.test(bmaRaw);
      // ----------------------------------------

      const iconUrl = poi.ICON || '';
      const iconAvailable = await isIconAvailable(iconUrl);
      const mainHtml = iconAvailable
        ? `<img src="${iconUrl}" class="poi-img-icon" alt="${poi.POI || ''}" />`
        : `<span class="plz-box-icon"><span>??</span></span>`;
      const bmaHtml = hasBma
        ? `<img src="https://i.postimg.cc/RFZ23TVC/BMA.gif" class="bma-symbol" alt="BMA" />`
        : ``;

      const markerHTML = `<div class="marker-wrap">${mainHtml}${bmaHtml}</div>`;
      const icon = L.divIcon({ html: markerHTML, className:'', iconSize: null, iconAnchor:[0,0], popupAnchor:[0,-20] });

      const marker = L.marker([lat,lng], { icon });
      marker.on('click', () => openInfoModalFromPOI(poi));

      marker.poiName = norm(poi.POI);
      marker.plz     = norm(poi.PLZ || poi['Adresse PLZ'] || '');
      marker._categoryName = poi.Kategorie || 'Sonstiges';

      ALL_MARKERS.push(marker);
      if (!categoryLayers[marker._categoryName]){
        categoryLayers[marker._categoryName] = L.layerGroup();
        layerStates[marker._categoryName] = true;
      }
      marker.addTo(categoryLayers[marker._categoryName]);
    }

    // Kategorien sichtbar machen
    Object.values(categoryLayers).forEach(grp=>{ if (!map.hasLayer(grp)) grp.addTo(map); });

    buildFilterPanelFromCategories();

    // Autocomplete (POIs + PLZ)
    rebuildAcData(poiNames, plzFromPois);

    // BMA-Visibility initial: Toggle standardmäßig AN
    if (bmaToggleEl){ bmaToggleEl.checked = true; }
    applyBmaToggle();

    // Icons-Visibility initial
    updateIconZoomVisibility();

  }catch(err){
    console.error('POIs laden fehlgeschlagen:', err);
  }
})();

/* ================== Sidebar: Kategorien ================== */
function buildFilterPanelFromCategories(){
  const cats = Object.keys(categoryLayers).sort((a,b)=>a.localeCompare(b,'de'));
  categoriesBox.innerHTML = '';

  cats.forEach(cat=>{
    const id = `cat-${slugify(cat)}`;
    const line = document.createElement('label');
    line.innerHTML = `<input type="checkbox" id="${id}" data-cat="${encodeURIComponent(cat)}" ${layerStates[cat] ? 'checked' : ''} /> ${cat}`;
    categoriesBox.appendChild(line);
  });

  categoriesBox.querySelectorAll('input[type="checkbox"]').forEach(cb=>{
    cb.addEventListener('change', ()=>{
      const cat = decodeURIComponent(cb.dataset.cat);
      if (cb.checked){ categoryLayers[cat].addTo(map); layerStates[cat] = true; }
      else { map.removeLayer(categoryLayers[cat]); layerStates[cat] = false; }
      syncToggleAllState();
    });
  });

  toggleAllEl.onchange = null;
  toggleAllEl.addEventListener('change', ()=>{
    const check = toggleAllEl.checked;
    categoriesBox.querySelectorAll('input[type="checkbox"]').forEach(cb=>{
      if (cb.checked !== check){ cb.checked = check; cb.dispatchEvent(new Event('change')); }
    });
  });

  bmaToggleEl.onchange = applyBmaToggle;
  syncToggleAllState();
}
function syncToggleAllState(){
  const states = Object.values(layerStates); if (!states.length) return;
  const allOn = states.every(Boolean), allOff = states.every(s=>!s);
  toggleAllEl.indeterminate = !(allOn || allOff);
  toggleAllEl.checked = allOn;
}

/* ================== BMA-Icon ein/aus (via Body-Klasse) ================== */
function applyBmaToggle(){
  const on = !!bmaToggleEl?.checked;
  document.body.classList.toggle('bma-on', on);
}

/* ============ Temporäre PLZ-Pinnadel für Suchen ============ */
function showTempPlzPin(latlng){
  const tempIcon = L.divIcon({
    className: 'plz-pin',
    html: PLZ_PIN_SVG,
    iconSize: [20, 32],
    iconAnchor: [10, 32]
  });
  const temp = L.marker(latlng, { icon: tempIcon, zIndexOffset: 1000 }).addTo(highlightLayer);
  setTimeout(()=> highlightLayer.removeLayer(temp), 2500);
}

/* ================== Suche ================== */
function performSearch(raw){
  const qRaw = (raw||'').trim(); if (!qRaw) return;
  const q = norm(qRaw);

  // 1) POI – Exakt
  let target = ALL_MARKERS.find(m => m.poiName === q);
  // 2) POI – Beginn
  if (!target) target = ALL_MARKERS.find(m => m.poiName.startsWith(q));
  // 3) POI – Enthält
  if (!target) target = ALL_MARKERS.find(m => m.poiName.includes(q));

  if (target){
    map.setView(target.getLatLng(), Math.max(map.getZoom(), nativeMaxZoom), { animate: true });
    return;
  }

  // 4) PLZ Marker
  const plzM = PLZ_MARKERS.find(m => m.plz === q);
  if (plzM){
    const ll = plzM.getLatLng();
    map.setView(ll, Math.max(map.getZoom(), nativeMaxZoom), { animate: true });
    showTempPlzPin(ll);
    return;
  }

  // 5) PLZ Daten-Fallback
  const plzD = PLZ_DATA.find(p => norm(p.code) === q);
  if (plzD){
    const ll = [plzD.lat, plzD.lng];
    map.setView(ll, Math.max(map.getZoom(), nativeMaxZoom), { animate: true });
    showTempPlzPin(ll);
  }
}

/* ================== Autocomplete-Daten füllen ================== */
function rebuildAcData(poiNamesSet=null, plzSetFromPoi=null){
  const poiNames = poiNamesSet ? Array.from(poiNamesSet) : [];
  const plzCodes = new Set(PLZ_DATA.map(p=>p.code));
  if (plzSetFromPoi){
    for (const z of plzSetFromPoi) plzCodes.add(String(z));
  }

  AC_DATA = [
    ...poiNames.map(v=>({ value:String(v), kind:'poi' })),
    ...Array.from(plzCodes).map(v=>({ value:String(v), kind:'plz' }))
  ].sort((a,b)=>a.value.localeCompare(b.value,'de'));
}

/* ================== Clear ================== */
clearBtn.addEventListener('click', ()=>{
  searchBox.value = '';
  hideAc();
  map.setView([(mapRef1.lat+mapRef2.lat)/2, (mapRef1.lng+mapRef2.lng)/2], minZoom, { animate: true });
});
