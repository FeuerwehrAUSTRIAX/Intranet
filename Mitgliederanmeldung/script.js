import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBqGQk0R...kWjU",
  authDomain: "intranet-ffwn.firebaseapp.com",
  projectId: "intranet-ffwn",
  storageBucket: "intranet-ffwn.appspot.com",
  messagingSenderId: "332331477899",
  appId: "1:332331477899:web:cb6a915a9d5e47ebc8d53c"
};

// Init
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Defaults (Fixwerte)
const DEFAULTS = {
  anbieter: "FFWN",
  dienstgrad: "Feuerwehrmann",
  dienstnummer: "—",
  ausbildner_fur: "---",
  dienstzuteilung: "Feuerwehr Wiener Neustadt",
  aktives_mitglied: "Ja"
};

const STEPS = [
  {
    key: "personal",
    title: "Personendaten",
    fields: [
      { id: "anrede", label: "Anrede", type: "select", required: true, options: ["", "Herr", "Frau", "Divers"] },
      { id: "titel", label: "Titel", type: "text", required: false, placeholder: "z.B. Ing., Dr." },
      { id: "vorname", label: "Namen (Vorname)", type: "text", required: true, placeholder: "Max" },
      { id: "nachname", label: "Nachnamen", type: "text", required: true, placeholder: "Mustermann" },
      { id: "geburtsdatum", label: "Geburtsdatum", type: "date", required: true },
      {
        id: "familienstand",
        label: "Familienstand",
        type: "select",
        required: false,
        options: ["", "ledig", "verheiratet", "geschieden", "verwitwet", "eingetr. Partnerschaft"]
      },
      {
        id: "staatsburgerschaft",
        label: "Staatsbürgerschaft",
        type: "select",
        required: true,
        options: ["", "Österreich", "Deutschland", "Schweiz", "Italien", "Ungarn", "Tschechien", "Slowakei", "Slowenien", "Kroatien", "Rumänien", "Bulgarien", "Polen", "Andere"]
      }
    ]
  },
  {
    key: "kontakt",
    title: "Kontakt",
    fields: [
      { id: "identifikationsnummer", label: "Citizen ID", type: "text", required: true, placeholder: "z.B. 123456" },
      { id: "telefonnummer", label: "Telefonnummer", type: "tel", required: true, placeholder: "+43 ..." },
      { id: "dmail", label: "D-Mail Adresse", type: "text", required: true, placeholder: "z.B. Marco#1234" },
      { id: "forumsname", label: "Forumsname", type: "text", required: false, placeholder: "z.B. Marco" },
      { id: "discord_tag", label: "Discord Tag", type: "text", required: true, placeholder: "z.B. Marco#1234" },
      { id: "discord_user_id", label: "Discord User ID", type: "text", required: false, placeholder: "z.B. 123456789012345678" }
    ]
  },
  {
    key: "adresse",
    title: "Adresse",
    fields: [
      { id: "adresse", label: "Adresse", type: "text", required: true, span2: true, placeholder: "Straße Hausnummer" },
      { id: "plz", label: "PLZ", type: "text", required: true, placeholder: "2700" },
      { id: "ort", label: "Ort", type: "text", required: true, placeholder: "Wiener Neustadt" },
      { id: "land", label: "Land", type: "text", required: true, placeholder: "Österreich" }
    ]
  },
  {
    key: "bild",
    title: "Personalbild",
    fields: [
      { id: "personalbild_url", label: "Bild-URL", type: "url", required: false, span2: true, placeholder: "https://..." }
    ]
  },
  {
    key: "password",
    title: "Zugangsdaten",
    fields: [
      { id: "password", label: "Passwort", type: "password", required: true, placeholder: "mind. 6 Zeichen" },
      { id: "password_confirm", label: "Passwort bestätigen", type: "password", required: true, placeholder: "Passwort wiederholen" }
    ]
  },
  {
    key: "summary",
    title: "Zusammenfassung",
    fields: []
  }
];

// Utils
function el(id){ return document.getElementById(id); }
function escapeId(s){ return (s || "").toString().replaceAll(/[^a-zA-Z0-9_-]/g, "_"); }
function escapeHtml(str){
  return (str ?? "")
    .toString()
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function todayAT(){
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

// Email aus Namen generieren
function generateEmail(vorname, nachname) {
  const v = vorname.toLowerCase().trim().replace(/\s+/g, "");
  const n = nachname.toLowerCase().trim().replace(/\s+/g, "");
  return `${v}.${n}@feuerwehr.gv.at`;
}

// D-Mail Adresse und Discord Tag sind ident (immer synchron halten)
function syncDmailWithDiscordTag(){
  const v = (state.discord_tag ?? "").toString();
  state.dmail = v;
  saveState();
}

// Wizard-State
const STORAGE_KEY = "ffwn_member_wizard_state_v7";
let state = loadState();
let currentStep = loadStep();

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  }catch{ return {}; }
}
function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function loadStep(){
  try{
    const raw = localStorage.getItem(`${STORAGE_KEY}_step`);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) ? Math.max(0, Math.min(STEPS.length - 1, n)) : 0;
  }catch{ return 0; }
}
function saveStep(){
  localStorage.setItem(`${STORAGE_KEY}_step`, String(currentStep));
}

// Message banner
function setMsg(type, text){
  const msg = el("msg");
  if (!msg) return;
  msg.textContent = text || "";
  msg.className = `msg msg--${type}`;
  msg.style.display = text ? "block" : "none";
}

// Summary card helpers
function makeCard(title, rows){
  const card = document.createElement("div");
  card.className = "card";
  const h = document.createElement("div");
  h.className = "card__title";
  h.textContent = title;
  card.appendChild(h);

  const body = document.createElement("div");
  body.className = "card__body";
  for (const [k,v] of rows){
    const r = document.createElement("div");
    r.className = "row";
    r.innerHTML = `<div class="row__k">${escapeHtml(k)}</div><div class="row__v">${escapeHtml(v || "—")}</div>`;
    body.appendChild(r);
  }
  card.appendChild(body);
  return card;
}

function renderSummary(host){
  const get = (k) => (state[k] ?? "").toString().trim();

  const rowsPerson = [
    ["Anrede", get("anrede")],
    ["Titel", get("titel")],
    ["Vorname", get("vorname")],
    ["Nachname", get("nachname")],
    ["Geburtsdatum", get("geburtsdatum")],
    ["Familienstand", get("familienstand")],
    ["Staatsbürgerschaft", get("staatsburgerschaft")]
  ];

  const rowsKontakt = [
    ["Citizen ID", get("identifikationsnummer")],
    ["Telefonnummer", get("telefonnummer")],
    ["D-Mail Adresse", get("dmail")],
    ["Forumsname", get("forumsname")],
    ["Discord Tag", get("discord_tag")],
    ["Discord User ID", get("discord_user_id")]
  ];

  const rowsAdresse = [
    ["Adresse", get("adresse")],
    ["PLZ", get("plz")],
    ["Ort", get("ort")],
    ["Land", get("land")]
  ];

  const rowsAuth = [
    ["Login Email", (get("vorname") && get("nachname")) ? generateEmail(get("vorname"), get("nachname")) : "—"],
    ["Passwort", (get("password")) ? "••••••••" : "—"]
  ];

  const rowsFix = [
    ["Dienstnummer", DEFAULTS.dienstnummer],
    ["Dienstgrad", DEFAULTS.dienstgrad],
    ["Dienstzuteilung", DEFAULTS.dienstzuteilung],
    ["Aktives Mitglied", DEFAULTS.aktives_mitglied],
    ["Ausbildner für", DEFAULTS.ausbildner_fur]
  ];

  // Header/Hero
  const hero = document.createElement("div");
  hero.className = "summaryHero";

  const left = document.createElement("div");
  left.className = "summaryHero__left";

  const name = `${get("vorname") || "—"} ${get("nachname") || ""}`.trim();
  left.innerHTML = `
    <div class="summaryHero__name">${escapeHtml(name || "—")}</div>
    <div class="summaryHero__unit">${escapeHtml(DEFAULTS.dienstzuteilung)}</div>
  `;
  hero.appendChild(left);

  const imgUrl = get("personalbild_url");
  if (imgUrl){
    const media = document.createElement("div");
    media.className = "summaryMedia";
    const img = document.createElement("img");
    img.src = imgUrl;
    img.alt = "Personalbild Vorschau";
    img.onerror = () => { media.style.display = "none"; };
    media.appendChild(img);
    hero.appendChild(media);
  }

  host.appendChild(hero);

  // Cards
  const wrap = document.createElement("div");
  wrap.className = "summaryWrap";

  const cards = document.createElement("div");
  cards.className = "cards";

  // NUR diese 3 sollen angezeigt werden (nebeneinander)
  cards.appendChild(makeCard("Person", rowsPerson));
  cards.appendChild(makeCard("Kontakt", rowsKontakt));
  cards.appendChild(makeCard("Adresse", rowsAdresse));

  wrap.appendChild(cards);

  // DSGVO / Richtigkeit
  const checks = document.createElement("div");
  checks.className = "checks";
  checks.innerHTML = `
    <label class="check">
      <input type="checkbox" name="__dsgvo" ${state.__dsgvo ? "checked" : ""}/>
      <span>Ich bestätige die DSGVO-Zustimmung.</span>
    </label>
    <label class="check">
      <input type="checkbox" name="__richtigkeit" ${state.__richtigkeit ? "checked" : ""}/>
      <span>Ich bestätige, dass die Angaben korrekt sind.</span>
    </label>
    <div class="checks__meta">Datum: ${escapeHtml(todayAT())}</div>
  `;
  wrap.appendChild(checks);

  host.appendChild(wrap);

  // Checkbox state handling
  checks.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.addEventListener("change", () => {
      state[cb.name] = cb.checked;
      saveState();
    });
  });
}

// Render step UI
function renderStep(){
  saveState();
  saveStep();

  const step = STEPS[currentStep];

  // Kontakt-Step: D-Mail immer aus Discord Tag ableiten
  if (step.key === "kontakt") {
    syncDmailWithDiscordTag();
  }

  const host = el("stepHost");
  if (!host) return;
  host.innerHTML = "";

  const wizTop = el("wizTop");
  if (wizTop) wizTop.style.display = currentStep === 0 ? "none" : "flex";

  const total = STEPS.length;
  if (currentStep > 0){
    const pct = Math.round(((currentStep + 1) / total) * 100);
    el("wizBar").style.width = `${pct}%`;
    el("wizLabel").textContent = `Schritt ${currentStep + 1}/${total}`;
  } else {
    el("wizBar").style.width = `0%`;
    el("wizLabel").textContent = `Schritt 1/${total}`;
  }

  const title = document.createElement("div");
  title.className = "stepTitle";
  title.textContent = step.title;
  host.appendChild(title);

  if (step.key === "summary"){
    renderSummary(host);
  } else {
    const grid = document.createElement("div");
    grid.className = "grid";
    host.appendChild(grid);

    // Passwort-Schritt: Login-Mail anzeigen (read-only), damit klar ist wofür das Passwort gilt
    if (step.key === "password") {
      const vorname = (state.vorname ?? "").toString().trim();
      const nachname = (state.nachname ?? "").toString().trim();
      const loginEmail = (vorname && nachname) ? generateEmail(vorname, nachname) : "—";

      const wrap = document.createElement("div");
      wrap.className = "field field--span2";
      const id = "login_email_preview";
      wrap.innerHTML = `
        <label for="${id}">Login-Email</label>
        <input id="${id}" name="${id}" type="text" value="${escapeHtml(loginEmail)}" readonly />
      `;
      grid.appendChild(wrap);
    }

    for (const f of step.fields){
      const wrap = document.createElement("div");
      wrap.className = "field" + (f.span2 ? " field--span2" : "");

      const id = escapeId(f.id);

      const lab = document.createElement("label");
      lab.setAttribute("for", id);
      lab.innerHTML = `${f.label}${f.required ? ' <span class="req">*</span>' : ""}`;
      wrap.appendChild(lab);

      let input;
      if (f.type === "select"){
        input = document.createElement("select");
        input.id = id;
        input.name = f.id;

        for (const opt of (f.options || [""])){
          const o = document.createElement("option");
          o.value = opt;
          o.textContent = opt;
          input.appendChild(o);
        }
      } else {
        input = document.createElement("input");
        input.id = id;
        input.name = f.id;
        input.type = f.type || "text";
        if (f.placeholder) input.placeholder = f.placeholder;
        if (f.required) input.required = true;
      }

      const v = state[f.id];
      if (v !== undefined && v !== null) input.value = String(v);

      input.addEventListener("input", () => {
        state[f.id] = input.value;

        // Discord Tag <-> D-Mail immer ident halten
        if (f.id === "discord_tag") {
          syncDmailWithDiscordTag();
          const dmailInput = document.querySelector(`[name="dmail"]`);
          if (dmailInput) dmailInput.value = state.dmail ?? "";
        }
        if (f.id === "dmail") {
          // D-Mail nicht separat erlauben (ident zum Discord Tag)
          syncDmailWithDiscordTag();
          input.value = state.dmail ?? "";
        }

        saveState();
      });

      wrap.appendChild(input);
      grid.appendChild(wrap);
    }
  }

  el("backBtn").style.display = currentStep === 0 ? "none" : "inline-flex";
  el("nextBtn").style.display = currentStep === total - 1 ? "none" : "inline-flex";
  el("submitBtn").style.display = currentStep === total - 1 ? "inline-flex" : "none";

  setMsg("ok", "");
  setMsg("err", "");
}

// Validation
function validateStep(){
  const step = STEPS[currentStep];
  if (step.key === "summary") return true;

  // Passwort-Schritt: Prüfe ob Passwörter übereinstimmen
  if (step.key === "password") {
    const pw = (state.password ?? "").toString().trim();
    const pwConfirm = (state.password_confirm ?? "").toString().trim();

    if (!pw) {
      setMsg("err", "Bitte Passwort eingeben.");
      document.querySelector(`[name="password"]`)?.focus?.();
      return false;
    }

    if (!pwConfirm) {
      setMsg("err", "Bitte Passwort bestätigen.");
      document.querySelector(`[name="password_confirm"]`)?.focus?.();
      return false;
    }

    if (pw !== pwConfirm) {
      setMsg("err", "Passwörter stimmen nicht überein!");
      document.querySelector(`[name="password_confirm"]`)?.focus?.();
      return false;
    }

    if (pw.length < 6) {
      setMsg("err", "Passwort muss mindestens 6 Zeichen lang sein.");
      document.querySelector(`[name="password"]`)?.focus?.();
      return false;
    }
  }

  for (const f of step.fields){
    if (!f.required) continue;
    const val = (state[f.id] ?? "").toString().trim();
    if (!val){
      setMsg("err", `Bitte Feld "${f.label}" ausfüllen.`);
      document.querySelector(`[name="${f.id}"]`)?.focus?.();
      return false;
    }
  }

  setMsg("err", "");
  return true;
}

// Theme
function initTheme(){
  const stored = localStorage.getItem("ffwn_theme");
  const initial = stored || "dark";
  document.documentElement.setAttribute("data-theme", initial);
  el("themeLabel").textContent = initial === "dark" ? "Dark" : "Light";

  el("themeToggle").addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") || "dark";
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("ffwn_theme", next);
    el("themeLabel").textContent = next === "dark" ? "Dark" : "Light";
  });

  // Falls Logo/Icon ausgeblendet wurde: wieder anzeigen (defensiv)
  ["appLogo","logo","brandLogo","headerLogo"].forEach((id) => {
    const n = document.getElementById(id);
    if (n) n.style.display = "";
  });
}

// Navigation
el("backBtn")?.addEventListener("click", () => {
  if (currentStep <= 0) return;
  currentStep -= 1;
  renderStep();
});
el("nextBtn")?.addEventListener("click", () => {
  if (!validateStep()) return;
  if (currentStep >= STEPS.length - 1) return;
  currentStep += 1;
  renderStep();
});

// Submit
el("submitBtn")?.addEventListener("click", async () => {
  setMsg("err", "");
  setMsg("ok", "");

  // DSGVO Checks
  if (!state.__dsgvo) return setMsg("err", "Bitte DSGVO Zustimmung bestätigen.");
  if (!state.__richtigkeit) return setMsg("err", "Bitte Richtigkeit bestätigen.");

  // Required fields sanity
  for (let s = 0; s < STEPS.length; s++){
    const step = STEPS[s];
    if (step.key === "summary") continue;
    for (const f of step.fields){
      if (!f.required) continue;
      const val = (state[f.id] ?? "").toString().trim();
      if (!val) return setMsg("err", `Fehlendes Pflichtfeld: ${f.label}`);
    }
  }

  // Passwort nochmals prüfen
  const pw = (state.password ?? "").toString().trim();
  const pwConfirm = (state.password_confirm ?? "").toString().trim();
  if (pw !== pwConfirm) {
    return setMsg("err", "Passwörter stimmen nicht überein!");
  }
  if (pw.length < 6) {
    return setMsg("err", "Passwort muss mindestens 6 Zeichen lang sein.");
  }

  // Login Email generieren
  const vorname = (state.vorname ?? "").toString().trim();
  const nachname = (state.nachname ?? "").toString().trim();
  const email = generateEmail(vorname, nachname);

  // Ensure D-Mail = Discord Tag (final sync before submit)
  syncDmailWithDiscordTag();

  try{
    el("submitBtn").disabled = true;

    const cred = await createUserWithEmailAndPassword(auth, email, pw);

    // Display name = Vorname Nachname
    const displayName = `${vorname} ${nachname}`.trim();
    if (displayName){
      await updateProfile(cred.user, { displayName });
    }

    // TODO: Hier würdest du normalerweise noch Firestore/Backend speichern.
    // In diesem Script ist nur Auth-User Creation enthalten.

    setMsg("ok", `Account erstellt: ${email}`);
  }catch(err){
    console.error(err);
    setMsg("err", err?.message || "Fehler beim Erstellen des Accounts.");
  }finally{
    el("submitBtn").disabled = false;
  }
});

// Boot
window.addEventListener("DOMContentLoaded", () => {
  initTheme();
  renderStep();
});
