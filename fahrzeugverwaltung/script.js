let vehicles = [], current = null, editing = false;
let beladungEditing = false;

// Google Apps Script URL
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzHdUx9PO27502Aar4wl6dm8ILj-dbIdSMegvNNY7pf61E5-3yTnew1JPGrhFJ1KkgU2A/exec";

// Daten laden
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
      li.innerHTML = `<div>${v['Fahrzeugbezeichnung']}</div><small>${v['Kennzeichen']}</small>`;
      li.onclick = () => showVehicle(v);
      details.appendChild(li);
    });
    wrap.appendChild(details);
  });
}

function showVehicle(v) {
  current = v;
  originalRecord = { ...v };
  setVal('kategorie', v['Kategorie']);
  setVal('fahrzeugbez', v['Fahrzeugbezeichnung']);
  setVal('taktisch', v['Taktische Bezeichnung']);
  setVal('funkruf', v['Funkrufname']);
  setVal('kennzeichen', v['Kennzeichen']);
  setVal('fahrgestell', v['Fahrgestell']);
  setVal('aufbau', v['Aufbau']);
  setVal('km', v['km']);
  setVal('status', v['Status']);
  setVal('sitze', v['Anzahl-Sitzplätze']);
  setVal('type', v['Type']);
  setVal('fzgtype', v['FZG-Type']);
  setVal('letzte', v['Letzte Überprüfung']);
  setVal('naechste', v['Nächste Überprüfung']);
  document.getElementById('fahrzeugbild').src = v['Fahrzeugbild'] || 'https://placehold.co/800x500';
  updateBadge(v['Letzte Überprüfung'], v['Nächste Überprüfung']);
  renderBeladung();
  renderEntries();
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.tagName === "SELECT") el.value = val || el.options[0].value;
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
  current = null;
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
      fields.forEach(id => { current[mapping[id]] = document.getElementById(id).value; });
      updateBadge(current['Letzte Überprüfung'], current['Nächste Überprüfung']);
      await saveRowChanges(current);
    }
  }
}

/* Beladung */
function toggleBeladungEdit() {
  beladungEditing = !beladungEditing;
  const btn = document.getElementById("beladung-edit-btn");
  if (beladungEditing) { btn.textContent = "Speichern"; btn.className = "btn-green"; }
  else { btn.textContent = "Bearbeiten"; btn.className = "btn-red"; saveRowChanges(current); }
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
  const arr=current["Beladung"].split("\n"); const m=arr[i].match(/^(\d+)x\s*(.+)$/);
  let oldMenge=m?m[1]:"1"; let oldName=m?m[2]:"";
  arr[i]=`${menge||oldMenge}x ${name||oldName}`; current["Beladung"]=arr.join("\n");
}
function removeBeladung(i) {
  const arr=current["Beladung"].split("\n"); arr.splice(i,1); current["Beladung"]=arr.join("\n"); renderBeladung();
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
  await saveRowChanges(current); // sofort speichern
}

/* Neu: nur geänderte Felder senden */
async function saveRowChanges(record) {
  if (!record) return;

  const idx = vehicles.findIndex(v => v['Kennzeichen'] === record['Kennzeichen']);
  if (idx === -1) return;
  const rowIndex = idx + 2; // Header + 1-based

  let changes = {};
  Object.keys(record).forEach(k => {
    if (record[k] !== vehicles[idx][k]) {
      changes[k] = record[k];
    }
  });

  if (Object.keys(changes).length === 0) {
    console.log("Keine Änderungen – nix gesendet.");
    return;
  }

  const payload = { row: rowIndex, changes };

  try {
    const resp = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" }
    });
    const data = await resp.json();
    console.log("Antwort:", data);
    if (data.success) {
      vehicles[idx] = { ...vehicles[idx], ...changes };
    }
  } catch (err) {
    console.error("Fehler beim Speichern:", err);
  }
}

loadData();
