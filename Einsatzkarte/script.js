/* ===========================================
 * Einsatzkarte – script.js (Marker-Slider & Modal)
 * =========================================== */

/* ================== Projektion / Grundwerte ================== */
const tileSize = 256, minZoom = 0, maxZoom = 5;
const size = tileSize * Math.pow(2, maxZoom);

const mapRef1 = { lng: 34.90625, lat: -7.62500 };
const gtaRef1 = { x: -4000, y: 8000 };
const mapRef2 = { lng: 241.12500, lat: -255.1875 };
const gtaRef2 = { x: 6000, y: -4000 };

const scaleX = (mapRef2.lng - mapRef1.lng) / (gtaRef2.x - gtaRef1.x);
const scaleY = (mapRef2.lat - mapRef1.lat) / (gtaRef2.y - gtaRef1.y);

function toMap(x, y){
  return {
    lng: mapRef1.lng + (x - gtaRef1.x) * scaleX,
    lat: mapRef1.lat + (y - gtaRef1.y) * scaleY
  };
}
function fromMap(lat, lng){
  return {
    x: Math.round(gtaRef1.x + (lng - mapRef1.lng) / scaleX),
    y: Math.round(gtaRef1.y + (lat - mapRef1.lat) / scaleY)
  };
}

/* ================== Karte ================== */
const map = L.map('map', { crs: L.CRS.Simple, minZoom, maxZoom });
const sw = map.unproject([0, size], maxZoom);
const ne = map.unproject([size, 0], maxZoom);
const bounds = L.latLngBounds(sw, ne);
map.setMaxBounds(bounds).fitBounds(bounds);

L.tileLayer('tiles/{z}/{x}/{y}.jpg', {
  tileSize, minZoom, maxZoom, noWrap: true, bounds,
  attribution: '© FeuerwehrAUSTRIAX'
}).addTo(map);

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
  } else {
    fallbackCopy(text);
  }
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
const reloadBtn    = document.getElementById('reloadBtn');

document.getElementById("categoryFilterHeader").addEventListener("click", function(){
  const contentDiv = document.getElementById("categoryFilterContent");
  const toggleArrow = document.getElementById("toggleArrow");
  const open = contentDiv.style.display === "block";
  contentDiv.style.display = open ? "none" : "block";
  toggleArrow.innerText = open ? "►" : "▼";
});

/* ================== Marker-Höhe (Slider) ================== */
const markerSizeRange = document.getElementById('markerSizeRange');
const markerSizeValue = document.getElementById('markerSizeValue');
if (markerSizeRange) {
  const setSize = (px) => {
    document.documentElement.style.setProperty('--marker-h', px + 'px');
    if (markerSizeValue) markerSizeValue.textContent = px + ' px';
  };
  setSize(markerSizeRange.value);
  markerSizeRange.addEventListener('input', () => setSize(markerSizeRange.value));
}

/* ================== Modal (Brandschutzplan/Bild) ================== */
const modalOverlay = document.getElementById('modalOverlay');
const modalHeader  = document.getElementById('modalHeader');
const modalBody    = document.getElementById('modalBody');
const closeModalBtn= document.getElementById('closeModalBtn');

function openModal(title, contentNodeOrHtml){
  modalHeader.textContent = title || '';
  modalBody.innerHTML = '';
  if (typeof contentNodeOrHtml === 'string') {
    modalBody.innerHTML = contentNodeOrHtml;
  } else if (contentNodeOrHtml) {
    modalBody.appendChild(contentNodeOrHtml);
  }
  modalOverlay.style.display = 'grid';
}
function closeModal(e){
  if (e && e.target && e.target !== modalOverlay && e.target !== closeModalBtn) return;
  modalOverlay.style.display = 'none';
  modalBody.innerHTML = '';
}
modalOverlay?.addEventListener('click', closeModal);
closeModalBtn?.addEventListener('click', closeModal);
document.addEventListener('keydown', e=>{ if (e.key === 'Escape' && modalOverlay.style.display !== 'none') closeModal(); });

function looksLikeImage(url){ return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(url); }
function openPlan(url){
  if (!url) return;
  const html = looksLikeImage(url)
    ? `<img src="${url}" alt="Plan" style="width:100%;height:100%;object-fit:contain;background:#111;">`
    : `<iframe src="${url}" title="Plan" style="width:100%;height:100%;border:0;background:#111;"></iframe>`;
  openModal('Brandschutzplan', html);
}

/* ================== Autocomplete ================== */
const AC_MAX = 8;
let AC_DATA = []; // { value, kind: 'poi'|'plz' }
let acIndex = -1;
const acBox = document.createElement('div'); acBox.id = 'acBox'; document.body.appendChild(acBox);

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
    row.textContent = it.value; row.title = it.value;
    row.dataset.value = it.value; row.dataset.kind = it.kind;
    const tag = document.createElement('span'); tag.className='tag'; tag.textContent = it.kind==='plz'?'PLZ':'POI';
    row.appendChild(tag);
    row.addEventListener('mouseenter', ()=>setAcIndex(i));
    row.addEventListener('mousedown', e=>{ e.preventDefault(); chooseSuggestion(i); });
    acBox.appendChild(row);
  });
  setAcIndex(items.length?0:-1);
  positionAcBox();
  acBox.style.display = items.length ? 'block' : 'none';
}
function setAcIndex(i){
  acIndex = i;
  [...acBox.children].forEach((el,idx)=>{ el.style.background = idx===acIndex ? '#e8f0fe' : '#fff'; });
}
function hideAc(){ acBox.style.display='none'; acIndex=-1; }

searchBox.addEventListener('input', ()=>{
  const q = searchBox.value.trim().toLowerCase();
  if (q.length < 4){ hideAc(); return; }
  const list = AC_DATA
    .filter(it => it.kind==='plz' ? it.value.toLowerCase().startsWith(q) : it.value.toLowerCase().includes(q))
    .slice(0, AC_MAX);
  renderAc(list);
});
searchBox.addEventListener('blur', ()=>setTimeout(hideAc,100));
searchBox.addEventListener('keydown', e=>{
  const visible = acBox.style.display==='block';
  if (!visible){
    if (e.key==='Enter'){ e.preventDefault(); performSearch(searchBox.value.trim()); }
    return;
  }
  if (e.key==='ArrowDown'){ e.preventDefault(); if (acBox.children.length) setAcIndex((acIndex+1)%acBox.children.length); }
  else if (e.key==='ArrowUp'){ e.preventDefault(); if (acBox.children.length) setAcIndex((acIndex-1+acBox.children.length)%acBox.children.length); }
  else if (e.key==='Enter'){ e.preventDefault(); if (acIndex<0 && acBox.children.length) setAcIndex(0); if (acIndex>=0) chooseSuggestion(acIndex); }
  else if (e.key==='Escape'){ hideAc(); }
});
function chooseSuggestion(i){
  const row = acBox.children[i]; if (!row) return;
  const val = row.dataset.value || ''; hideAc(); searchBox.value = val; performSearch(val);
}

/* ================== Ebenen / Daten ================== */
const categoryLayers = {};  // { Kategorie: L.layerGroup() }
const layerStates = {};     // { Kategorie: true/false }
const highlightLayer = L.layerGroup().addTo(map);
const plzLayer = L.layerGroup(); // per Toggle sichtbar
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
function slugify(s){
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g, '');
}
function escapeHtml(s){
  return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#39;');
}
function nl2br(s){ return String(s||'').replace(/\r?\n/g, '<br>'); }

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
  rebuildAcData(); // PLZ in Vorschläge aufnehmen
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

  // Kategorien neu aufbauen
  Object.values(categoryLayers).forEach(grp => map.removeLayer(grp));
  for (const key of Object.keys(categoryLayers)) delete categoryLayers[key];
  for (const key of Object.keys(layerStates)) delete layerStates[key];

  for (const poi of data){
    if (poi.POI) poiNames.add(poi.POI);
    if (poi.PLZ) plzFromPois.add(poi.PLZ);

    const [x,y] = poi.Lage || [0,0];
    const { lat, lng } = toMap(x,y);

    // --- Felder aus JSON (robust) ---
    const bmaVal   = (poi.BMA || poi['BMA'] || '').toString().trim().toLowerCase();
    const hasBma   = bmaVal === 'ja';
    const bmaCode  = poi['BMA-Code'] || poi.BMA_Code || '';
    const planUrl  = poi.Brandschutzplan || poi['Brandschutzplan'] || '';
    const objekt   = poi.Objektbild || poi['Objektbild'] || '';
    const besond   = poi.Besonderheit || poi['Besonderheit'] || '';
    const kontakt  = poi.Kontaktdaten || poi['Kontaktdaten'] || '';
    const iconUrl  = poi.ICON || poi.Icon || '';

    const iconAvailable = await isIconAvailable(iconUrl);
    const leftHtml = iconAvailable
      ? `<img src="${iconUrl}" class="poi-img-icon" alt="${escapeHtml(poi.POI||'')}" />`
      : `<span class="plz-box-icon"><span>??</span></span>`;
    const bmaHtml  = hasBma
      ? `<img src="https://i.postimg.cc/RFZ23TVC/BMA.gif" class="bma-symbol" alt="BMA" />`
      : ``;

    const markerHTML = `<div class="custom-marker">${leftHtml}${bmaHtml}</div>`;
    const icon = L.divIcon({ html: markerHTML, className:'', iconSize:null, iconAnchor:[16,16], popupAnchor:[0,-20] });

    const adresse = `${poi.Adresse_Strasse||''} ${poi.Hausnummer||''}, ${poi.PLZ||''} ${poi.Bezirk||''}`
      .replace(/\s+,/g, ',').replace(/^\s*,\s*|\s*,\s*$/g, '').trim();

    // --- Popup ---
    let popup = `
      <h3>${escapeHtml(poi.POI||'')}</h3>
      <table>
        <tr><td>Kategorie</td><td>${escapeHtml(poi.Kategorie||'')}</td></tr>
        <tr><td>Adresse</td><td>${escapeHtml(adresse)}</td></tr>
      </table>
    `;

    if (hasBma) {
      popup += `
        <table>
          ${bmaCode ? `<tr><td>BMA-Code</td><td>${escapeHtml(bmaCode)}</td></tr>` : ``}
          ${
            planUrl
              ? `<tr><td>Brandschutzplan</td><td><a href="#" onclick="openPlan('${String(planUrl).replace(/'/g, "\\'")}');return false;">Anzeigen</a></td></tr>`
              : ``
          }
        </table>
      `;
    }

    if (objekt) {
      popup += `<img src="${objekt}" alt="Objektbild" style="width:100%;max-height:220px;object-fit:cover;border-radius:6px;margin-top:10px;">`;
    }

    if (besond) {
      popup += `
        <div class="popup-section" style="margin-top:10px;">
          <div class="section-content">
            <strong>Besonderheiten</strong><br>${nl2br(besond)}
          </div>
        </div>
      `;
    }

    if (kontakt) {
      const rows = String(kontakt).split(/\r?\n/).filter(l=>l.trim()!=='').map(line=>{
        const parts = line.split(/Tel\.:/i);
        const left = (parts[0]||'').trim();
        const right = (parts[1]||'').trim();
        return `<tr>
                  <td style="padding:6px;border:1px solid #444;color:#fff;text-align:center;">${escapeHtml(left)}</td>
                  <td style="padding:6px;border:1px solid #444;text-align:center;">${escapeHtml(right)}</td>
                </tr>`;
      }).join('');
      popup += `
        <div class="popup-section" style="margin-top:10px;">
          <div class="section-content">
            <strong>Kontaktdaten</strong>
            <table style="width:100%;border-collapse:collapse;margin-top:6px;">
              <tr>
                <th style="padding:6px;border:1px solid #444;color:#fff;text-align:center;">Position / Name</th>
                <th style="padding:6px;border:1px solid #444;text-align:center;">Telefonnummer</th>
              </tr>
              ${rows}
            </table>
          </div>
        </div>
      `;
    }

    popup += `<button onclick="this.closest('.leaflet-popup').querySelector('.leaflet-popup-close-button').click()">Schließen</button>`;

    const marker = L.marker([lat,lng],{icon}).bindPopup(popup);

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

  // Sidebar-Filter & Vorschläge
  buildFilterPanelFromCategories();
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
    line.innerHTML = `
      <input type="checkbox" id="${id}" data-cat="${encodeURIComponent(cat)}" ${layerStates[cat] ? 'checked' : ''} />
      ${escapeHtml(cat)}
    `;
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

  reloadBtn.onclick = ()=>{ loadPois(poiFilePrimary).catch(()=>loadPois(poiFileFallback)).catch(console.error); };
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
  document.querySelectorAll('.bma-symbol').forEach(el=>{
    el.style.display = on ? 'inline-block' : 'none';
  });
}

/* ================== Blink-Logik ================== */
function blinkMarker(marker, openPopup = true){
  const isPlz = !!marker._isPlz;
  const visible = !!marker._icon && (
    isPlz ? map.hasLayer(plzLayer)
          : (marker._categoryName && categoryLayers[marker._categoryName] && map.hasLayer(categoryLayers[marker._categoryName]))
  );
  if (visible){
    if (openPopup && marker.openPopup) marker.openPopup();
    marker._icon.classList.add('blinking');
    setTimeout(()=>{ if (marker._icon) marker._icon.classList.remove('blinking'); }, 10000);
    return;
  }
  const ll = marker.getLatLng();
  const temp = L.marker(ll, { icon: marker.options.icon, zIndexOffset: 1000 }).addTo(highlightLayer);
  if (openPopup){
    const content = marker.getPopup?.()?.getContent?.() ?? '';
    if (content) temp.bindPopup(content).openPopup();
  }
  setTimeout(()=>{ if (temp._icon) temp._icon.classList.add('blinking'); }, 0);
  setTimeout(()=>{ if (temp._icon) temp._icon.classList.remove('blinking'); highlightLayer.removeLayer(temp); }, 10000);
}

/* ================== Suche (Enter & Autocomplete) ================== */
function performSearch(raw){
  const q = (raw||'').trim().toLowerCase(); if (!q) return;

  // 1) POI exakter Name
  const exactPoi = ALL_MARKERS.find(m=>m.poiName===q);
  if (exactPoi){ map.setView(exactPoi.getLatLng(),5); blinkMarker(exactPoi,true); return; }

  // 2) PLZ im aktuellen Ausschnitt (nur wenn PLZ-Layer sichtbar)
  const plzMatches = plzLayer.getLayers().filter(m=>m.plz===q);
  if (plzMatches.length){
    const group = L.featureGroup(plzMatches);
    map.fitBounds(group.getBounds(), { maxZoom:5, padding:[20,20] });
    plzMatches.forEach(m=>blinkMarker(m,false));
    return;
  }

  // 3) Fallback: PLZ existiert, aber nicht im View
  const matchPlz = PLZ_DATA.find(p=>p.code.toLowerCase()===q);
  if (matchPlz){
    const tempIcon = L.divIcon({ className:'plz-box-icon', html:`<span>${matchPlz.code}</span>`, iconSize:[40,20], iconAnchor:[20,10] });
    const temp = L.marker([matchPlz.lat,matchPlz.lng], { icon: tempIcon, zIndexOffset: 1000 }).addTo(highlightLayer);
    map.setView([matchPlz.lat,matchPlz.lng], 5);
    setTimeout(()=>{ if (temp._icon) temp._icon.classList.add('blinking'); },0);
    setTimeout(()=>highlightLayer.removeLayer(temp), 10000);
    return;
  }

  console.warn('Kein Treffer für:', q);
}

/* ================== Autocomplete-Daten ================== */
function rebuildAcData(poiNamesSet=null, plzSetFromPoi=null){
  const poiNames = poiNamesSet ? Array.from(poiNamesSet) : [];
  const plzCodes = new Set(PLZ_DATA.map(p=>p.code));
  if (plzSetFromPoi) for (const z of plzSetFromPoi) plzCodes.add(z);

  AC_DATA = [
    ...poiNames.map(v=>({ value:v, kind:'poi' })),
    ...Array.from(plzCodes).map(v=>({ value:String(v), kind:'plz' }))
  ].sort((a,b)=>a.value.localeCompare(b.value,'de'));
}

/* ================== Clear & Refresh ================== */
clearBtn.addEventListener('click', ()=>{
  hideAc(); searchBox.value = '';
  map.setView([(mapRef1.lat+mapRef2.lat)/2, (mapRef1.lng+mapRef2.lng)/2], minZoom);
});
reloadBtn.addEventListener('click', ()=>{
  loadPois(poiFilePrimary).catch(()=>loadPois(poiFileFallback)).catch(console.error);
});
