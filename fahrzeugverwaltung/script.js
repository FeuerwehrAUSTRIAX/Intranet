let vehicles = [], current = null, currentIdx = -1;
let editing = false, beladungEditing = false;

// Google Apps Script URL
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzHdUx9PO27502Aar4wl6dm8ILj-dbIdSMegvNNY7pf61E5-3yTnew1JPGrhFJ1KkgU2A/exec";

// CSV-Daten laden
async function loadData() {
  try {
    const url = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQJhQbJMxG8s7oSw__c97Z55koBtE2Dlgc0OYR8idpZtdTq3o9g7LbmyEve3KPNkV5yaRZGIHVjJPkk/pub?gid=38083317&single=true&output=csv';
    const text = await (await fetch(url)).text();
    const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
    vehicles = data || [];
    buildCategories();
  } catch (err) {
    console.error("Fehler beim Laden der CSV:", err);
  }
}

function buildCategories() {
  const wrap = document.getElementById('cat-wrap');
  wrap.innerHTML = '';
  const groups = vehicles.reduce((a, v) => {
    const k = v['Kategorie'] || 'Sonstige';
    (a[k] || (a[k] = [])).push(v);
    return a;
  }, {});
  Object.keys(groups).forEach(cat => {
    const details = document.createElement('details');
    details.className = 'category';
    const sum = document.createElement('summary');
    sum.textContent = cat;
    details.appendChild(sum);
    groups[cat].forEach(v => {
      const li = document.createElement('div');
      li.className = 'vehicle-item';
      li.innerHTML = `<div>${v['Fahrzeugbezeichnung'] || ''}</div><small>${v['Kennzeichen'] || ''}</small>`;
      li.onclick = () => showVehicle(v);
      details.appendChild(li);
    });
    wrap.appendChild(details);
  });
}

function showVehicle(v) {
  currentIdx = vehicles.indexOf(v);
  current = { ...v }; // eigenständige Kopie zum Bearbeiten

  setVal('kategorie', current['Kategorie']);
  setVal('fahrzeugbez', current['Fahrzeugbezeichnung']);
  setVal('taktisch', current['Taktische Bezeichnung']);
  setVal('funkruf', current['Funkrufname']);
  setVal('kennzeichen', current['Kennzeichen']);
  setVal('fahrgestell', current['Fahrgestell']);
  setVal('aufbau', current['Aufbau']);
  setVal('km', current['km']);
  setVal('status', current['Status']);
  setVal('sitze', current['Anzahl-Sitzplätze']);
  setVal('type', current['Type']);
  setVal('fzgtype', current['FZG-Type']);
  setVal('letzte', current['Letzte Überprüfung']);
  setVal('naechste', current['Nächste Überprüfung']);
  document.getElementById('fahrzeugbild').src = current['Fahrzeugbild'] || 'https://placehold.co/800x500';

  updateBadge(current['Letzte Überprüfung'], current['Nächste Überprüfung']);
  renderBeladung();
  renderEntries();
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.tagName === "SELECT") el.value = val || el.options[0]?.value || '';
  else el.value = val || '';
}

function updateBadge(letzte, naechste) {
  const badge = document.getElementById('status-badge');
  const next = parseDate(naechste);
  if (!next) { badge.className = 'pickerl-status warn'; badge.textContent = 'Unbekannt'; return; }
  const today = new Date();
  if (today > next) { badge.className = 'pickerl-status err'; badge.textContent = 'Abgelaufen'; }
  else if ((next - today) / (1000 * 3600 * 24) <= 30) { badge.className = 'pickerl-status warn'; badge.textContent = 'Bald fällig'; }
  else { badge.className = 'pickerl-status ok'; badge.textContent = 'Gültig'; }
}
function parseDate(s) { if (!s) return null; const p = s.split('.'); if (p.length !== 3) return null; return new Date(p[2], p[1] - 1, p[0]); }

function filterVehicles() {
  const q = document.getElementById('search').value.toLowerCase();
  document.querySelectorAll('.vehicle-item').forEach(li => { li.style.display = li.textContent.toLowerCase().includes(q) ? '' : 'none'; });
}

function newVehicle() {
  currentIdx = -1;
  current = {
    'Kategorie':'',
    'Fahrzeugbezeichnung':'',
    'Taktische Bezeichnung':'',
    'Funkrufname':'',
    'Kennzeichen':'',
    'Fahrgestell':'',
    'Aufbau':'',
    'km':'',
    'Status':'',
    'Anzahl-Sitzplätze':'',
    'Type':'',
    'FZG-Type':'',
    'Letzte Überprüfung':'',
    'Nächste Überprüfung':'',
    'Fahrzeugbild':'',
    'Beladung':'',
    'Daten-Allgemein':''
  };
  ['kategorie','fahrzeugbez','taktisch','funkruf','kennzeichen','fahrgestell','aufbau','km','status','sitze','type','fzgtype','letzte','naechste']
    .forEach(id => setVal(id, ''));
  document.getElementById('fahrzeugbild').src = 'https://placehold.co/800x500';
  document.getElementById('beladung-list').innerHTML = '';
  document.getElementById('daten-entries').innerHTML = '';
  updateBadge('', '');
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.view').forEach(v => v.style.display = (v.id === 'tab-content-' + name) ? 'block' : 'none');
}

/* Grunddaten Bearbeiten/Speichern */
const mapping = {
  kategorie:'Kategorie',fahrzeugbez:'Fahrzeugbezeichnung',taktisch:'Taktische Bezeichnung',
  funkruf:'Funkrufname',kennzeichen:'Kennzeichen',fahrgestell:'Fahrgestell',
  aufbau:'Aufbau',km:'km',status:'Status',sitze:'Anzahl-Sitzplätze',
  type:'Type',fzgtype:'FZG-Type',letzte:'Letzte Überprüfung',naechste:'Nächste Überprüfung'
};

async function toggleEdit() {
  editing = !editing;
  const fields = Object.keys(mapping);
  fields.forEach(id => { document.getElementById(id).disabled = !editing; });
  const btn = document.getElementById("edit-btn");
  if (editing) {
    btn.textContent = "Speichern";
    btn.className = "btn-green";
  } else {
    btn.textContent = "Bearbeiten";
    btn.className = "btn-red";
    if (current) {
      // Eingabefelder zurück ins aktuelle Objekt schreiben
      fields.forEach(id => { current[mapping[id]] = document.getElementById(id).value; });
      updateBadge(current['Letzte Überprüfung'], current['Nächste Überprüfung']);
      await saveRow(current); // komplette Zeile speichern (ersetzen/anhängen)
    }
  }
}

/* Beladung */
function toggleBeladungEdit() {
  beladungEditing = !beladungEditing;
  const btn = document.getElementById("beladung-edit-btn");
  if (beladungEditing) { btn.textContent = "Speichern"; btn.className = "btn-green"; }
  else { btn.textContent = "Bearbeiten"; btn.className = "btn-red"; saveRow(current); }
  renderBeladung();
}
function renderBeladung() {
  const wrap = document.getElementById("beladung-list"); wrap.innerHTML = ""; if (!current) return;
  const raw = current["Beladung"] || ""; const items = raw.split('\n').filter(Boolean);
  items.forEach((line,i) => {
    const m = line.match(/^(\d+)x\s*(.+)$/); let menge=m?m[1]:""; let name=m?m[2]:line;
    if (beladungEditing) {
      const row=document.createElement("div"); row.className="form"; row.style.gridTemplateColumns="80px 1fr 80px";
      row.innerHTML=`<input value="${menge}" onchange="updateBeladung(${i}, this.value, null)">
                     <input value="${name}" onchange="updateBeladung(${i}, null, this.value)">
                     <button class="btn-red" onclick="removeBeladung(${i})">Löschen</button>`;
      wrap.appendChild(row);
    } else {
      const div=document.createElement("div"); div.className="beladung-item";
      div.innerHTML=`<div class="menge">${menge}x</div><div>${name}</div>`; wrap.appendChild(div);
    }
  });
  if (beladungEditing) {
    const addBtn=document.createElement("button"); addBtn.className="btn-green"; addBtn.textContent="+ Neu";
    addBtn.onclick=()=>{items.push("1x Neuer Gegenstand"); current["Beladung"]=items.join("\n"); renderBeladung();};
    wrap.appendChild(addBtn);
  }
}
function updateBeladung(i, menge, name) {
  const arr=(current["Beladung"]||"").split("\n").filter(Boolean);
  const line = arr[i] || "1x Neuer Gegenstand";
  const m = line.match(/^(\d+)x\s*(.+)$/);
  let oldMenge=m?m[1]:"1"; let oldName=m?m[2]:"";
  arr[i]=`${menge||oldMenge}x ${name||oldName}`;
  current["Beladung"]=arr.join("\n");
}
function removeBeladung(i) {
  const arr=(current["Beladung"]||"").split("\n").filter(Boolean);
  arr.splice(i,1);
  current["Beladung"]=arr.join("\n");
  renderBeladung();
}

/* Daten/Einträge */
function renderEntries() {
  const wrap=document.getElementById("daten-entries"); wrap.innerHTML=""; if (!current) return;
  const raw=current["Daten-Allgemein"]||""; const lines=raw.split("\n").filter(Boolean);
  lines.forEach(line => {
    const div=document.createElement("div"); div.className="entry";
    const parts=line.split(" | ");
    div.innerHTML=`<div class="meta">${parts[0]||""}</div><div>${parts[1]||""}</div><div>${parts[2]||""}</div>`;
    wrap.insertBefore(div,wrap.firstChild);
  });
}
function openModal() { document.getElementById("entry-modal").style.display="flex"; }
function closeModal() { document.getElementById("entry-modal").style.display="none"; }
async function saveEntry() {
  const vor=document.getElementById("data-vor").value.trim();
  const nach=document.getElementById("data-nach").value.trim();
  const info=document.getElementById("data-info").value.trim();
  if(!vor||!nach||!info)return;
  const ts=new Date().toLocaleString("de-DE");
  const newLine=`${ts} | ${vor} ${nach} | ${info}`;
  const raw=current["Daten-Allgemein"]||""; const lines=raw.split("\n").filter(Boolean); lines.push(newLine);
  current["Daten-Allgemein"]=lines.join("\n"); renderEntries(); closeModal();
  await saveRow(current); // volle Zeile sofort speichern
}

/* Speichern: Form-POST (x-www-form-urlencoded), kein Preflight/CORS */
async function saveRow(record) {
  if (!record) return;

  // vorhandenes Fahrzeug -> ersetze; neues -> anhängen
  const rowIndex = currentIdx >= 0 ? (currentIdx + 2) : 0;

  // wie in deinem Beispiel: URLSearchParams + Feld "json"
  const formBody = new URLSearchParams({
    json: JSON.stringify({ row: rowIndex, record })
  });

  try {
    const resp = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody
    });

    // tolerant lesen (kann JSON oder Text sein)
    let payload = null;
    const text = await resp.text();
    try { payload = JSON.parse(text); } catch (_) { payload = { raw: text }; }

    if (!resp.ok) {
      console.error("Speicherfehler:", resp.status, payload);
      return;
    }

    // Lokal/Anzeige aktualisieren
    if (currentIdx >= 0) {
      vehicles[currentIdx] = { ...record };
    } else {
      vehicles.push({ ...record });
      currentIdx = vehicles.length - 1;
    }
    buildCategories();

    const key = record['Kennzeichen'];
    const match = vehicles.find(v => v['Kennzeichen'] === key)
               || vehicles.find(v => v['Fahrzeugbezeichnung'] === record['Fahrzeugbezeichnung']);
    if (match) showVehicle(match);

    // CSV-Publish kann minimal verzögert sein
    setTimeout(loadData, 1200);
  } catch (err) {
    console.error("Fehler beim Speichern (Client):", err);
  }
}

loadData();
