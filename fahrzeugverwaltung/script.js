
/********************* GLOBAL VARIABLEN *********************/
let allRecords = [];
let selectedRecord = null;
let currentSuggestionIndex = -1;
let isEditingCourses = false;
let activeMembers = [];
let csvHeaders = [];

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzHdUx9PO27502Aar4wl6dm8ILj-dbIdSMegvNNY7pf61E5-3yTnew1JPGrhFJ1KkgU2A/exec"; // <- URL vom Apps Script

/******************** CSV Laden & Parsen ********************/
$(document).ready(function() {
  loadDataFromCSV();

  $('#searchField').on('keydown', function(e) {
    const suggestions = $('#suggestions .suggestion-item');
    if (e.key === 'ArrowDown') {
      if (suggestions.length > 0) {
        currentSuggestionIndex = (currentSuggestionIndex + 1) % suggestions.length;
        suggestions.removeClass('selected');
        suggestions.eq(currentSuggestionIndex).addClass('selected');
        e.preventDefault();
      }
    } else if (e.key === 'ArrowUp') {
      if (suggestions.length > 0) {
        currentSuggestionIndex = (currentSuggestionIndex - 1 + suggestions.length) % suggestions.length;
        suggestions.removeClass('selected');
        suggestions.eq(currentSuggestionIndex).addClass('selected');
        e.preventDefault();
      }
    } else if (e.key === 'Enter') {
      if (currentSuggestionIndex >= 0 && suggestions.length > 0) {
        suggestions.eq(currentSuggestionIndex).click();
        currentSuggestionIndex = -1;
        e.preventDefault();
      }
    }
  });

  $('.datepicker').datepicker({ dateFormat: 'dd.mm.yy' });
  $('#ausbildnerEditContainer').hide();
});

function loadDataFromCSV() {
  const csvUrl = 'YOUR_GOOGLE_SHEET_CSV_URL';
  fetch(csvUrl)
    .then(response => response.text())
    .then(csvText => {
      allRecords = parseCSV(csvText);
      activeMembers = allRecords.filter(r => (r['Aktives Mitglied?'] || '').toLowerCase() === 'ja');
      fillActiveMembersDatalist(activeMembers);
      const trainerMembers = activeMembers.filter(r => (r['Ausbildner?'] || '').toLowerCase() === 'ja');
      fillTrainersDatalist(trainerMembers);
    })
    .catch(err => console.error('Fehler beim Laden der CSV:', err));
}

function parseCSV(csvText) {
  const lines = csvText.split('\n').map(line => line.trim()).filter(line => line.length);
  csvHeaders = lines[0].split(',');
  const records = lines.slice(1).map(line => {
    const values = line.split(',');
    let obj = {};
    csvHeaders.forEach((header, i) => { obj[header.trim()] = (values[i] || '').trim(); });
    return obj;
  });
  return records;
}

function fillActiveMembersDatalist(members) {
  const datalist = $('#activeMembersList');
  datalist.empty();
  members.forEach(m => {
    const name = `${m['Namen'] || ''} ${m['Nachnamen'] || ''}`.trim();
    datalist.append(`<option value="${name}">`);
  });
}

function fillTrainersDatalist(ausbildner) {
  const datalist = $('#trainersList');
  datalist.empty();
  ausbildner.forEach(m => {
    const name = `${m['Namen'] || ''} ${m['Nachnamen'] || ''}`.trim();
    datalist.append(`<option value="${name}">`);
  });
}

/********************* Suche & Vorschläge *******************/
function searchSuggestions() {
  const query = $('#searchField').val().toLowerCase();
  if (query.length < 2) { $('#suggestions').empty(); return; }
  const filtered = allRecords.filter(r =>
    (r['Mitgliedsnummer'] && r['Mitgliedsnummer'].toLowerCase().includes(query)) ||
    (r['Namen'] && r['Namen'].toLowerCase().includes(query)) ||
    (r['Nachnamen'] && r['Nachnamen'].toLowerCase().includes(query))
  );
  displaySuggestions(filtered);
}

function displaySuggestions(records) {
  const suggestionsBox = $('#suggestions');
  suggestionsBox.empty();
  currentSuggestionIndex = -1;
  records.forEach((r, idx) => {
    const item = $(`<div class="suggestion-item">${r['Mitgliedsnummer']} - ${r['Namen']} ${r['Nachnamen']}</div>`);
    item.on('click', () => {
      selectedRecord = Object.assign({}, r);
      fillForm(selectedRecord);
      suggestionsBox.empty();
      $('body').css('overflow', 'auto');
      isEditingCourses = false;
      $('#courseSection').show();
      $('.section-header').show();
      displayCourses(selectedRecord, idx + 2); // +2 weil Header + 1-basiert
    });
    suggestionsBox.append(item);
  });
}

/**************** Formular füllen & Editing ****************/
function fillForm(record) {
  $('#mitgliedsnummer').val(record['Mitgliedsnummer'] || '');
  $('#anrede').val(record['Anrede'] || '');
  $('#titel').val(record['Titel'] || '');
  $('#namen').val(record['Namen'] || '');
  $('#nachnamen').val(record['Nachnamen'] || '');
  $('#geburtsdatum').val(record['Geburtsdatum'] || '');
  $('#beruf').val(record['Beruf'] || '');
  $('#geburtsort').val(record['Geburtsort'] || '');
  $('#familienstand').val(record['Familienstand'] || '');
  $('#staatsbuergerschaft').val(record['Staatsbürgerschaft'] || '');
  $('#identifikationsnummer').val(record['Identifikationsnummer'] || '');
  $('#telefonnummer').val(record['Telefonnummer'] || '');
  $('#forumsname').val(record['Forumsname'] || '');
  $('#adresse').val(record['Adresse'] || '');
  $('#plz').val(record['Postleitzahl'] || '');
  $('#stadt').val(record['Stadt'] || '');
  $('#email').val(record['D-Mail Adresse'] || '');
  $('#abgemeldet_grund').val(record['Abgemeldet Grund'] || '');
  $('#dienstgrad').val(record['Aktueller Dienstgrad'] || '');
  $('#beforderung').val(record['Letzte Beförderung'] || '');
  $('#funktion').val(record['Funktion'] || '');
}

/**************** Kursdaten speichern ****************/
function activateCourseEditingMode() {
  if(!selectedRecord) return;
  isEditingCourses = true;
  displayCourses(selectedRecord);
  $('#editCourseButton').text('Speichern Kursdaten').attr('onclick','saveCourseData()');
}

function saveCourseData() {
  if(!selectedRecord) return;
  
  // Hier würdest du die Kursdaten in selectedRecord schreiben (wie bisher)
  // ...

  // Zeilenindex ermitteln
  let rowIndex = allRecords.findIndex(r => r['Mitgliedsnummer'] === selectedRecord['Mitgliedsnummer']);
  if (rowIndex === -1) return;
  rowIndex += 2; // Header + 1-basiert

  // Änderungen an Backend schicken
  saveRowChanges(selectedRecord, rowIndex);

  isEditingCourses = false;
  displayCourses(selectedRecord);
  $('#editCourseButton').text('Kursdaten bearbeiten').attr('onclick','activateCourseEditingMode()');
}

/**************** Nur Änderungen senden ****************/
function saveRowChanges(record, rowIndex) {
  let changes = {};
  Object.keys(record).forEach(key => {
    if (record[key] !== allRecords[rowIndex - 2][key]) {
      changes[key] = record[key];
    }
  });

  if (Object.keys(changes).length === 0) {
    console.log("Keine Änderungen – nix gesendet.");
    return;
  }

  const payload = {
    row: rowIndex,
    changes: changes
  };

  fetch(WEB_APP_URL, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" }
  })
  .then(res => res.json())
  .then(data => {
    console.log("Antwort vom Server:", data);
    if (data.success) {
      allRecords[rowIndex - 2] = { ...allRecords[rowIndex - 2], ...changes };
    }
  })
  .catch(err => console.error("Fehler beim Speichern:", err));
}
