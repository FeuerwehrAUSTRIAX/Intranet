/* CSV-Parsing-Funktionen */
function parseCSV(csvText) {
  const rows = csvText.split("\n").slice(1);
  return rows.map(row => {
    const cells = row.split(",");
    return cells.slice(0, 2).map(cell => cell.replace(/^"|"$/g, "").trim());
  });
}
function parseCSVFull(csvText) {
  const rows = csvText.split("\n").slice(1);
  return rows.map(row => row.split(",").map(cell => cell.replace(/^"|"$/g, "").trim()));
}

/* ---------------- Einsatzstichwörter laden ---------------- */
const sheetURLs = {
  "Brandeinsatz": "https://docs.google.com/spreadsheets/d/e/2PACX-1vQTiTQbW09ek6xRFa7YFwFWbm-Sn6WuApvVtdyxv0-FO7xmbT1hMhGw7Qswg1BrSXdVhUdReX6BlpQj/pub?gid=83995234&single=true&output=csv",
  "Technischer Einsatz": "https://docs.google.com/spreadsheets/d/e/2PACX-1vQTiTQbW09ek6xRFa7YFwFWbm-Sn6WuApvVtdyxv0-FO7xmbT1hMhGw7Qswg1BrSXdVhUdReX6BlpQj/pub?gid=280055268&single=true&output=csv",
  "Schadstoff Einsatz": "https://docs.google.com/spreadsheets/d/e/2PACX-1vQTiTQbW09ek6xRFa7YFwFWbm-Sn6WuApvVtdyxv0-FO7xmbT1hMhGw7Qswg1BrSXdVhUdReX6BlpQj/pub?gid=248619428&single=true&output=csv",
  "Sonstiger Einsatz": "https://docs.google.com/spreadsheets/d/e/2PACX-1vQTiTQbW09ek6xRFa7YFwFWbm-Sn6WuApvVtdyxv0-FO7xmbT1hMhGw7Qswg1BrSXdVhUdReX6BlpQj/pub?gid=1802989842&single=true&output=csv"
};
let loadedData = {};
async function preloadData() {
  const keys = Object.keys(sheetURLs);
  for (const key of keys) {
    const url = sheetURLs[key];
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Fehler beim Abrufen der Daten für ${key}: ${response.statusText}`);
        continue;
      }
      const csvText = await response.text();
      loadedData[key] = parseCSV(csvText);
    } catch (error) {
      console.error(`Fehler beim Laden von ${key}:`, error);
    }
  }
  console.log("Einsatzstichwörter geladen:", loadedData);
}
function displayOptions(data) {
  const optionsContainer = document.getElementById("optionsContainer");
  optionsContainer.innerHTML = "";
  data.forEach(row => {
    if (row.length < 2) return;
    const colA = row[0];
    const colB = row[1];
    const option = document.createElement("div");
    option.className = "option";
    option.textContent = `${colB} - ${colA}`;
    option.addEventListener("click", () => {
      document.getElementById("searchInput").value = option.textContent;
      optionsContainer.style.display = "none";
    });
    optionsContainer.appendChild(option);
  });
  optionsContainer.style.display = "block";
}
function showDataForActiveButton() {
  const activeButton = document.querySelector("#einsatzart-buttons .radio-button.active");
  if (activeButton) {
    const sheetName = activeButton.textContent.trim();
    if (loadedData[sheetName]) {
      displayOptions(loadedData[sheetName]);
    } else {
      console.error(`Keine Daten für ${sheetName} gefunden.`);
    }
  } else {
    console.error("Bitte eine Einsatzart auswählen.");
  }
}
document.getElementById("searchInput").addEventListener("focus", showDataForActiveButton);
document.getElementById("searchInput").addEventListener("blur", () => {
  setTimeout(() => { document.getElementById("optionsContainer").style.display = "none"; }, 200);
});
document.getElementById("searchInput").addEventListener("input", () => {
  const query = document.getElementById("searchInput").value.toLowerCase();
  document.querySelectorAll(".option").forEach(option => {
    option.style.display = option.textContent.toLowerCase().includes(query) ? "block" : "none";
  });
});
window.addEventListener("load", () => {
  preloadData().then(() => {
    console.log("Alle Einsatzarten wurden geladen und sind verfügbar.");
  });
});

/* ---------------- Autovervollständigung: Straße ---------------- */
const strassenSheetURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQTiTQbW09ek6xRFa7YFwFWbm-Sn6WuApvVtdyxv0-FO7xmbT1hMhGw7Qswg1BrSXdVhUdReX6BlpQj/pub?gid=300833420&single=true&output=csv";
let strassenListe = [];
async function loadStrassenData() {
  try {
    const response = await fetch(strassenSheetURL);
    if (!response.ok) throw new Error(`Fehler beim Laden der Straßen: ${response.statusText}`);
    const csvText = await response.text();
    strassenListe = parseCSV(csvText).map(row => row[0].trim());
  } catch (error) {
    console.error("Fehler beim Abrufen der Straßen-Daten:", error);
  }
}
function updateStreetSuggestions() {
  const input = document.getElementById("einsatzortStrasse");
  const optionsContainer = document.getElementById("strassenOptionsContainer");
  const query = input.value.toLowerCase().trim();
  optionsContainer.innerHTML = "";
  if (query.length < 2) return;
  const matchingStrassen = strassenListe.filter(street => street.toLowerCase().includes(query));
  if (matchingStrassen.length === 0) {
    optionsContainer.style.display = "none";
    return;
  }
  matchingStrassen.slice(0, 10).forEach(street => {
    const option = document.createElement("div");
    option.className = "option";
    option.textContent = street;
    option.addEventListener("click", () => {
      input.value = street;
      optionsContainer.style.display = "none";
    });
    optionsContainer.appendChild(option);
  });
  optionsContainer.style.display = "block";
}
document.getElementById("einsatzortStrasse").addEventListener("input", updateStreetSuggestions);
document.addEventListener("click", (e) => {
  if (!document.getElementById("einsatzortStrasse").contains(e.target)) {
    document.getElementById("strassenOptionsContainer").style.display = "none";
  }
});
window.addEventListener("load", async () => { await loadStrassenData(); });

/* ---------------- Autovervollständigung: Bezirk ---------------- */
const bezirkeSheetURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQTiTQbW09ek6xRFa7YFwFWbm-Sn6WuApvVtdyxv0-FO7xmbT1hMhGw7Qswg1BrSXdVhUdReX6BlpQj/pub?gid=502308633&single=true&output=csv";
let bezirkeListe = [];
async function loadBezirkeData() {
  try {
    const response = await fetch(bezirkeSheetURL);
    if (!response.ok) throw new Error(`Fehler beim Laden der Bezirke: ${response.statusText}`);
    const csvText = await response.text();
    bezirkeListe = parseCSV(csvText).map(row => row[0].trim());
  } catch (error) {
    console.error("Fehler beim Abrufen der Bezirke:", error);
  }
}
function updateBezirkSuggestions() {
  const input = document.getElementById("einsatzortBezirk");
  const optionsContainer = document.getElementById("bezirkOptionsContainer");
  const query = input.value.toLowerCase().trim();
  optionsContainer.innerHTML = "";
  if (query.length < 1) return;
  const matchingBezirke = bezirkeListe.filter(bezirk => bezirk.toLowerCase().includes(query));
  if (matchingBezirke.length === 0) {
    optionsContainer.style.display = "none";
    return;
  }
  matchingBezirke.slice(0, 10).forEach(bezirk => {
    const option = document.createElement("div");
    option.className = "option";
    option.textContent = bezirk;
    option.addEventListener("click", () => {
      input.value = bezirk;
      optionsContainer.style.display = "none";
    });
    optionsContainer.appendChild(option);
  });
  optionsContainer.style.display = "block";
}
document.getElementById("einsatzortBezirk").addEventListener("input", updateBezirkSuggestions);
document.getElementById("einsatzortBezirk").addEventListener("blur", () => {
  setTimeout(() => { document.getElementById("bezirkOptionsContainer").style.display = "none"; }, 200);
});
window.addEventListener("load", async () => { await loadBezirkeData(); });

/* ---------------- Autovervollständigung: Objekt ---------------- */
const objektSheetURL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQTiTQbW09ek6xRFa7YFwFWbm-Sn6WuApvVtdyxv0-FO7xmbT1hMhGw7Qswg1BrSXdVhUdReX6BlpQj/pub?gid=1389818837&single=true&output=csv";
let objekteListe = [];
async function loadObjekteData() {
  try {
    const response = await fetch(objektSheetURL);
    if (!response.ok) throw new Error(`Fehler beim Laden der Objekte: ${response.statusText}`);
    const csvText = await response.text();
    objekteListe = Papa.parse(csvText, { header: true, skipEmptyLines: true }).data;
    console.log("Objekte geladen:", objekteListe);
  } catch (error) {
    console.error("Fehler beim Abrufen der Objekt-Daten:", error);
  }
}
function updateObjektSuggestions() {
  const input = document.getElementById("objektSelect");
  const optionsContainer = document.getElementById("objekteOptionsContainer");
  const query = input.value.toLowerCase().trim();
  if (query === "") {
    document.getElementById("einsatzortStrasse").removeAttribute("readonly");
    document.getElementById("einsatzortPLZ").removeAttribute("readonly");
    document.getElementById("einsatzortBezirk").removeAttribute("readonly");
    optionsContainer.innerHTML = "";
    optionsContainer.style.display = "none";
    return;
  }
  optionsContainer.innerHTML = "";
  const matchingObjekte = objekteListe.filter(obj => obj["POI"]?.toLowerCase().includes(query));
  if (matchingObjekte.length === 0) {
    optionsContainer.style.display = "none";
    return;
  }
  matchingObjekte.slice(0, 10).forEach(obj => {
    const option = document.createElement("div");
    option.className = "option";
    option.textContent = obj["POI"] || "Unbekanntes Objekt";
    option.addEventListener("click", () => {
      input.value = obj["POI"] || "k.A.";
      optionsContainer.style.display = "none";
      document.getElementById("einsatzortStrasse").value = obj["Adresse Straße"] || "k.A.";
      document.getElementById("hausnummer").value = obj["Hausnummer"] || "k.A.";
      document.getElementById("einsatzortPLZ").value = obj["Adresse PLZ"] || "k.A.";
      document.getElementById("einsatzortBezirk").value = obj["Adresse Bezirk"] || "k.A.";
      document.getElementById("einsatzortStrasse").setAttribute("readonly", true);
      document.getElementById("einsatzortPLZ").setAttribute("readonly", true);
      document.getElementById("einsatzortBezirk").setAttribute("readonly", true);
    });
    optionsContainer.appendChild(option);
  });
  optionsContainer.style.display = "block";
}
document.getElementById("objektSelect").addEventListener("focus", updateObjektSuggestions);
document.getElementById("objektSelect").addEventListener("input", updateObjektSuggestions);
document.getElementById("objektSelect").addEventListener("blur", () => {
  setTimeout(() => { document.getElementById("objekteOptionsContainer").style.display = "none"; }, 200);
});
window.addEventListener("load", async () => { await loadObjekteData(); });

/* ---------------- Gemeinsame Funktion für Radio-Buttons ---------------- */
function toggleButton(button, group) {
  const buttonGroup = document.getElementById(`${group}-buttons`).querySelectorAll('.radio-button');
  buttonGroup.forEach(btn => btn.classList.remove('active'));
  button.classList.add('active');
  // NEU: Rechnungsträger-Block nur bei "Ja" oder "Unsicher" zeigen
  if (group === 'verrechenbar') updateRgVisibility();
}

/* ---------------- RG: Aus Objekt übernehmen ---------------- */
function rgFromObject() {
  // Quelle: Felder aus "Einsatzort & Objekt"
  const poi    = (document.getElementById('objektSelect')      ?.value || '').trim();
  const str    = (document.getElementById('einsatzortStrasse') ?.value || '').trim();
  const hn     = (document.getElementById('hausnummer')        ?.value || '').trim();
  const plz    = (document.getElementById('einsatzortPLZ')     ?.value || '').trim();
  const bezirk = (document.getElementById('einsatzortBezirk')  ?.value || '').trim();

  // Ziel: Rechnungsträger / Geschädigte
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };

  if (poi) set('rg_nachname', poi);
  set('rg_strasse', str);
  set('rg_hausnr',  hn);
  set('rg_plz',     plz);
  set('rg_bezirk',  bezirk);

  // Cursor sinnvoll setzen
  const firstName = document.getElementById('rg_vorname');
  if (firstName && !firstName.value) firstName.focus();
}

/* ---------------- RG: Sichtbarkeit steuern ---------------- */
function updateRgVisibility() {
  const active = document.querySelector('#verrechenbar-buttons .radio-button.active');
  const value = active ? active.textContent.trim() : '';
  const show = value === 'Ja' || value === 'Unsicher';

  const block = document.getElementById('rg-block');
  if (!block) return;

  block.style.display = show ? 'block' : 'none';
  if (!show) clearRgFields(); // Felder leeren, wenn Block verschwindet
}

function clearRgFields() {
  const ids = ['rg_vorname','rg_nachname','rg_strasse','rg_hausnr','rg_plz','rg_bezirk','rg_geb','rg_kennz','rg_kontakt'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

/* ---------------- Navigation und Progress Bar ---------------- */
let currentStep = 1;
const totalSteps = 5;
function nextSection(step) {
  if (step < totalSteps) {
    document.getElementById(`section${step}`).classList.remove("active");
    document.getElementById(`section${step+1}`).classList.add("active");
    updateProgress(step+1);
    currentStep = step+1;

    // Scrollt zum Seitenanfang mit `scrollIntoView`
    document.body.scrollIntoView({ behavior: "smooth", block: "start" });

    if (currentStep === 5) {
      updateSummary();
    }
  }
}

function prevSection(step) {
  if (step > 1) {
    document.getElementById(`section${step}`).classList.remove("active");
    document.getElementById(`section${step-1}`).classList.add("active");
    updateProgress(step-1);
    currentStep = step-1;

    // Scrollt zum Seitenanfang mit `scrollIntoView`
    document.body.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function updateProgress(step) {
  document.querySelectorAll(".step").forEach((el, index) => {
    if (index+1 === step) {
      el.classList.add("active");
      el.classList.remove("completed");
    } else if (index+1 < step) {
      el.classList.add("completed");
      el.classList.remove("active");
    } else {
      el.classList.remove("active", "completed");
    }
  });
}

/* ---------------- Modalfunktionen ---------------- */
function openModal(type) { document.getElementById('modal-' + type).classList.add("active"); }
function closeModal(type) { document.getElementById('modal-' + type).classList.remove("active"); }
function saveSelection(type) {
  const checkboxes = document.querySelectorAll('.' + type + '-option');
  const container = document.getElementById('selected-' + type);
  container.innerHTML = "";
  checkboxes.forEach(cb => {
    if (cb.checked) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.textContent = cb.value;
      const remove = document.createElement('span');
      remove.className = 'remove-chip';
      remove.innerHTML = '&times;';
      remove.onclick = () => { chip.remove(); cb.checked = false; };
      chip.appendChild(remove);
      container.appendChild(chip);
    }
  });
  closeModal(type);
}

/* ---------------- Funktionen für Verletzte (Step 2) ---------------- */
function toggleVerletzte(category, isYes, btn) {
  let containerId = "additional-" + category;
  let container = document.getElementById(containerId);
  container.style.display = isYes ? "block" : "none";
  let groupId;
  if (category === "personen") {
    groupId = "verletztePersonen-buttons";
  } else if (category === "feuerwehr") {
    groupId = "verletzteFeuerwehr-buttons";
  } else if (category === "tiere") {
    groupId = "verletzteTiere-buttons";
  }
  let buttons = document.getElementById(groupId).querySelectorAll('.radio-button');
  buttons.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

/* ---------------- Fahrzeug- & Mannschaftszuweisung ---------------- */
const vehicleCsvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQJhQbJMxG8s7oSw__c97Z55koBtE2Dlgc0OYR8idpZtdTq3o9g7LbmyEve3KPNkV5yaRZGIHVjJPkk/pub?gid=38083317&single=true&output=csv" + "&t=" + new Date().getTime();
const teamCsvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQJhQbJMxG8s7oSw__c97Z55koBtE2Dlgc0OYR8idpZtdTq3o9g7LbmyEve3KPNkV5yaRZGIHVjJPkk/pub?gid=294937836&single=true&output=csv" + "&t=" + new Date().getTime();

let vehiclesData = [];
let teamData = [];
let globalAssigned = [];
var savedAssignments = {};
let currentSeatBox = null;

// Globales Mapping: Kennzeichen → Fahrzeugbezeichnung
let vehicleMapping = {};

document.addEventListener("DOMContentLoaded", function() {
  fetch(vehicleCsvUrl)
    .then(res => res.text())
    .then(text => {
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      vehiclesData = parsed.data;
      renderVehicleList();
    })
    .catch(err => console.error("Fehler beim Laden der Fahrzeugdaten:", err));
  
  fetch(teamCsvUrl)
    .then(res => res.text())
    .then(text => {
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      teamData = parsed.data.filter(m => m["Aktives Mitglied?"] && m["Aktives Mitglied?"].toLowerCase() === "ja");
    })
    .catch(err => console.error("Fehler beim Laden der Teamdaten:", err));
});

const rolePermissions = {
  "Mannschaft": ["PFM", "FM", "OFM", "HFM", "SB", "LM", "OLM", "HLM", "BM", "OBM", "HBM", "BI", "OBI", "HBI", "ABI", "BR", "OBR", "LFR", "LBDSTV", "LBD", "VM", "OVM", "HVM", "V", "OV", "HV", "VI", "VR", "ASB", "BSB", "FARZT", "BFARZT", "LFARZT", "FJUR", "BFJUR", "LFJUR", "FKUR", "BFKUR", "LFKUR", "FT"],
  "Gruppenkommandant": ["LM", "OLM", "HLM", "BM", "OBM", "HBM", "BI", "OBI", "HBI", "ABI", "BR", "OBR", "LFR", "LBDSTV", "LBD", "VM", "OVM", "HVM", "V", "OV", "HV", "VI", "VR", "ASB", "BSB", "FARZT", "BFARZT", "LFARZT", "FJUR", "BFJUR", "LFJUR", "FKUR", "BFKUR", "LFKUR", "FT"],
  "Einsatzleiter": ["BM", "OBM", "HBM", "BI", "OBI", "HBI", "ABI", "BR", "OBR", "LFR", "LBDSTV", "LBD", "VM", "OVM", "HVM", "V", "OV", "HV", "VI", "VR", "ASB", "BSB", "FARZT", "BFARZT", "LFARZT", "FJUR", "BFJUR", "LFJUR", "FKUR", "BFKUR", "LFKUR", "FT"],
  "Maschinist": ["PFM", "FM", "OFM", "HFM", "SB", "LM", "OLM", "HLM", "BM", "OBM", "HBM", "BI", "OBI", "HBI", "ABI", "BR", "OBR", "LFR", "LBDSTV", "LBD", "VM", "OVM", "HVM", "V", "OV", "HV", "VI", "VR", "ASB", "BSB", "FARZT", "BFARZT", "LFARZT", "FJUR", "BFJUR", "LFJUR", "FKUR", "BFKUR", "LFKUR", "FT"]
};

function renderVehicleList() {
  const container = document.getElementById("vehicleList");
  container.innerHTML = "";

  // Kategorien definieren: Key = Typ in der CSV
  const categories = {
    FZG: { header: "Fahrzeuge", vehicles: [] },
    AHG: { header: "Anhänger", vehicles: [] },
    Gebäude: { header: "Gebäude", vehicles: [] }
  };

  // Fahrzeuge anhand ihres Typs in die jeweiligen Kategorien einsortieren
  vehiclesData.forEach(vehicle => {
    const type = vehicle["Type"] ? vehicle["Type"].trim() : "";
    if (categories.hasOwnProperty(type)) {
      categories[type].vehicles.push(vehicle);
    } else {
      // Optional: unbekannter Typ -> ignorieren oder "Sonstige"
    }
  });

  // Für jede Kategorie: Container + Überschrift + Fahrzeugkarten
  Object.keys(categories).forEach(categoryKey => {
    const category = categories[categoryKey];
    if (category.vehicles.length > 0) {
      const categoryContainer = document.createElement("div");
      categoryContainer.classList.add("vehicle-category-container");

      const titleEl = document.createElement("h2");
      titleEl.classList.add("vehicle-category-title");
      titleEl.textContent = category.header;
      categoryContainer.appendChild(titleEl);

      const gridEl = document.createElement("div");
      gridEl.classList.add("vehicle-grid");
      categoryContainer.appendChild(gridEl);

      category.vehicles.forEach(vehicle => {
        const kennzeichen = vehicle["Kennzeichen"] || "Unbekannt";
        const funkrufname = vehicle["Funkrufname"] || "Ohne Funkrufname";
        vehicleMapping[kennzeichen] = funkrufname;

        const status = vehicle["Status"] ? vehicle["Status"].trim() : "";
        const seats = vehicle["Anzahl-Sitzplätze"] ? parseInt(vehicle["Anzahl-Sitzplätze"]) : 0;

        const card = document.createElement("div");
        card.classList.add("vehicle-card");
        card.setAttribute("data-seats", seats);
        card.setAttribute("data-selected", "false");

        if (status === "NEB") {
          card.classList.add("disabled");
          card.style.borderColor = "red";
        } else if (status === "BEB") {
          card.style.borderColor = "orange";
        } else if (status === "EB") {
          card.style.borderColor = "green";
        }

        card.innerHTML = `
          <div class="vehicle-info">
            <strong>${funkrufname}</strong><br>
            <small>${kennzeichen}</small>
          </div>
          <button class="select-vehicle-button">Auswählen</button>
        `;

        const btn = card.querySelector(".select-vehicle-button");
        btn.addEventListener("click", function(e) {
          e.stopPropagation();
          if (!card.classList.contains("disabled")) {
            toggleVehicleSelection(card);
          }
        });

        card.addEventListener("click", function(e) {
          if (!e.target.classList.contains("select-vehicle-button") && !card.classList.contains("disabled")) {
            toggleVehicleSelection(card);
          }
        });

        gridEl.appendChild(card);
      });

      container.appendChild(categoryContainer);
    }
  });
}

function toggleVehicleSelection(card) {
  const isSelected = card.getAttribute("data-selected") === "true";
  const kennzeichen = card.querySelector(".vehicle-info small").innerText;
  if (isSelected) {
    card.setAttribute("data-selected", "false");
    card.classList.remove("selected");
    card.querySelector(".select-vehicle-button").textContent = "Auswählen";
    delete savedAssignments[kennzeichen];
  } else {
    card.setAttribute("data-selected", "true");
    card.classList.add("selected");
    card.querySelector(".select-vehicle-button").textContent = "Ausgewählt";
  }
}

function prepareTeamAssignment() {
  const container = document.getElementById("assignmentContainer");
  container.innerHTML = "";
  globalAssigned = [];
  const selectedCards = Array.from(document.querySelectorAll(".vehicle-card")).filter(card => card.getAttribute("data-selected") === "true");
  if (selectedCards.length === 0) {
    alert("Bitte wählen Sie mindestens ein Fahrzeug aus.");
    return;
  }
  selectedCards.forEach(card => {
    const kennzeichen = card.querySelector(".vehicle-info small").innerText;
    if (savedAssignments[kennzeichen]) {
      Object.values(savedAssignments[kennzeichen]).forEach(assignment => {
        globalAssigned.push(assignment.memberId);
      });
    }
  });
  renderAssignmentAccordions(selectedCards);
  nextSection(3);
}

function renderAssignmentAccordions(selectedCards) {
  const container = document.getElementById("assignmentContainer");
  selectedCards.forEach(card => {
    const kennzeichen = card.querySelector(".vehicle-info small").innerText;
    const funkrufname = card.querySelector(".vehicle-info strong").innerText;
    const seats = parseInt(card.getAttribute("data-seats"));
    const acc = document.createElement("div");
    acc.classList.add("vehicle-assignment");
    acc.innerHTML = `<h2>${funkrufname}<br><small>${kennzeichen}</small></h2>
      <div class="slot-display">Sitzplätze: 0 / ${seats}</div>
      <div class="seat-container" data-seats="${seats}" id="seat-${kennzeichen.replace(/\s/g, '')}"></div>`;
    const seatContainer = acc.querySelector(".seat-container");
    for (let i = 0; i < seats; i++) {
      const seat = document.createElement("div");
      seat.classList.add("seat");
      seat.setAttribute("data-vehicle", kennzeichen);
      seat.setAttribute("data-seat-index", i);
      if (savedAssignments[kennzeichen] && savedAssignments[kennzeichen][i]) {
        const assignment = savedAssignments[kennzeichen][i];
        seat.innerHTML = `<div class="assigned-member">
          <span class="member-name">${assignment.displayText}</span>
          <div class="member-right">
            <span class="member-role" onclick="editRole(this)">${assignment.role}</span>
            <span class="remove-assignment" onclick="removeAssignmentFromButton(event, this)">&times;</span>
          </div>
        </div>`;
        seat.setAttribute("data-assigned", "true");
        seat.setAttribute("data-role", assignment.role);
        seat.setAttribute("data-member-id", assignment.memberId);
        updateSeatColor(seat, assignment.role);
      } else {
        seat.innerHTML = `<button onclick="openTeamModal(this)">Zuweisen</button>`;
      }
      seatContainer.appendChild(seat);
    }
    container.appendChild(acc);
  });
  document.querySelectorAll(".vehicle-assignment").forEach(va => updateGlobalSlotDisplay(va));
}

function openTeamModal(button) {
  currentSeatBox = button.parentElement;
  document.getElementById("teamModal").classList.add("active");
  document.getElementById("teamSearch").value = "";
  renderTeamModalList("");
}

document.getElementById("closeTeamModal").addEventListener("click", function() {
  document.getElementById("teamModal").classList.remove("active");
});

document.getElementById("teamSearch").addEventListener("input", function() {
  const query = this.value.toLowerCase().trim();
  renderTeamModalList(query);
});

function renderTeamModalList(query) {
  const listContainer = document.getElementById("modalTeamList");
  listContainer.innerHTML = "";

  const selectedRole = document.getElementById("modalRoleSelect").value;
  const allowedRanks = rolePermissions[selectedRole] || [];

  teamData.forEach(member => {
    const id = member["Mitgliedsnummer"] || "";
    if (globalAssigned.includes(id)) return;

    const dienstgrad = member["Aktueller Dienstgrad"] || "";
    const vorname = member["Namen"] || "";
    const nachname = member["Nachnamen"] || "";
    const displayText = `${dienstgrad} - ${vorname} ${nachname}`;

    // Überprüfen, ob der Dienstgrad zur gewählten Rolle passt
    if (allowedRanks.includes(dienstgrad) && displayText.toLowerCase().includes(query)) {
      const item = document.createElement("div");
      item.classList.add("modal-team-item");
      item.textContent = displayText;

      item.addEventListener("click", function() {
        assignTeamMember(id, displayText, selectedRole);
        document.getElementById("teamModal").classList.remove("active");
      });

      listContainer.appendChild(item);
    }
  });
}

document.getElementById("modalRoleSelect").addEventListener("change", function() {
  const searchQuery = document.getElementById("teamSearch").value.toLowerCase();
  renderTeamModalList(searchQuery);
});

function assignTeamMember(memberId, displayText, role) {
  if (!currentSeatBox) return;
  currentSeatBox.innerHTML = `<div class="assigned-member">
      <span class="member-name">${displayText}</span>
      <div class="member-right">
        <span class="member-role" onclick="editRole(this)">${role}</span>
        <span class="remove-assignment" onclick="removeAssignmentFromButton(event, this)">&times;</span>
      </div>
    </div>`;
  currentSeatBox.setAttribute("data-assigned", "true");
  currentSeatBox.setAttribute("data-role", role);
  currentSeatBox.setAttribute("data-member-id", memberId);
  updateSeatColor(currentSeatBox, role);
  const vehicleKey = currentSeatBox.getAttribute("data-vehicle");
  const seatIndex = currentSeatBox.getAttribute("data-seat-index");
  if (!savedAssignments[vehicleKey]) savedAssignments[vehicleKey] = {};
  savedAssignments[vehicleKey][seatIndex] = { memberId, displayText, role };
  globalAssigned.push(memberId);
  updateGlobalSlotDisplay(currentSeatBox.closest(".vehicle-assignment"));
  sortAssignments(currentSeatBox.parentElement);
}

function removeAssignment(seat) {
  const vehicleKey = seat.getAttribute("data-vehicle");
  const seatIndex = seat.getAttribute("data-seat-index");
  const memberId = seat.getAttribute("data-member-id");
  if (savedAssignments[vehicleKey] && savedAssignments[vehicleKey][seatIndex]) {
    delete savedAssignments[vehicleKey][seatIndex];
  }
  const index = globalAssigned.indexOf(memberId);
  if (index !== -1) globalAssigned.splice(index, 1);
  seat.innerHTML = `<button onclick="openTeamModal(this)">Zuweisen</button>`;
  seat.removeAttribute("data-assigned");
  seat.removeAttribute("data-role");
  seat.removeAttribute("data-member-id");
  seat.classList.remove("role-einsatzleiter", "role-maschinist", "role-gruppenkommandant", "role-mannschaft");
  updateGlobalSlotDisplay(seat.closest(".vehicle-assignment"));
  sortAssignments(seat.parentElement);
}

function removeAssignmentFromButton(e, btn) { e.stopPropagation(); const seat = btn.closest('.seat'); removeAssignment(seat); }

function editRole(roleSpan) {
  const currentRole = roleSpan.textContent;
  const select = document.createElement("select");
  select.innerHTML = `
    <option value="Einsatzleiter" ${currentRole === "Einsatzleiter" ? "selected" : ""}>Einsatzleiter</option>
    <option value="Maschinist" ${currentRole === "Maschinist" ? "selected" : ""}>Maschinist</option>
    <option value="Gruppenkommandant" ${currentRole === "Gruppenkommandant" ? "selected" : ""}>Gruppenkommandant</option>
    <option value="Mannschaft" ${currentRole === "Mannschaft" ? "selected" : ""}>Mannschaft</option>
  `;
  roleSpan.parentElement.replaceChild(select, roleSpan);
  select.focus();
  select.addEventListener("change", function() { updateRole(select); });
  select.addEventListener("blur", function() { updateRole(select); });
}

function updateRole(selectElement) {
  const newRole = selectElement.value;
  const seat = selectElement.closest('.seat');
  const memberId = seat.getAttribute("data-member-id");
  const vehicleKey = seat.getAttribute("data-vehicle");
  const seatIndex = seat.getAttribute("data-seat-index");

  const member = teamData.find(m => m["Mitgliedsnummer"] === memberId);
  const dienstgrad = member ? member["Aktueller Dienstgrad"] : "";

  if (!rolePermissions[newRole].includes(dienstgrad)) {
    alert(`Der Dienstgrad ${dienstgrad} ist nicht für die Rolle ${newRole} freigegeben.`);
    selectElement.value = seat.getAttribute("data-role");
    return;
  }

  const newSpan = document.createElement("span");
  newSpan.classList.add("member-role");
  newSpan.textContent = newRole;
  newSpan.setAttribute("onclick", "editRole(this)");

  if (savedAssignments[vehicleKey] && savedAssignments[vehicleKey][seatIndex]) {
    savedAssignments[vehicleKey][seatIndex].role = newRole;
  }

  selectElement.parentElement.replaceChild(newSpan, selectElement);
  seat.setAttribute("data-role", newRole);
  updateSeatColor(seat, newRole);
  updateSummary();
}

function updateSeatColor(seat, role) {
  seat.classList.remove("role-einsatzleiter", "role-maschinist", "role-gruppenkommandant", "role-mannschaft");

  if (role === "Einsatzleiter") {
    seat.style.backgroundColor = "#f1c40f";  // Gelb
  } else if (role === "Maschinist") {
    seat.style.backgroundColor = "#B0B0B0";  // Grau
    seat.style.color = "#000";              // Schwarz
  } else if (role === "Gruppenkommandant") {
    seat.style.backgroundColor = "#3498db";  // Blau
  } else {
    seat.style.backgroundColor = "#e74c3c";  // Rot
  }

  console.log("Manuelle Farbänderung:", seat.style.backgroundColor);
}

function sortAssignments(seatContainer) {
  const rolePriority = { "Einsatzleiter": 1, "Maschinist": 2, "Gruppenkommandant": 3, "Mannschaft": 4 };
  const children = Array.from(seatContainer.children);
  const assigned = children.filter(child => child.getAttribute("data-assigned") === "true");
  const unassigned = children.filter(child => child.getAttribute("data-assigned") !== "true");
  assigned.sort((a, b) => {
    const roleA = a.getAttribute("data-role");
    const roleB = b.getAttribute("data-role");
    return rolePriority[roleA] - rolePriority[roleB];
  });
  seatContainer.innerHTML = "";
  assigned.forEach(child => seatContainer.appendChild(child));
  unassigned.forEach(child => seatContainer.appendChild(child));
}

function updateGlobalSlotDisplay(assignmentBox) {
  const seatContainer = assignmentBox.querySelector(".seat-container");
  const total = seatContainer.children.length;
  const assignedCount = Array.from(seatContainer.children).filter(child => child.getAttribute("data-assigned") === "true").length;
  const slotDisplay = assignmentBox.querySelector(".slot-display");
  slotDisplay.textContent = `Sitzplätze: ${assignedCount} / ${total}`;
}

/* ---------------- Übersicht (Step 5) – Zusammenfassung aller Daten ---------------- */
function updateSummary() {
  let datum = document.getElementById("datum").value.trim();
  let uhrzeitAlarmierung = document.getElementById("uhrzeitAlarmierung").value.trim();
  let einsatzEnde = document.getElementById("einsatzEnde").value.trim();
  let uhrzeitRueckkehr = document.getElementById("uhrzeitRueckkehr").value.trim();
  let objekt = document.getElementById("objektSelect").value.trim();
  let einsatzortBezirk = document.getElementById("einsatzortBezirk").value.trim();
  let einsatzortStrasse = document.getElementById("einsatzortStrasse").value.trim();
  let hausnummer = document.getElementById("hausnummer").value.trim();
  let einsatzortPLZ = document.getElementById("einsatzortPLZ").value.trim();
  let eigenerEinsatzbereich = document.querySelector("#einsatzbereich-buttons .radio-button.active")?.textContent.trim() || "";
  let einsatzStichwort = document.getElementById("searchInput").value.trim();
  let meldung = getChipValues("selected-meldung");
  let alarmierung = getChipValues("selected-alarmierung");
  let anwesend = getChipValues("selected-anwesend");
  let wetter = getChipValues("selected-wetter");
  let gefahrenklasse = getChipValues("selected-gefahrenklasse");
  let lageEintreffen = document.getElementById("lageEintreffen").value.trim();
  let massnahmenEinsatzort = document.getElementById("massnahmenEinsatzort").value.trim();
  let bemerkungen = document.getElementById("bemerkungen").value.trim();
  let verletztePersonen = document.getElementById("verletztePersonen")?.value.trim() || "";
  let getoetetePersonen = document.getElementById("getoetetePersonen")?.value.trim() || "";
  let gerettetePersonen = document.getElementById("gerettetePersonen")?.value.trim() || "";
  let verletzteFeuerwehr = document.getElementById("verletzteFeuerwehr")?.value.trim() || "";
  let getoeteteFeuerwehr = document.getElementById("getoeteteFeuerwehr")?.value.trim() || "";
  let geretteteFeuerwehr = document.getElementById("geretteteFeuerwehr")?.value.trim() || "";
  let verletzteTiere = document.getElementById("verletzteTiere")?.value.trim() || "";
  let getoeteteTiere = document.getElementById("getoeteteTiere")?.value.trim() || "";
  let geretteteTiere = document.getElementById("geretteteTiere")?.value.trim() || "";
  let vehicleCards = document.querySelectorAll(".vehicle-card[data-selected='true']");
  let fahrzeugeHtml = "";
  vehicleCards.forEach(card => {
    let kennzeichen = card.querySelector(".vehicle-info small").innerText;
    let fahrzeugName = vehicleMapping[kennzeichen] || kennzeichen;
    fahrzeugeHtml += `<div class="overview-item"><span class="label">Fahrzeug:</span><span contenteditable="true" onblur="updateEditable(this, null)">${fahrzeugName}</span></div>`;
  });
  let teamAssignments = [];
  for (let vehicle in savedAssignments) {
    for (let seat in savedAssignments[vehicle]) {
      let ass = savedAssignments[vehicle][seat];
      teamAssignments.push({ memberId: ass.memberId, displayText: ass.displayText, role: ass.role, vehicle: vehicleMapping[vehicle] || vehicle });
    }
  }
  let uniqueMannschaft = {};
  teamAssignments.forEach(a => { uniqueMannschaft[a.memberId] = a; });
  let mannschaftHtml = "";
  for (let id in uniqueMannschaft) {
    let a = uniqueMannschaft[id];
    mannschaftHtml += `<li contenteditable="true" onblur="updateEditable(this, null)">${a.displayText} – ${a.role}</li>`;
  }
  if(mannschaftHtml) { mannschaftHtml = "<ul>" + mannschaftHtml + "</ul>"; }
  let summaryHtml = `<div class="overview-container"><div class="overview-header"></div>`;
  summaryHtml += `<div class="overview-section">
      <h2>Grundinformationen</h2>
      <div class="overview-item"><span class="label">Eigener Einsatzbereich:</span><span contenteditable="true" onblur="updateEditable(this, 'einsatzbereich')">${eigenerEinsatzbereich}</span></div>
      <div class="overview-item"><span class="label">Einsatzstichwort:</span><span contenteditable="true" onblur="updateEditable(this, 'searchInput')">${einsatzStichwort}</span></div>
    </div>`;
  if(meldung) { summaryHtml += `<div class="overview-section"><h2>Meldung</h2><div class="overview-item"><span class="label">Meldung:</span><span contenteditable="true" onblur="updateEditable(this, 'selected-meldung')">${meldung}</span></div></div>`; }
  summaryHtml += `<div class="overview-section">
      <h2>Einsatzdetails</h2>
      <div class="overview-item"><span class="label">Datum:</span><span contenteditable="true" onblur="updateEditable(this, 'datum')">${datum}</span></div>
      <div class="overview-item"><span class="label">Alarmierungszeit:</span><span contenteditable="true" onblur="updateEditable(this, 'uhrzeitAlarmierung')">${uhrzeitAlarmierung}</span></div>
      <div class="overview-item"><span class="label">Einsatzendedatum:</span><span contenteditable="true" onblur="updateEditable(this, 'einsatzEnde')">${einsatzEnde}</span></div>
      <div class="overview-item"><span class="label">Einsatzendezeit:</span><span contenteditable="true" onblur="updateEditable(this, 'uhrzeitRueckkehr')">${uhrzeitRueckkehr}</span></div>
    </div>`;
  summaryHtml += `<div class="overview-section">
      <h2>Einsatzort & Objekt</h2>
      <div class="overview-item"><span class="label">Objekt:</span><span contenteditable="true" onblur="updateEditable(this, 'objektSelect')">${objekt}</span></div>
      <div class="overview-item"><span class="label">Straße/Hausnr.:</span><span contenteditable="true" onblur="updateEditable(this, 'einsatzortStrasse')">${einsatzortStrasse} ${hausnummer}</span></div>
      <div class="overview-item"><span class="label">PLZ:</span><span contenteditable="true" onblur="updateEditable(this, 'einsatzortPLZ')">${einsatzortPLZ}</span></div>
      <div class="overview-item"><span class="label">Bezirk:</span><span contenteditable="true" onblur="updateEditable(this, 'einsatzortBezirk')">${einsatzortBezirk}</span></div>
    </div>`;
  summaryHtml += `<div class="overview-section">
      <h2>Alarmierung & Infos</h2>
      <div class="overview-item"><span class="label">Alarmierung:</span><span contenteditable="true" onblur="updateEditable(this, 'selected-alarmierung')">${alarmierung}</span></div>
      <div class="overview-item"><span class="label">Anwesend:</span><span contenteditable="true" onblur="updateEditable(this, 'selected-anwesend')">${anwesend}</span></div>
      <div class="overview-item"><span class="label">Wetter:</span><span contenteditable="true" onblur="updateEditable(this, 'selected-wetter')">${wetter}</span></div>
      <div class="overview-item"><span class="label">Gefahrenklasse:</span><span contenteditable="true" onblur="updateEditable(this, 'selected-gefahrenklasse')">${gefahrenklasse}</span></div>
    </div>`;
  if(fahrzeugeHtml) { summaryHtml += `<div class="overview-section"><h2>Fahrzeuge</h2>${fahrzeugeHtml}</div>`; }
  if(mannschaftHtml) { summaryHtml += `<div class="overview-section"><h2>Mannschaft</h2>${mannschaftHtml}</div>`; }
  let injuredHtml = "";
  if (verletztePersonen || getoetetePersonen || gerettetePersonen) {
    injuredHtml += `<div class="overview-item"><span class="label">Personen:</span><span>Verletzt: ${verletztePersonen || '-'}, Getötet: ${getoetetePersonen || '-'}, Gerettet: ${gerettetePersonen || '-'}</span></div>`;
  }
  if (verletzteFeuerwehr || getoeteteFeuerwehr || geretteteFeuerwehr) {
    injuredHtml += `<div class="overview-item"><span class="label">Feuerwehr:</span><span>Verletzt: ${verletzteFeuerwehr || '-'}, Getötet: ${getoeteteFeuerwehr || '-'}, Gerettet: ${geretteteFeuerwehr || '-'}</span></div>`;
  }
  if (verletzteTiere || getoeteteTiere || geretteteTiere) {
    injuredHtml += `<div class="overview-item"><span class="label">Tiere:</span><span>Verletzt: ${verletzteTiere || '-'}, Getötet: ${getoeteteTiere || '-'}, Gerettet: ${geretteteTiere || '-'}</span></div>`;
  }
  if(injuredHtml) { summaryHtml += `<div class="overview-section"><h2>Verletzte</h2>${injuredHtml}</div>`; }
  let notizenHtml = "";
  if(lageEintreffen) { notizenHtml += `<div class="overview-item"><span class="label">Lage beim Eintreffen:</span><span contenteditable="true" onblur="updateEditable(this, 'lageEintreffen')">${lageEintreffen}</span></div>`; }
  if(massnahmenEinsatzort) { notizenHtml += `<div class="overview-item"><span class="label">Maßnahmen:</span><span contenteditable="true" onblur="updateEditable(this, 'massnahmenEinsatzort')">${massnahmenEinsatzort}</span></div>`; }
  if(bemerkungen) { notizenHtml += `<div class="overview-item"><span class="label">Bemerkungen:</span><span contenteditable="true" onblur="updateEditable(this, 'bemerkungen')">${bemerkungen}</span></div>`; }
  if(notizenHtml) { summaryHtml += `<div class="overview-section"><h2>Einsatznotizen</h2>${notizenHtml}</div>`; }
  summaryHtml += `</div>`;
  document.getElementById("summaryContainer").innerHTML = summaryHtml;
}

function updateEditable(span, fieldId) {
  let newValue = span.textContent.trim();
  if(fieldId && document.getElementById(fieldId)) {
    if(document.getElementById(fieldId).tagName === "INPUT" || document.getElementById(fieldId).tagName === "TEXTAREA") {
      document.getElementById(fieldId).value = newValue;
    } else {
      document.getElementById(fieldId).innerText = newValue;
    }
  }
}

/* ---------------- Generische Suchfunktion für Modale ---------------- */
function filterModalOptions(modalId, searchInputId) {
  const modal = document.getElementById(modalId);
  const searchInput = document.getElementById(searchInputId);
  const filter = searchInput.value.toLowerCase();
  const options = modal.querySelectorAll("ul li");
  options.forEach(option => {
    option.style.display = option.textContent.toLowerCase().includes(filter) ? "" : "none";
  });
}

function getChipValues(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return "";
  const chips = container.querySelectorAll(".chip");
  let values = [];
  chips.forEach(chip => {
    let textOhneX = chip.textContent.replaceAll("×", "").trim();
    values.push(textOhneX);
  });
  return values.join(", ");
}

/* ---------------- Neue Funktionen für Absenden & Speichern ---------------- */

// Sammelt alle relevanten Formulardaten in einem Objekt
function gatherFormData() {
  // Hier werden die ausgewählten Fahrzeuge gesammelt
  const selectedVehicles = [];
  document.querySelectorAll(".vehicle-card[data-selected='true']").forEach(card => {
    const kennzeichen = card.querySelector(".vehicle-info small").innerText;
    const fahrzeugName = vehicleMapping[kennzeichen] || kennzeichen;
    selectedVehicles.push({ kennzeichen, fahrzeugName });
  });

  return {
    // Grundinformationen (Step 1)
    datum: formatDate(document.getElementById("datum").value.trim()),
    uhrzeitAlarmierung: document.getElementById("uhrzeitAlarmierung").value.trim(),
    einsatzEnde: formatDate(document.getElementById("einsatzEnde").value.trim()),
    uhrzeitRueckkehr: document.getElementById("uhrzeitRueckkehr").value.trim(),
    objekt: document.getElementById("objektSelect").value.trim(),
    einsatzortBezirk: document.getElementById("einsatzortBezirk").value.trim(),
    einsatzortStrasse: document.getElementById("einsatzortStrasse").value.trim(),
    hausnummer: document.getElementById("hausnummer").value.trim(),
    einsatzortPLZ: document.getElementById("einsatzortPLZ").value.trim(),
    eigenerEinsatzbereich: document.querySelector("#einsatzbereich-buttons .radio-button.active")?.textContent.trim() || "",
        einsatzStichwort: document.getElementById("searchInput").value.trim(),
    berichtErstelltDurch: document.getElementById("berichtErstelltDurch").value.trim(),
    verrechenbar: document.querySelector("#verrechenbar-buttons .radio-button.active")?.textContent.trim() || "",

    // Einsatzdetails (Step 2)
    meldung: getChipValues("selected-meldung"),
    alarmierung: getChipValues("selected-alarmierung"),
    anwesend: getChipValues("selected-anwesend"),
    wetter: getChipValues("selected-wetter"),
    gefahrenklasse: getChipValues("selected-gefahrenklasse"),
    lageEintreffen: document.getElementById("lageEintreffen").value.trim(),
    massnahmenEinsatzort: document.getElementById("massnahmenEinsatzort").value.trim(),
    bemerkungen: document.getElementById("bemerkungen").value.trim(),

    // Verletzte Angaben (Step 2 – Verletzte)
    verletztePersonen: document.getElementById("verletztePersonen") ? document.getElementById("verletztePersonen").value.trim() : "",
    getoetetePersonen: document.getElementById("getoetetePersonen") ? document.getElementById("getoetetePersonen").value.trim() : "",
    gerettetePersonen: document.getElementById("gerettetePersonen") ? document.getElementById("gerettetePersonen").value.trim() : "",
    verletzteFeuerwehr: document.getElementById("verletzteFeuerwehr") ? document.getElementById("verletzteFeuerwehr").value.trim() : "",
    getoeteteFeuerwehr: document.getElementById("getoeteteFeuerwehr") ? document.getElementById("getoeteteFeuerwehr").value.trim() : "",
    geretteteFeuerwehr: document.getElementById("geretteteFeuerwehr") ? document.getElementById("geretteteFeuerwehr").value.trim() : "",
    verletzteTiere: document.getElementById("verletzteTiere") ? document.getElementById("verletzteTiere").value.trim() : "",
    getoeteteTiere: document.getElementById("getoeteteTiere") ? document.getElementById("getoeteteTiere").value.trim() : "",
    geretteteTiere: document.getElementById("geretteteTiere") ? document.getElementById("geretteteTiere").value.trim() : "",

    // Rechnungsträger / Geschädigte – nur wenn sichtbar
    rg_vorname:  (document.getElementById("rg-block")?.style.display !== "none") ? (document.getElementById("rg_vorname")?.value.trim()  || "") : "",
    rg_nachname: (document.getElementById("rg-block")?.style.display !== "none") ? (document.getElementById("rg_nachname")?.value.trim() || "") : "",
    rg_strasse:  (document.getElementById("rg-block")?.style.display !== "none") ? (document.getElementById("rg_strasse")?.value.trim()  || "") : "",
    rg_hausnr:   (document.getElementById("rg-block")?.style.display !== "none") ? (document.getElementById("rg_hausnr")?.value.trim()   || "") : "",
    rg_plz:      (document.getElementById("rg-block")?.style.display !== "none") ? (document.getElementById("rg_plz")?.value.trim()      || "") : "",
    rg_bezirk:   (document.getElementById("rg-block")?.style.display !== "none") ? (document.getElementById("rg_bezirk")?.value.trim()   || "") : "",
    rg_geb:      (document.getElementById("rg-block")?.style.display !== "none") ? (document.getElementById("rg_geb")?.value.trim()      || "") : "",
    rg_kennz:    (document.getElementById("rg-block")?.style.display !== "none") ? (document.getElementById("rg_kennz")?.value.trim()     || "") : "",
    rg_kontakt:  (document.getElementById("rg-block")?.style.display !== "none") ? (document.getElementById("rg_kontakt")?.value.trim()  || "") : "",

    // Fahrzeuge (Step 3)
    fahrzeuge: Array.from(document.querySelectorAll(".vehicle-card[data-selected='true']")).map(card => {
      const kennzeichen = card.querySelector(".vehicle-info small").innerText;
      const fahrzeugName = vehicleMapping[kennzeichen] || kennzeichen;
      return { kennzeichen, fahrzeugName };
    }),

    // Teamzuweisungen (Step 4)
    savedAssignments: savedAssignments
  };
} // <-- Ende gatherFormData()

// ganz oben, damit formData im Callback zur Verfügung steht:
let lastFormData = null;

function submitData() {
  lastFormData = gatherFormData();
  showSavingScreen();           // Loader anzeigen…
  submitFormData(lastFormData); // … und danach JSONP-Request absetzen
}

function submitFormData(formData) {
  const scriptUrl = 'https://script.google.com/macros/s/AKfycbxqdIOAEdhzQuOhx0xsAnOqfQ64Jo4HmdFfqaqIr1RKE2Sp3ApYS4Sf33tXRFfuuqMjlA/exec';
  const callbackName = `handleResponse_${Date.now()}`;

  // 1) Callback-Funktion global registrieren
  window[callbackName] = function(response) {
    // Antwort-ID merken
    lastFormData.id = response.id;
    // Discord-Webhook abschicken
    sendDiscordWebhook(lastFormData);
    // Erfolgsscreen in Section 5 mit der echten ID anzeigen
    showSuccessOnLastPage(response.id);

    // 3) Aufräumen: das JSONP-Script wieder entfernen
    document.body.removeChild(script);
    delete window[callbackName];
  };

  // 2) JSONP-Script erzeugen und in den body einfügen
  const script = document.createElement('script');
  script.src = `${scriptUrl}`
             + `?callback=${callbackName}`
             + `&formData=${encodeURIComponent(JSON.stringify(formData))}`;
  document.body.appendChild(script);
}

function showSavingScreen() {
  // z.B. innerhalb von #section5
  const section5 = document.getElementById('section5');
  section5.innerHTML = `
    <div class="saving-container">
      <div class="loader"></div>
      Deine Daten werden gespeichert...
    </div>
  `;
  // Falls nötig Section 5 aktivieren:
  section5.classList.add('active');
}

// Öffnet die Startseite in einem neuen Tab und schließt das aktuelle Fenster
function returnToHome() {
  window.open('https://sites.google.com/view/intranet-feuerwehr-austriax/startseite', '_blank');
  window.close();
}

function createNewReport() {
  window.scrollTo(0, 0);             // Scrollt nach oben
  setTimeout(() => location.reload(), 500); // kurz warten und neu laden
}

function showSuccessOnLastPage(id) {
  // 1) Alle Steps verbergen
  document.querySelectorAll('.container').forEach(c => c.classList.remove('active'));
  // 2) Section 5 aktivieren
  const section5 = document.getElementById('section5');
  section5.classList.add('active');

  // 3) Den Inhalt von Section 5 durch unsere Erfolgsmeldung ersetzen
  section5.innerHTML = `
    <div class="overview-container">
      <div class="success-message">
        <div class="success-checkmark">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" width="80" height="80">
            <circle cx="26" cy="26" r="24" fill="none" stroke="#32cd32" stroke-width="4"/>
            <path fill="none" stroke="#32cd32" stroke-width="4" d="M14 27l8 8 16-16"
                  stroke-dasharray="52" stroke-dashoffset="52"
                  style="animation: drawCheck 1s ease forwards;"/>
          </svg>
        </div>
        <p>Einsatzbericht-Nr. <strong>${id}</strong> wurde angelegt.</p>
      </div>
      <div class="button-container-success">
        <button class="success-button" onclick="returnToHome()">Zur Startseite</button>
        <button class="success-button" onclick="createNewReport()">Neuen Bericht erstellen</button>
      </div>
    </div>
  `;
}

document.getElementById("anwesendSearch").addEventListener("input", function() {
  filterModalOptions("modal-anwesend", "anwesendSearch");
});
document.getElementById("wetterSearch").addEventListener("input", function() {
  filterModalOptions("modal-wetter", "wetterSearch");
});

// Annahme: teamData wurde bereits via loadTeamData() geladen.
document.getElementById("berichtErstelltDurch").addEventListener("input", function() {
  const query = this.value.trim().toLowerCase();
  const cont = document.getElementById("berichtErstellerOptionsContainer");
  cont.innerHTML = "";
  if (!query) {
    cont.style.display = "none";
    return;
  }
  // Filtere nur aktive Mitglieder (wie im Team-Modal)
  const results = teamData.filter(member => {
    const dg = member["Aktueller Dienstgrad"] || "";
    const vor = member["Namen"] || "";
    const nach = member["Nachnamen"] || "";
    const text = (dg + " " + vor + " " + nach).toLowerCase();
    return text.includes(query);
  });
  if (results.length === 0) {
    cont.style.display = "none";
    return;
  }
  results.slice(0, 10).forEach(member => {
    const dg = member["Aktueller Dienstgrad"] || "";
    const vor = member["Namen"] || "";
    const nach = member["Nachnamen"] || "";
    const displayText = dg + " " + vor + " " + nach;
    const opt = document.createElement("div");
    opt.className = "option";
    opt.textContent = displayText;
    opt.addEventListener("click", () => {
      document.getElementById("berichtErstelltDurch").value = displayText;
      cont.style.display = "none";
    });
    cont.appendChild(opt);
  });
  cont.style.display = "block";
});

function formatDate(dateString) {
  // Falls du das Datum nicht ändern möchtest, gib einfach den Originalwert zurück
  return dateString;
}

document.querySelectorAll('.options-container .option, .modal-content li')
  .forEach(opt => { opt.setAttribute('tabindex','-1'); });

// --- Navigation in den Such-Dropdowns ---
document.querySelectorAll('.searchable-select input').forEach(input => {
  let idx = -1;
  const container = input.nextElementSibling; // .options-container

  input.addEventListener('keydown', e => {
    const opts = Array.from(container.querySelectorAll('.option'));
    if (!opts.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      idx = Math.min(idx + 1, opts.length - 1);
      opts.forEach(o=>o.classList.toggle('highlighted', false));
      opts[idx].classList.add('highlighted');
      opts[idx].focus();
    }
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      idx = Math.max(idx - 1, 0);
      opts.forEach(o=>o.classList.toggle('highlighted', false));
      opts[idx].classList.add('highlighted');
      opts[idx].focus();
    }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (idx >= 0) opts[idx].click();
    }
  });

  // Resette Index, wenn man neu tippt
  input.addEventListener('input', () => { idx = -1; });
  input.addEventListener('focus', () => { idx = -1; });
});

// --- Navigation in den Modal-Listen ---
document.querySelectorAll('.modal-content').forEach(modal => {
  const items = Array.from(modal.querySelectorAll('li'));
  let j = -1;

  modal.addEventListener('keydown', e => {
    if (!['ArrowDown','ArrowUp','Enter'].includes(e.key)) return;
    e.preventDefault();
    if (e.key === 'ArrowDown') {
      j = Math.min(j + 1, items.length - 1);
    } else if (e.key === 'ArrowUp') {
      j = Math.max(j - 1, 0);
    } else if (e.key === 'Enter') {
      if (j >= 0) {
        const checkbox = items[j].querySelector('input[type=checkbox], .modal-team-item');
        checkbox.click();
        return;
      }
    }
    items.forEach(li => li.classList.toggle('highlighted', false));
    items[j].classList.add('highlighted');
    items[j].focus();
  });

  // Beim Öffnen des Modals Fokus auf das UL setzen
  modal.addEventListener('transitionend', () => {
    if (modal.classList.contains('active')) {
      modal.querySelector('ul, .modal-team-list').focus();
      j = -1;
    }
  });
});

// --- Highlight-CSS hinzufügen (falls noch nicht da) ---
const style = document.createElement('style');
style.innerHTML = `
  .option.highlighted,
  .modal-content li.highlighted {
    background-color: #555 !important;
    outline: none;
  }
  .modal-content ul,
  .modal-team-list {
    outline: none;
  }
`;
document.head.appendChild(style);

// ————— Discord Webhook —————
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1377985039370948718/wLXFUsSuu7blDDuCBOH3wrkHtE51tuxv2s9hjYC9NdRJGCG2UA-y9oV9jA66jslWH42R';

async function sendDiscordWebhook(formData) {
  const f = (name, value, inline = false) => ({
    name,
    value: value && value !== '' ? value : '–',
    inline
  });

  // Fahrzeuge auflisten
  const fahrzeugeList = formData.fahrzeuge.length
    ? formData.fahrzeuge.map(fz => `• ${fz.fahrzeugName}`).join('\n')
    : '–';

  // Mannschaft auflisten
  const mannschaftList = Object.values(formData.savedAssignments)
    .flatMap(seats => Object.values(seats))
    .map(a => `• ${a.displayText} – ${a.role}`)
    .join('\n') || '–';

  const embed = {
    // ID im Titel verwenden
    title: `🚒 Neuer Einsatzbericht #${formData.id}`,
    color: 0xAB2328,
    fields: [

      // 1) Beginn & Ende als separate Felder
      f('⏱ Beginn', `${formData.datum} ${formData.uhrzeitAlarmierung}`, true),
      f('⏱ Ende',   `${formData.einsatzEnde} ${formData.uhrzeitRueckkehr}`, true),

      // 2) Objekt & Stichwort
      f('📍 Objekt & Adresse',
        `${formData.objekt}\n` +
        `${formData.einsatzortStrasse} ${formData.hausnummer}, ` +
        `${formData.einsatzortPLZ} ${formData.einsatzortBezirk}`
      ),
      f('💬 Stichwort', formData.einsatzStichwort),

      // 3) Alarmierung & Infos
      f('📡 Alarmierung / Wetter / Gefahr',
        `• Alarmierung: ${formData.alarmierung || '–'}\n` +
        `• Wetter:      ${formData.wetter      || '–'}\n` +
        `• Gefahr:      ${formData.gefahrenklasse || '–'}`
      ),
      f('🔔 Meldung & Anwesend',
        `• Meldung:   ${formData.meldung   || '–'}\n` +
        `• Anwesend:  ${formData.anwesend || '–'}`
      ),

      // 4) Verletzte nebeneinander
      f('⚕️ Personen', 
        `• Verletzt: ${formData.verletztePersonen || 0}\n` +
        `• Getötet:  ${formData.getoetetePersonen  || 0}\n` +
        `• Gerettet: ${formData.gerettetePersonen || 0}`,
        true
      ),
      f('🚒 Feuerwehr',
        `• Verletzt: ${formData.verletzteFeuerwehr || 0}\n` +
        `• Getötet:  ${formData.getoeteteFeuerwehr  || 0}\n` +
        `• Gerettet: ${formData.geretteteFeuerwehr || 0}`,
        true
      ),
      f('🐾 Tiere',
        `• Verletzt: ${formData.verletzteTiere || 0}\n` +
        `• Getötet:  ${formData.getoeteteTiere  || 0}\n` +
        `• Gerettet: ${formData.geretteteTiere || 0}`,
        true
      ),

      // 5) Fahrzeuge & Mannschaft
      f('🚗 Fahrzeuge', fahrzeugeList),
      f('👨‍🚒 Mannschaft', mannschaftList),

      // 6) Notizen
      f('📝 Notizen',
        `• Lage:      ${formData.lageEintreffen        || '–'}\n` +
        `• Maßnahmen: ${formData.massnahmenEinsatzort || '–'}\n` +
        `• Bemerkungen:${formData.bemerkungen          || '–'}`
      ),

      // 7) ganz unten: Wer hat’s erstellt?
      f('👤 Bericht erstellt durch', formData.berichtErstelltDurch)
    ],
    timestamp: new Date().toISOString()
  };


  
  await fetch(DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] })
  });

  // Sichtbarkeit des RG-Blocks nach Versand erneut sicherstellen
  updateRgVisibility();
}

// ---------------- Initiale Sichtbarkeit beim Laden sicherstellen ----------------
window.addEventListener('load', () => {
  updateRgVisibility();
});

// Nur Datum setzen (yyyy-mm-dd) – für <input type="date">
function setDateNow(dateInputId) {
  const now = new Date();
  document.getElementById(dateInputId).value = now.toISOString().split("T")[0];
}

// Nur Uhrzeit setzen (HH:MM) – für <input type="time">
function setTimeNow(timeInputId) {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  document.getElementById(timeInputId).value = `${hh}:${mm}`;
}
