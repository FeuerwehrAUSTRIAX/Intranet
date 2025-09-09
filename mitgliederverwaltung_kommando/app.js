/********************* GLOBAL VARIABLEN *********************/
let allRecords = [];
let selectedRecord = null;
let currentSuggestionIndex = -1;
let isEditingCourses = false;
let activeMembers = [];
let csvHeaders = [];

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbydfJRfAAyFCQfHnxE3Ee5aSyiYgpf8yns8-hT9Uomk4QbRvqAj9MxyEtyogjpBn6eh/exec";

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
  const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQJhQbJMxG8s7oSw__c97Z55koBtE2Dlgc0OYR8idpZtdTq3o9g7LbmyEve3KPNkV5yaRZGIHVjJPkk/pub?gid=294937836&single=true&output=csv';
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

function toggleActiveStatus() {
  const btn = $('#statusToggle');
  const nowActive = !btn.hasClass('active');
  setActiveStatus(nowActive);
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
  records.forEach(r => {
    const item = $(`<div class="suggestion-item">${r['Mitgliedsnummer']} - ${r['Namen']} ${r['Nachnamen']}</div>`);
    item.on('click', () => {
      selectedRecord = Object.assign({}, r);
      fillForm(selectedRecord);
      suggestionsBox.empty();
      $('body').css('overflow', 'auto');
      isEditingCourses = false;
      $('#courseSection').show();
      $('.section-header').show();
      displayCourses(selectedRecord);
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

  if(record['Personalbild']) { $('#personalImage').html(`<img src="${record['Personalbild']}" alt="Personalbild">`); } else { $('#personalImage').text('Foto'); }

  const dg = record['Aktueller Dienstgrad'];
  if(dg && dienstgradBilder[dg]) { $('#dienstgradImage').html(`<img src="${dienstgradBilder[dg]}" alt="${dg}">`); } else { $('#dienstgradImage').text('Dienstgrad'); }

  const isAusbildner = (record['Ausbildner?'] || '').toLowerCase() === 'ja';
  $('#ausbildnerCheckbox').prop('checked', isAusbildner);
  if(isAusbildner) { $('#ausbildnerFuerSection').show(); $('#ausbildner_fuer').val(record['Ausbildner für'] || ''); }
  else { $('#ausbildnerFuerSection').hide(); $('#ausbildner_fuer').val(''); }

  setActiveStatus((record['Aktives Mitglied?'] || '').toLowerCase() === 'ja');
  updateHeaderTitle(record);
  $('.content input, .content select').prop('disabled', true);
  $('#ausbildnerEditContainer').hide();
}

function setActiveStatus(isActive) {
  const btn = $('#statusToggle');
  btn.toggleClass('active', isActive).toggleClass('inactive', !isActive);
  btn.text(isActive ? 'Aktiv' : 'Inaktiv');
}

function updateHeaderTitle(record) {
  const title = `${record['Mitgliedsnummer'] || ''} - ${record['Aktueller Dienstgrad'] || ''} ${record['Namen'] || ''} ${record['Nachnamen'] || ''}`;
  $('#headerTitle').text(`[${title.trim()}]`);
}

/**************** Kurs-Konfiguration & Anzeige *************/
const coursesConfig = {
  'AKL-Test': { category: 'generalModules', hasTrainer: false, hasInfo: false, hasCompleted: false, hasWithdrawn: false, hasValidUntil: true },
  'ÖFAST':    { category: 'generalModules', hasTrainer: false, hasInfo: false, hasCompleted: false, hasWithdrawn: false, hasValidUntil: true },
  'GFÜ':      { category: 'officerModules', hasTrainer: true,  hasInfo: true,  hasCompleted: true,  hasWithdrawn: true },
  'FWBW': { category: 'branddienstModules', hasTrainer: true, hasInfo: true, hasCompleted: true, hasWithdrawn: true },
  'BD10': { category: 'branddienstModules', hasTrainer: true, hasInfo: true, hasCompleted: true, hasWithdrawn: true },
  'BD20': { category: 'branddienstModules', hasTrainer: true, hasInfo: true, hasCompleted: true, hasWithdrawn: true },
  'BD70': { category: 'branddienstModules', hasTrainer: true, hasInfo: true, hasCompleted: true, hasWithdrawn: true },
  'BD80': { category: 'branddienstModules', hasTrainer: true, hasInfo: true, hasCompleted: true, hasWithdrawn: true },
  'AT':   { category: 'branddienstModules', hasTrainer: true, hasInfo: true, hasCompleted: true, hasWithdrawn: true },
  'TE10': { category: 'techModules', hasTrainer: true, hasInfo: true, hasCompleted: true, hasWithdrawn: true },
  'TE20': { category: 'techModules', hasTrainer: true, hasInfo: true, hasCompleted: true, hasWithdrawn: true },
  'TE30': { category: 'techModules', hasTrainer: true, hasInfo: true, hasCompleted: true, hasWithdrawn: true },
  'TE40': { category: 'techModules', hasTrainer: true, hasInfo: true, hasCompleted: true, hasWithdrawn: true },
  'T1':   { category: 'techModules', hasTrainer: true, hasInfo: true, hasCompleted: true, hasWithdrawn: true },
  'TBS20':{ category: 'techModules', hasTrainer: true, hasInfo: true, hasCompleted: true, hasWithdrawn: true },
  'TBS30':{ category: 'techModules', hasTrainer: true, hasInfo: true, hasCompleted: true, hasWithdrawn: true },
  'EMA B': { category: 'emModules', hasTrainer: true, hasInfo: true, hasCompleted: true, hasWithdrawn: true },
  'EMA C': { category: 'emModules', hasTrainer: true, hasInfo: true, hasCompleted: true, hasWithdrawn: true },
  'EMA C2':{ category: 'emModules', hasTrainer: true, hasInfo: true, hasCompleted: true, hasWithdrawn: true },
  'FÜ10': { category: 'officerModules', hasTrainer: true, hasInfo: true, hasCompleted: true, hasWithdrawn: true },
  'ASM10':{ category: 'officerModules', hasTrainer: true, hasInfo: true, hasCompleted: true, hasWithdrawn: true },
  'FÜ20': { category: 'officerModules', hasTrainer: true, hasInfo: true, hasCompleted: true, hasWithdrawn: true },
  'NRD10':{ category: 'officerModules', hasTrainer: true, hasInfo: true, hasCompleted: true, hasWithdrawn: true },
  'NRD20':{ category: 'officerModules', hasTrainer: true, hasInfo: true, hasCompleted: true, hasWithdrawn: true },
  'SD10': { category: 'hazardModules', hasTrainer: true, hasInfo: true, hasCompleted: true, hasWithdrawn: true },
  'SD20': { category: 'hazardModules', hasTrainer: true, hasInfo: true, hasCompleted: true, hasWithdrawn: true },
  'SD25': { category: 'hazardModules', hasTrainer: true, hasInfo: true, hasCompleted: true, hasWithdrawn: true },
  'SD35': { category: 'hazardModules', hasTrainer: true, hasInfo: true, hasCompleted: true, hasWithdrawn: true },
  'SD40': { category: 'hazardModules', hasTrainer: true, hasInfo: true, hasCompleted: true, hasWithdrawn: true },
  'WD10': { category: 'waterModules', hasTrainer: true, hasInfo: true, hasCompleted: true, hasWithdrawn: true },
  'WD20': { category: 'waterModules', hasTrainer: true, hasInfo: true, hasCompleted: true, hasWithdrawn: true },
  'WFBB1':{ category: 'waterModules', hasTrainer: true, hasInfo: true, hasCompleted: true, hasWithdrawn: true },
  'WFBB2':{ category: 'waterModules', hasTrainer: true, hasInfo: true, hasCompleted: true, hasWithdrawn: true }
};

const courseCategories = {
  generalModules: ['AKL-Test','ÖFAST','GFÜ'],
  branddienstModules: ['FWBW','AT','BD10','BD20','BD70','BD80'],
  techModules: ['TE10','TE20','TE30','TE40','T1','TBS20','TBS30'],
  hazardModules: ['SD10','SD20','SD25','SD35','SD40'],
  waterModules: ['WD10','WD20','WFBB1','WFBB2'],
  emModules: ['EMA B','EMA C','EMA C2'],
  officerModules: ['FÜ10','ASM10','FÜ20','NRD10','NRD20']
};

function makeCourseCard(courseName, record) {
  const cfg = coursesConfig[courseName] || { hasTrainer:true, hasInfo:true, hasCompleted:true, hasWithdrawn:true };
  const date = record[`${courseName} - Datum`] || '';
  const trainer = cfg.hasTrainer ? (record[`${courseName} - Ausbildner`] || '') : '';
  const info = cfg.hasInfo ? (record[`${courseName} - Information`] || '') : '';
  const validUntil = cfg.hasValidUntil ? (record[`${courseName} - GÜLTIG BIS`] || '') : '';
  const completed = cfg.hasCompleted ? ((record[`${courseName} - Absolviert`] || '').toLowerCase() === 'ja') : false;
  const withdrawn = cfg.hasWithdrawn ? (record[`${courseName} - Zurückgezogen`] || '') : '';

  const card = $(`
    <div class="course-card" data-course="${courseName}" data-config='${JSON.stringify(cfg)}'>
      <h4>${courseName}</h4>
      <div class="field-container">
        <label>Datum:</label>
        <input class="datePicker date" type="text" value="${date}">
      </div>
      ${cfg.hasValidUntil ? `
        <div class="field-container">
          <label>Gültig bis:</label>
          <input class="datePicker validUntil" type="text" value="${validUntil}">
        </div>` : ''}
      ${cfg.hasTrainer ? `
        <div class="field-container">
          <label>Ausbildner:</label>
          <input class="trainer" type="text" value="${trainer}" list="trainersList">
        </div>` : ''}
      ${cfg.hasInfo ? `
        <div class="field-container">
          <label>Information:</label>
          <input class="info" type="text" value="${info}">
        </div>` : ''}
      ${cfg.hasCompleted ? `
        <div class="toggle-container">
          <label>Kurs Absolviert:</label>
          <div class="toggle-switch ${completed ? 'active' : ''}" onclick="toggleCourseCompletion(this)"></div>
        </div>` : ''}
      ${cfg.hasWithdrawn ? `<button class="withdraw-button" onclick="toggleWithdrawCourse(this)">Zurückziehen</button>` : ''}
    </div>
  `);

  if (cfg.hasWithdrawn && withdrawn) {
    card.addClass('withdrawn');
    card.find('.withdraw-button').text('Freigeben');
    card.append(`<div class="withdrawn-info">Kurs zurückgezogen am: ${withdrawn}</div>`);
  }
  if(isEditingCourses) { card.addClass('edit-mode'); } else { card.find('input').prop('disabled', true); }
  return card;
}

function displayCourses(record) {
  for(const id of Object.keys(courseCategories)) { $(`#${id}`).empty(); }
  for(const [category, list] of Object.entries(courseCategories)) {
    const container = $(`#${category}`);
    list.forEach(courseName => {
      const cfg = coursesConfig[courseName] || {};
if (!isEditingCourses) {
  const cfg = coursesConfig[courseName] || {};
  let show = false;

  if (cfg.hasCompleted) {
    // Nur zeigen, wenn wirklich "Absolviert: Ja"
    show = ((record[`${courseName} - Absolviert`] || '').toLowerCase() === 'ja');
  } else if (cfg.hasValidUntil) {
    // Für AKL-Test / ÖFAST: sichtbar, wenn "GÜLTIG BIS" gesetzt ist
    show = !!record[`${courseName} - GÜLTIG BIS`];
  } else {
    // Fallback: sichtbar, wenn Datum gesetzt ist
    show = !!record[`${courseName} - Datum`];
  }

  if (!show) return;
}

      const card = makeCourseCard(courseName, record);
      container.append(card);
    });
  }
  $('.datePicker').datepicker({ dateFormat: 'dd.mm.yy' });
}

function toggleCourseCompletion(toggle) { $(toggle).toggleClass('active'); }

function toggleWithdrawCourse(button) {
  const card = $(button).closest('.course-card');
  const courseName = card.data('course');
  const cfg = JSON.parse(card.attr('data-config'));
  if(!cfg.hasWithdrawn) return;

  const isWithdrawn = card.hasClass('withdrawn');
  if (isWithdrawn) {
    card.removeClass('withdrawn');
    $(button).text('Zurückziehen');
    card.find('.withdrawn-info').remove();
    selectedRecord[`${courseName} - Zurückgezogen`] = '';
  } else {
    card.addClass('withdrawn');
    $(button).text('Freigeben');
    let now = new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin', hour12: false });
    now = now.replace(/,/g, ' ').replace(/[\r\n]+/g, ' ');
    card.append(`<div class="withdrawn-info">Kurs zurückgezogen am: ${now}</div>`);
    selectedRecord[`${courseName} - Zurückgezogen`] = now;
  }
}

function activateCourseEditingMode() {
  if(!selectedRecord) return;
  isEditingCourses = true;
  displayCourses(selectedRecord);
  $('#editCourseButton').text('Speichern Kursdaten').attr('onclick','saveCourseData()');
}

function toggleActiveStatus() {
  const btn = $('#statusToggle');
  const nowActive = !btn.hasClass('active');
  setActiveStatus(nowActive); // nutzt deine bestehende Funktion
}

// 2) Vollständig: Stammdaten-Bearbeitungsmodus inkl. Status-Schalter
function activateStammdatenEditingMode() {
  const fields = document.querySelectorAll(".content input, .content select");
  const isEditing = fields[0] && !fields[0].disabled;

  if (!isEditing) {
    // --- Bearbeiten aktivieren ---
    fields.forEach(f => f.disabled = false);

    // Ausbildner-Checkbox/Section sichtbar & bedienbar machen
    $('#ausbildnerEditContainer').show();
    $('#ausbildnerCheckbox').prop('disabled', false);
    if ($('#ausbildnerCheckbox').is(':checked')) {
      $('#ausbildnerFuerSection').show();
      $('#ausbildner_fuer').prop('disabled', false);
    } else {
      $('#ausbildnerFuerSection').hide();
      $('#ausbildner_fuer').prop('disabled', true);
    }
    // Live: Sichtbarkeit "Ausbildner für" steuern
    $('#ausbildnerCheckbox').off('change.__ausb').on('change.__ausb', function () {
      if (this.checked) {
        $('#ausbildnerFuerSection').show();
        $('#ausbildner_fuer').prop('disabled', false);
      } else {
        $('#ausbildnerFuerSection').hide();
        $('#ausbildner_fuer').prop('disabled', true);
        $('#ausbildner_fuer').val('');
      }
    });

    // Status-Schalter aktivieren + Click-Handler binden
    $('#statusToggle')
      .prop('disabled', false)
      .css('cursor', 'pointer')
      .off('click.__status')   // doppelte Bindungen vermeiden
      .on('click.__status', toggleActiveStatus);

    // Live-Updates für Titel & Dienstgrad-Bild
    $('#dienstgrad, #namen, #nachnamen, #mitgliedsnummer')
      .off('input.__live change.__live') // sicherheitshalber reset
      .on('input.__live change.__live', function () {
        const tempRecord = Object.assign({}, selectedRecord);
        tempRecord['Mitgliedsnummer'] = $('#mitgliedsnummer').val();
        tempRecord['Aktueller Dienstgrad'] = $('#dienstgrad').val();
        tempRecord['Namen'] = $('#namen').val();
        tempRecord['Nachnamen'] = $('#nachnamen').val();

        // Titel links oben aktualisieren
        updateHeaderTitle(tempRecord);

        // Dienstgrad-Bild live setzen
        const dg = tempRecord['Aktueller Dienstgrad'];
        if (dg && dienstgradBilder[dg]) {
          $('#dienstgradImage').html(`<img src="${dienstgradBilder[dg]}" alt="${dg}">`);
        } else {
          $('#dienstgradImage').text('Dienstgrad');
        }
      });

    document.getElementById("editStammdatenButton").textContent = "Stammdaten speichern";
  } else {
    // --- Bearbeiten beenden & speichern ---
    fields.forEach(f => f.disabled = true);

    // Ausbildner-UI wieder sperren/ausblenden (wie initialer Zustand)
    $('#ausbildnerCheckbox').prop('disabled', true);
    $('#ausbildnerEditContainer').hide();
    // "Ausbildner für" Feld sperren; Sichtbarkeit richtet sich nach fillForm beim nächsten Öffnen
    $('#ausbildner_fuer').prop('disabled', true);

    // Status-Schalter wieder sperren & Handler lösen
    $('#statusToggle')
      .prop('disabled', true)
      .css('cursor', 'default')
      .off('click.__status');

    // Live-Update-Events entfernen
    $('#dienstgrad, #namen, #nachnamen, #mitgliedsnummer').off('input.__live change.__live');
    $('#ausbildnerCheckbox').off('change.__ausb');

    document.getElementById("editStammdatenButton").textContent = "Stammdaten bearbeiten";

    // Speichern
    saveStammdaten();
    }
}


function saveStammdaten() {
    if (!selectedRecord) return;

    // Werte aus allen Stammdatenfeldern ins selectedRecord schreiben
    selectedRecord['Mitgliedsnummer'] = $('#mitgliedsnummer').val() || '';
    selectedRecord['Anrede'] = $('#anrede').val() || '';
    selectedRecord['Titel'] = $('#titel').val() || '';
    selectedRecord['Namen'] = $('#namen').val() || '';
    selectedRecord['Nachnamen'] = $('#nachnamen').val() || '';
    selectedRecord['Geburtsdatum'] = $('#geburtsdatum').val() || '';
    selectedRecord['Beruf'] = $('#beruf').val() || '';
    selectedRecord['Geburtsort'] = $('#geburtsort').val() || '';
    selectedRecord['Familienstand'] = $('#familienstand').val() || '';
    selectedRecord['Staatsbürgerschaft'] = $('#staatsbuergerschaft').val() || '';
    selectedRecord['Identifikationsnummer'] = $('#identifikationsnummer').val() || '';
    selectedRecord['Telefonnummer'] = $('#telefonnummer').val() || '';
    selectedRecord['Forumsname'] = $('#forumsname').val() || '';
    selectedRecord['Adresse'] = $('#adresse').val() || '';
    selectedRecord['Postleitzahl'] = $('#plz').val() || '';
    selectedRecord['Stadt'] = $('#stadt').val() || '';
    selectedRecord['D-Mail Adresse'] = $('#email').val() || '';
    selectedRecord['Abgemeldet Grund'] = $('#abgemeldet_grund').val() || '';
    selectedRecord['Aktueller Dienstgrad'] = $('#dienstgrad').val() || '';
    selectedRecord['Letzte Beförderung'] = $('#beforderung').val() || '';
    selectedRecord['Funktion'] = $('#funktion').val() || '';
    
    // Checkbox für "Ausbildner?"
    selectedRecord['Ausbildner?'] = $('#ausbildnerCheckbox').is(':checked') ? 'Ja' : 'Nein';
    if ($('#ausbildnerCheckbox').is(':checked')) {
        selectedRecord['Ausbildner für'] = $('#ausbildner_fuer').val() || '';
    } else {
        selectedRecord['Ausbildner für'] = '';
    }

    // Aktives Mitglied?
    selectedRecord['Aktives Mitglied?'] = $('#statusToggle').hasClass('active') ? 'Ja' : 'Nein';

    // Im Datensatz-Array ersetzen
    let index = allRecords.findIndex(r => r['Mitgliedsnummer'] === selectedRecord['Mitgliedsnummer']);
    if (index !== -1) {
        allRecords[index] = selectedRecord;
    }

    // CSV hochladen
    uploadCSVToGoogle();
}


function saveCourseData() {
  if(!selectedRecord) return;
  $('.course-card').each(function() {
    const courseName = $(this).data('course');
    const cfg = JSON.parse($(this).attr('data-config'));

    const date = $(this).find('.date').val();
    selectedRecord[`${courseName} - Datum`] = date || '';

    if (cfg.hasValidUntil) {
      const vu = $(this).find('.validUntil').val();
      selectedRecord[`${courseName} - GÜLTIG BIS`] = vu || '';
    }
    if (cfg.hasTrainer) {
      const trainer = $(this).find('.trainer').val();
      selectedRecord[`${courseName} - Ausbildner`] = trainer || '';
    }
    if (cfg.hasInfo) {
      const info = $(this).find('.info').val();
      selectedRecord[`${courseName} - Information`] = info || '';
    }
    if (cfg.hasCompleted) {
      const completed = $(this).find('.toggle-switch').hasClass('active');
      selectedRecord[`${courseName} - Absolviert`] = completed ? 'Ja' : 'Nein';
    }
    if (cfg.hasWithdrawn) {
      const isWithdrawn = $(this).hasClass('withdrawn');
      if(!isWithdrawn) { selectedRecord[`${courseName} - Zurückgezogen`] = ''; }
    }
  });

  let index = allRecords.findIndex(r => r['Mitgliedsnummer'] === selectedRecord['Mitgliedsnummer']);
  if (index !== -1) { allRecords[index] = selectedRecord; }

  isEditingCourses = false;
  displayCourses(selectedRecord);
  $('#editCourseButton').text('Kursdaten bearbeiten').attr('onclick','activateCourseEditingMode()');
  uploadCSVToGoogle();
}

/********************* Dienstgrad-Bilder *******************/
const dienstgradBilder = {
  "PFM": "https://i.postimg.cc/ZRjqKjH4/Dgrd-pfm-noe-svg.png",
  "FM": "https://i.postimg.cc/hjqrx4bs/Dgrd-fm-noe-svg.png",
  "OFM": "https://i.postimg.cc/63j8KY3Z/Dgrd-ofm-noe-svg.png",
  "HFM": "https://i.postimg.cc/T1536xB8/Dgrd-hfm-noe-svg.png",
  "LM": "https://i.postimg.cc/sDRMrQfw/Dgrd-lm-noe-svg.png",
  "OLM": "https://i.postimg.cc/Bv13bpMD/Dgrd-olm-noe-svg.png",
  "HLM": "https://i.postimg.cc/Gtggkwpp/Dgrd-hlm-noe-svg.png",
  "BM": "https://i.postimg.cc/rs5CwBtb/Dgrd-bm-noe-svg.png",
  "OBM": "https://i.postimg.cc/C54BtS8F/Dgrd-obm-noe-svg.png",
  "HBM": "https://i.postimg.cc/wT6sNRK3/Dgrd-hbm-noe-svg.png",
  "BI": "https://i.postimg.cc/HxZFt7ZH/Dgrd-bi-noe-svg-Kopie.png",
  "OBI": "https://i.postimg.cc/TYYJ643k/Dgrd-obi-noe-svg.png",
  "HBI": "https://i.postimg.cc/Rh06j2LK/Dgrd-hbi-noe-svg.png",
  "ABI": "https://i.postimg.cc/j2v9jnfB/Dgrd-abi2-bgld-svg.png",
  "BR": "https://i.postimg.cc/gcf4vDz4/Dgrd-br2-noe-svg.png",
  "OBR": "https://i.postimg.cc/3NH4wdhj/Dgrd-obr-noe-svg.png",
  "LFR": "https://i.postimg.cc/fTss8Y5j/Dgrd-lfr-noe-svg.png",
  "LBDSTV": "https://i.postimg.cc/LXFQm3Jx/Dgrd-lbdstv-noe-svg.png",
  "LBD": "https://i.postimg.cc/fbcjfnbv/Dgrd-lbd-noe-svg.png",
  "VM": "https://i.postimg.cc/Y9jfFXvr/Dgrd-vm-noe-svg.png",
  "OVM": "https://i.postimg.cc/4dhHZjK9/Dgrd-ovm-noe-svg.png",
  "HVM": "https://i.postimg.cc/PJTXc71h/Dgrd-hvm-noe-svg.png",
  "V": "https://i.postimg.cc/YSM8mfYh/Dgrd-v-noe-svg.png",
  "OV": "https://i.postimg.cc/R0wzBRS0/Dgrd-ov-noe-svg.png",
  "HV": "https://i.postimg.cc/44S2WcG2/Dgrd-hv-noe-svg.png",
  "VI": "https://i.postimg.cc/DzvR9KMx/Dgrd-vi-noe-svg.png",
  "VR": "https://i.postimg.cc/V6SZwsBW/Dgrd-vr-noe-svg.png"
};

/********************** CSV Upload ************************/
function uploadCSVToGoogle() {
  const csvContent = generateCSV(allRecords);
  fetch(WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csv: csvContent })
  })
  .then(response => response.text())
  .then(data => {
    console.log('Antwort vom Google-Script:', data);
    // Optionales Feedback
    // alert('Daten erfolgreich hochgeladen!');
  })
  .catch(err => {
    console.error('Fehler beim Hochladen:', err);
    // alert('Fehler beim Hochladen der Daten!');
  });
}

function generateCSV(records) {
  // Dynamische Spalten aus Daten sicherstellen
  records.forEach(record => {
    for (const key in record) { if (!csvHeaders.includes(key)) csvHeaders.push(key); }
  });

  // Kursfelder sicherstellen
  Object.keys(coursesConfig).forEach(c => {
    const fields = [`${c} - Datum`];
    if (coursesConfig[c].hasValidUntil) fields.push(`${c} - GÜLTIG BIS`);
    if (coursesConfig[c].hasTrainer) fields.push(`${c} - Ausbildner`);
    if (coursesConfig[c].hasInfo) fields.push(`${c} - Information`);
    if (coursesConfig[c].hasCompleted) fields.push(`${c} - Absolviert`);
    if (coursesConfig[c].hasWithdrawn) fields.push(`${c} - Zurückgezogen`);
    fields.forEach(f => { if (!csvHeaders.includes(f)) csvHeaders.push(f); });
  });

  // CSV zusammenbauen (mit Escapes)
  let csv = csvHeaders.join(',') + '\n';
  records.forEach(record => {
    const row = csvHeaders.map(header => {
      let value = record[header] || '';
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        value = '"' + value.replace(/"/g, '""') + '"';
      }
      return value;
    }).join(',');
    csv += row + '\n';
  });
  return csv;
}
