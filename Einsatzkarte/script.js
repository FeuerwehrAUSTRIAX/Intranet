/* ===========================================
 * Marker -> Info-Modal -> BSP-Modal
 * + Autocomplete für POI & PLZ (ab 2 Zeichen)
 * =========================================== */


(() => {
  const css = `
    :root{
      --marker-h: 32px;   /* Haupt-Icon-Größe */
      --bma-scale: .65;   /* BMA relativ zum Haupt-Icon */
    }

    /* Container des Markers: NICHT mehr width:0/height:0! */
    .marker-wrap{
      display:flex;
      flex-direction:column;   /* übereinander */
      align-items:center;      /* zentriert */
      transform:translate(-50%, -100%); /* Ankerpunkt: Spitze unten mittig */
      pointer-events:auto;
    }

    /* Haupt-Icon */
    .marker-wrap .poi-img-icon{
      width:var(--marker-h);
      height:var(--marker-h);
      object-fit:contain;
      display:block;
    }

    /* BMA-Symbol unter dem Icon, sauber skalierbar */
    .marker-wrap .bma-symbol{
      margin-top:4px;
      width:calc(var(--marker-h) * var(--bma-scale));
      height:calc(var(--marker-h) * var(--bma-scale)); /* quadratisch, nie riesig */
      object-fit:contain;
      display:block;
    }
  `;
  const tag = document.createElement('style');
  tag.textContent = css;
  document.head.appendChild(tag);
})();





/* ================== Projektion / Grundwerte ================== */
const tileSize = 256, minZoom = 0, maxZoom = 5;
const size = tileSize * Math.pow(2, maxZoom);

// Referenzpunkte
const mapRef1 = { lng: 34.90625,  lat: -7.62500 };
const gtaRef1 = { x: -4000,       y: 8000 };
const mapRef2 = { lng: 241.12500, lat: -255.1875 };
const gtaRef2 = { x: 6000,        y: -4000 };

const scaleX = (mapRef2.lng - mapRef1.lng) / (gtaRef2.x - gtaRef1.x);
const scaleY = (mapRef2.lat - mapRef1.lat) / (gtaRef2.y - gtaRef1.y);
function toMap(x, y){ return { lng: mapRef1.lng + (x - gtaRef1.x) * scaleX, lat: mapRef1.lat + (y - gtaRef1.y) * scaleY }; }
function fromMap(lat, lng){ return { x: Math.round(gtaRef1.x + (lng - mapRef1.lng) / scaleX), y: Math.round(gtaRef1.y + (lat - mapRef1.lat) / scaleY) }; }

/* ================== Karte ================== */
const map = L.map('map', { crs: L.CRS.Simple, minZoom, maxZoom });
const sw = map.unproject([0, size], maxZoom);
const ne = map.unproject([size, 0], maxZoom);
const bounds = L.latLngBounds(sw, ne);
map.setMaxBounds(bounds).fitBounds(bounds);

// --- Basiskarten ---
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
      tileSize, minZoom, maxZoom, noWrap: true, bounds,
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
initBasemapToggle(); buildBasemaps();

/* ================== Koordinaten-Tipp + Kopieren ================== */
const tip = document.getElementById('coordTip');
map.getContainer().addEventListener('mousemove', evt => {
  const rect = map.getContainer().getBoundingClientRect();
  const p = map.containerPointToLatLng([evt.clientX-rect.left, evt.clientY-rect.top]);
  const gta = fromMap(p.lat, p.lng);
  tip.style.left = `${evt.clientX}px`; tip.style.top = `${evt.clientY}px`;
  tip.textContent = `GTA: ${gta.x}, ${gta.y}`; tip.style.display = 'block';
});
map.getContainer().addEventListener('mouseleave', () => tip.style.display = 'none');

map.on('click', e => {
  const gta = fromMap(e.latlng.lat, e.latlng.lng);
  const text = `${gta.x}, ${gta.y}`;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(()=>toast(text)).catch(()=>fallbackCopy(text));
  } else { fallbackCopy(text); }
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
const PLZ_MIN_ZOOM = 4;

const plzFile = 'source/plz.txt';
const poiFilePrimary  = 'source/pos.json';
const poiFileFallback = 'source/pois.json';

let ALL_MARKERS = []; // nur POIs
let PLZ_DATA = [];    // {x,y,lat,lng,code}

/* ================== Utils ================== */
function isIconAvailable(url){
  return new Promise(resolve=>{
    if (!url) return resolve(false);
    const img = new Image(); img.onload=()=>resolve(true); img.onerror=()=>resolve(false); img.src=url;
  });
}
function slugify(s){ return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }

/* ================== PLZ laden & rendern ================== */
fetch(plzFile).then(r=>r.text()).then(text=>{
  const entries = text.match(/\{[^}]*\}/g) || [];
  PLZ_DATA = entries.map(block=>{
    const xM = block.match(/\["x"\]\s*=\s*([-0-9\.]+)/);
    const yM = block.match(/\["y"\]\s*=\s*([-0-9\.]+)/);
    const cM = block.match(/\["code"\]\s*=\s*"(\d+)"/);
    if (!(xM&&yM&&cM)) return null;
    const x = parseFloat(xM[1]), y = parseFloat(yM[1]), code = cM[1];
    const { lat, lng } = toMap(x,y); return { x,y,lat,lng,code };
  }).filter(Boolean);

  updatePlzVisibility();
  // Autocomplete: PLZ rein (POIs kommen, sobald geladen)
  rebuildAcData(); 
}).catch(err=>console.error('PLZ laden fehlgeschlagen:', err));

function renderPlzLabels(){
  plzLayer.clearLayers();
  const b = map.getBounds();
  const makePlzIcon = code => L.divIcon({
    className:'plz-box-icon',
    html:`<span>${code}</span>`,
    iconSize:[40,20], iconAnchor:[20,10]
  });
  for (const p of PLZ_DATA){
    if (b.contains([p.lat,p.lng])){
      const m = L.marker([p.lat,p.lng],{icon:makePlzIcon(p.code)}).addTo(plzLayer);
      m.plz = p.code.toLowerCase(); m._isPlz = true;
    }
  }
}
function updatePlzVisibility(){
  const show = togglePlzEl?.checked && map.getZoom() >= PLZ_MIN_ZOOM;
  if (show){ if (!map.hasLayer(plzLayer)) plzLayer.addTo(map); renderPlzLabels(); }
  else { plzLayer.clearLayers(); if (map.hasLayer(plzLayer)) map.removeLayer(plzLayer); }
}
togglePlzEl?.addEventListener('change', updatePlzVisibility);
map.on('zoomend', updatePlzVisibility);
map.on('moveend', ()=>{ if (togglePlzEl?.checked && map.getZoom()>=PLZ_MIN_ZOOM) renderPlzLabels(); });

/* ================== POIs laden ================== */
loadPois(poiFilePrimary).catch(()=>loadPois(poiFileFallback)).catch(console.error);

async function loadPois(file){
  const res = await fetch(file,{ cache:'no-store' });
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  const data = await res.json();

  const poiNames = new Set(); const plzFromPois = new Set();
  ALL_MARKERS = []; // reset

  // Kategorien leeren
  Object.values(categoryLayers).forEach(grp => map.removeLayer(grp));
  for (const key of Object.keys(categoryLayers)) delete categoryLayers[key];
  for (const key of Object.keys(layerStates)) delete layerStates[key];

  for (const poi of data){
    if (poi.POI) poiNames.add(poi.POI);
    if (poi.PLZ) plzFromPois.add(poi.PLZ);

    const [x,y] = poi.Lage || [0,0];
    const { lat, lng } = toMap(x,y);

    const bmaVal   = (poi.BMA || poi['BMA'] || '').toString().trim().toLowerCase();
    const hasBma   = bmaVal === 'ja';
    const iconUrl  = poi.ICON || '';

    const iconAvailable = await isIconAvailable(iconUrl);
    const leftHtml = iconAvailable
      ? `<img src="${iconUrl}" class="poi-img-icon" alt="${poi.POI || ''}" />`
      : `<span class="plz-box-icon"><span>??</span></span>`;
const bmaHtml = hasBma
  ? `<img src="https://i.postimg.cc/RFZ23TVC/BMA.gif"
           class="bma-symbol"
           alt="BMA"
           style="margin-top:35px;" />`
  : ``;


    const markerHTML = `<div class="marker-wrap">${leftHtml}${bmaHtml}</div>`;
    const icon = L.divIcon({ html: markerHTML, className:'', iconSize: null, iconAnchor:[0,0], popupAnchor:[0,-20] });

    const marker = L.marker([lat,lng], { icon });
    marker.on('click', () => openInfoModalFromPOI(poi));

    marker.poiName = (poi.POI||'').toLowerCase();
    marker.plz     = (poi.PLZ||'').toLowerCase();
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

  // Sidebar-Filter
  buildFilterPanelFromCategories();

  // >>> Autocomplete aktualisieren (POIs + alle PLZ)
  rebuildAcData(poiNames, plzFromPois);

  // BMA-Visibility anwenden
  applyBmaToggle();
}

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

/* ================== BMA-Icon ein/aus ================== */
function applyBmaToggle(){
  const on = !!bmaToggleEl?.checked;
  document.querySelectorAll('.bma-symbol').forEach(el=>{ el.style.display = on ? 'inline-block' : 'none'; });
}

/* ================== Suche ================== */
function performSearch(raw){
  const q = (raw||'').trim().toLowerCase(); if (!q) return;

  // 1) POI exakter Name
  const exactPoi = ALL_MARKERS.find(m=>m.poiName===q);
  if (exactPoi){ map.setView(exactPoi.getLatLng(),5); exactPoi._icon?.classList.add('blinking'); setTimeout(()=>exactPoi._icon?.classList.remove('blinking'), 3000); return; }

  // 2) PLZ im aktuellen Ausschnitt
  const plzMatches = plzLayer.getLayers().filter(m=>m.plz===q);
  if (plzMatches.length){
    const group = L.featureGroup(plzMatches);
    map.fitBounds(group.getBounds(), { maxZoom:5, padding:[20,20] });
    plzMatches.forEach(m=>m._icon?.classList.add('blinking'));
    setTimeout(()=>plzMatches.forEach(m=>m._icon?.classList.remove('blinking')), 3000);
    return;
  }

  // 3) PLZ global
  const matchPlz = PLZ_DATA.find(p=>p.code.toLowerCase()===q);
  if (matchPlz){
    const tempIcon = L.divIcon({ className:'plz-box-icon', html:`<span>${matchPlz.code}</span>`, iconSize:[40,20], iconAnchor:[20,10] });
    const temp = L.marker([matchPlz.lat,matchPlz.lng], { icon: tempIcon, zIndexOffset: 1000 }).addTo(highlightLayer);
    map.setView([matchPlz.lat,matchPlz.lng], 5);
    setTimeout(()=>temp._icon?.classList.add('blinking'),0);
    setTimeout(()=>highlightLayer.removeLayer(temp), 3000);
  }
}

/* ================== Autocomplete-Daten füllen ================== */
function rebuildAcData(poiNamesSet=null, plzSetFromPoi=null){
  const poiNames = poiNamesSet ? Array.from(poiNamesSet) : [];
  const plzCodes = new Set(PLZ_DATA.map(p=>p.code));
  if (plzSetFromPoi) for (const z of plzSetFromPoi) plzCodes.add(String(z));

  AC_DATA = [
    ...poiNames.map(v=>({ value:String(v), kind:'poi' })),
    ...Array.from(plzCodes).map(v=>({ value:String(v), kind:'plz' }))
  ].sort((a,b)=>a.value.localeCompare(b.value,'de'));
}

/* ================== Clear ================== */
clearBtn.addEventListener('click', ()=>{
  searchBox.value = '';
  hideAc();
  map.setView([(mapRef1.lat+mapRef2.lat)/2, (mapRef1.lng+mapRef2.lng)/2], minZoom);
});
