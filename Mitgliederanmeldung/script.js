import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getAuth,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAEKPiUzXc_tFvmiop4hDEdhv8Rkg2kWjU",
  authDomain: "intranet-ffwn.firebaseapp.com",
  projectId: "intranet-ffwn",
  storageBucket: "intranet-ffwn.firebasestorage.app",
  messagingSenderId: "221055908808",
  appId: "1:221055908808:web:b1c63120bc73aa26a6defd"
};

const ORG_ID = "ffwn";
const MEMBER_PREFIX = "21401";

// Fixwerte (automatisch gesetzt, nicht in UI)
const DEFAULTS = {
  aktueller_dienstgrad: "PFM",
  funktion: "Mannschaft",
  ausbildner: "Nein",
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
      { id: "familienstand", label: "Familienstand", type: "select", required: true, options: ["", "ledig", "verheiratet", "geschieden", "verwitwet", "eingetr. Partnerschaft"] },
      { id: "staatsburgerschaft", label: "Staatsbürgerschaft", type: "text", required: true, placeholder: "AT" }
    ]
  },
  {
    key: "kontakt",
    title: "Kontakt",
    fields: [
      { id: "identifikationsnummer", label: "Identifikationsnummer (Citizen ID)", type: "text", required: true, placeholder: "CitizenID" },
      { id: "telefonnummer", label: "Telefonnummer", type: "tel", required: false, placeholder: "+43 …" },
      { id: "forumsname", label: "Forumsname", type: "text", required: false },
      { id: "discord_tag", label: "Discord Tag", type: "text", required: true, placeholder: "z.B. @marco oder marco#1234" },
      { id: "discord_user_id", label: "Discord User ID", type: "text", required: true, placeholder: "18-stellige Zahl (von Bot abfragen)", span2: true },
      { id: "dmail", label: "D-Mail Adresse", type: "email", required: true, placeholder: "name@email.at", span2: true }
    ]
  },
  {
    key: "adresse",
    title: "Adresse & Bild",
    fields: [
      { id: "adresse", label: "Adresse", type: "text", required: true, placeholder: "Straße Hausnummer", span2: true },
      { id: "postleitzahl", label: "Postleitzahl", type: "text", required: true, placeholder: "2700" },
      { id: "stadt", label: "Stadt", type: "text", required: true, placeholder: "Wiener Neustadt" },
      { id: "personalbild_url", label: "Personalbild (Direktlink)", type: "text", required: true, placeholder: "https://…", span2: true }
    ]
  },
  {
    key: "password",
    title: "Passwort festlegen",
    fields: [
      { id: "password", label: "Passwort", type: "password", required: true, placeholder: "Mindestens 6 Zeichen", span2: true },
      { id: "password_confirm", label: "Passwort bestätigen", type: "password", required: true, placeholder: "Passwort wiederholen", span2: true }
    ]
  },
  { key: "summary", title: "Zusammenfassung", fields: [] }
];

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const el = (id) => document.getElementById(id);

function setMsg(kind, text) {
  const ok = el("msgOk");
  const err = el("msgErr");
  if (ok) { ok.style.display = "none"; ok.textContent = ""; }
  if (err) { err.style.display = "none"; err.textContent = ""; }
  if (!text) return;

  if (kind === "ok" && ok) { ok.textContent = text; ok.style.display = "block"; }
  if (kind === "err" && err) { err.textContent = text; err.style.display = "block"; }
}

function escapeId(s){ return String(s).replace(/[^a-zA-Z0-9_-]/g, "_"); }
function sanitizeDocId(s){
  return String(s).trim().replace(/\s+/g, "_").replace(/[\/\\?#.%[\]]/g, "_");
}
function escapeHtml(s){
  return String(s)
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
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function loadStep(){
  const n = Number(localStorage.getItem(STORAGE_KEY + "_step") || "0");
  return Number.isFinite(n) ? Math.max(0, Math.min(n, STEPS.length - 1)) : 0;
}
function saveStep(){ localStorage.setItem(STORAGE_KEY + "_step", String(currentStep)); }

async function allocateMemberNumber(){
  const counterRef = doc(db, "orgs", ORG_ID, "counters", "members");
  const num = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    let next = 1;
    if (snap.exists()) next = Number(snap.data().next || 1);
    tx.set(counterRef, { next: next + 1 }, { merge: true });
    return next;
  });
  return `${MEMBER_PREFIX}-${String(num).padStart(3, "0")}`;
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
    ["Postleitzahl", get("postleitzahl")],
    ["Stadt", get("stadt")],
    ["Personalbild (URL)", get("personalbild_url")]
  ];

  const einsendeDatum = todayAT();
  const rowsFix = [
    ["Mitglied seit", einsendeDatum],
    ["Aktueller Dienstgrad", DEFAULTS.aktueller_dienstgrad],
    ["Letzte Beförderung", einsendeDatum],
    ["Funktion", DEFAULTS.funktion],
    ["Ausbildner?", DEFAULTS.ausbildner],
    ["Ausbildner für", DEFAULTS.ausbildner_fur],
    ["Dienstzuteilung", DEFAULTS.dienstzuteilung],
    ["Aktives Mitglied?", DEFAULTS.aktives_mitglied]
  ];

  // Generierte Email anzeigen
  const vorname = get("vorname");
  const nachname = get("nachname");
  const generatedEmail = vorname && nachname ? generateEmail(vorname, nachname) : "—";
  const rowsAuth = [
    ["Login-Email", generatedEmail],
    ["Passwort", "●●●●●●●●"]
  ];

  const requiredKeys = [
    ["anrede", "Anrede"],
    ["vorname", "Vorname"],
    ["nachname", "Nachname"],
    ["geburtsdatum", "Geburtsdatum"],
    ["familienstand", "Familienstand"],
    ["staatsburgerschaft", "Staatsbürgerschaft"],
    ["identifikationsnummer", "Citizen ID"],
    ["discord_tag", "Discord Tag"],
    ["discord_user_id", "Discord User ID"],
    ["dmail", "D-Mail Adresse"],
    ["adresse", "Adresse"],
    ["postleitzahl", "Postleitzahl"],
    ["stadt", "Stadt"],
    ["personalbild_url", "Personalbild"],
    ["password", "Passwort"]
  ];
  const missing = requiredKeys.filter(([k]) => !get(k)).map(([,label]) => label);

  const wrap = document.createElement("div");
  wrap.className = "summaryV2";

  // HERO
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

  wrap.appendChild(hero);

  if (missing.length){
    const warn = document.createElement("div");
    warn.className = "badgeWarn";
    warn.textContent = `Fehlende Pflichtfelder: ${missing.join(", ")}`;
    wrap.appendChild(warn);
  }

  // Cards
  const cards = document.createElement("div");
  cards.className = "summaryCards";
  cards.appendChild(makeCard("Person", rowsPerson));
  cards.appendChild(makeCard("Kontakt", rowsKontakt));
  cards.appendChild(makeCard("Adresse", rowsAdresse));
  cards.appendChild(makeCard("System-Login", rowsAuth));
  cards.appendChild(makeCard("Fixwerte", rowsFix));
  wrap.appendChild(cards);

  // DSGVO + Richtigkeit
  const checks = document.createElement("div");
  checks.className = "summaryChecks";
  checks.innerHTML = `
    <label class="check">
      <input id="dsgvo" type="checkbox" ${state.__dsgvo ? "checked" : ""} />
      <span>Ich stimme der Datenverarbeitung (DSGVO) zu. <span class="req">*</span></span>
    </label>

    <label class="check">
      <input id="richtigkeit" type="checkbox" ${state.__richtigkeit ? "checked" : ""} />
      <span>Ich bestätige, dass die Angaben korrekt sind. <span class="req">*</span></span>
    </label>

    <div class="summaryHint">Mit „Absenden" wird ein Firebase-Account erstellt, die Daten gespeichert und die Mitgliedsnummer + Login-Email angezeigt.</div>
  `;
  wrap.appendChild(checks);

  host.appendChild(wrap);

  const dsgvoEl = document.getElementById("dsgvo");
  const richEl = document.getElementById("richtigkeit");
  dsgvoEl?.addEventListener("change", () => { state.__dsgvo = !!dsgvoEl.checked; saveState(); });
  richEl?.addEventListener("change", () => { state.__richtigkeit = !!richEl.checked; saveState(); });

  function makeCard(title, rows){
    const c = document.createElement("div");
    c.className = "sCard";

    const filled = rows.filter(([,v]) => (v ?? "").toString().trim() && v !== "—" && v !== "●●●●●●●●").length;

    const head = document.createElement("div");
    head.className = "sCard__title";
    head.innerHTML = `<div>${escapeHtml(title)}</div><div class="sCard__count">${filled}/${rows.length}</div>`;
    c.appendChild(head);

    const kv = document.createElement("div");
    kv.className = "kv";

    for (const [k, v] of rows){
      const val = (v ?? "").toString().trim();
      const row = document.createElement("div");
      row.className = "kvRow";
      row.innerHTML = `
        <div class="kvK">${escapeHtml(k)}</div>
        <div class="kvV ${val && val !== "—" ? "" : "kvV--empty"}">${escapeHtml(val || "—")}</div>
      `;
      kv.appendChild(row);
    }
    c.appendChild(kv);
    return c;
  }
}

function renderStep(){
  saveState();
  saveStep();

  const step = STEPS[currentStep];
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
        if (f.required) input.required = true;

        for (const optVal of (f.options || [])){
          const opt = document.createElement("option");
          opt.value = optVal;
          opt.textContent = optVal === "" ? "Bitte auswählen…" : optVal;
          if (optVal === "") { opt.disabled = true; opt.selected = true; }
          input.appendChild(opt);
        }
      } else {
        input = document.createElement("input");
        input.id = id;
        input.name = f.id;
        input.type = f.type || "text";
        input.placeholder = f.placeholder || "";
        if (f.required) input.required = true;
      }

      const v = state[f.id];
      if (v !== undefined && v !== null) input.value = String(v);

      input.addEventListener("input", () => {
        state[f.id] = input.value;
        saveState();
      });

      wrap.appendChild(input);
      grid.appendChild(wrap);
    }
  }

  el("backBtn").style.display = currentStep === 0 ? "none" : "inline-flex";
  el("nextBtn").style.display = currentStep === total - 1 ? "none" : "inline-flex";
  el("submitBtn").style.display = currentStep === total - 1 ? "inline-flex" : "none";

  setMsg(null, "");
}

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
    
    if (pw.length < 6) {
      setMsg("err", "Passwort muss mindestens 6 Zeichen lang sein.");
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
  }

  for (const f of step.fields){
    if (!f.required) continue;
    const v = (state[f.id] ?? "").toString().trim();
    if (!v){
      setMsg("err", `Bitte ausfüllen: ${f.label}`);
      document.querySelector(`[name="${CSS.escape(f.id)}"]`)?.focus?.();
      return false;
    }
  }
  return true;
}

async function createMemberDoc(memberNumber, uid){
  const vorname = (state.vorname ?? "").toString().trim();
  const nachname = (state.nachname ?? "").toString().trim();
  const docId = sanitizeDocId(`${memberNumber}_${vorname}_${nachname}`);
  const memberRef = doc(db, "orgs", ORG_ID, "members", docId);

  const einsendeDatum = todayAT();
  const loginEmail = generateEmail(vorname, nachname);

  await setDoc(memberRef, {
    orgId: ORG_ID,
    mitgliedsnummer: memberNumber,
    uid: uid, // Firebase Auth UID

    anrede: state.anrede ?? null,
    titel: state.titel ?? null,
    vorname,
    nachname,
    geburtsdatum: state.geburtsdatum ?? null,
    familienstand: state.familienstand ?? null,
    staatsburgerschaft: state.staatsburgerschaft ?? null,
    identifikationsnummer: state.identifikationsnummer ?? null,
    telefonnummer: state.telefonnummer ?? null,
    forumsname: state.forumsname ?? null,
    discord_tag: state.discord_tag ?? null,
    discord_user_id: state.discord_user_id ?? null,
    adresse: state.adresse ?? null,
    postleitzahl: state.postleitzahl ?? null,
    stadt: state.stadt ?? null,
    dmail: state.dmail ?? null,
    personalbild_url: state.personalbild_url ?? null,

    // System-Login
    login_email: loginEmail,

    // Fixwerte
    mitglied_seit: einsendeDatum,
    aktueller_dienstgrad: DEFAULTS.aktueller_dienstgrad,
    letzte_beforderung: einsendeDatum,
    funktion: DEFAULTS.funktion,
    ausbildner: DEFAULTS.ausbildner,
    ausbildner_fur: DEFAULTS.ausbildner_fur,
    dienstzuteilung: DEFAULTS.dienstzuteilung,
    aktives_mitglied: DEFAULTS.aktives_mitglied,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  // Kurse "Ordner"
  const coursesMetaRef = doc(db, "orgs", ORG_ID, "members", docId, "courses", "_meta");
  await setDoc(coursesMetaRef, {
    createdAt: serverTimestamp(),
    note: "Auto-created courses container"
  });

  return { docId, loginEmail };
}

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

el("memberForm")?.addEventListener("reset", () => {
  setTimeout(() => {
    state = {};
    currentStep = 0;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY + "_step");
    renderStep();
  }, 0);
});

el("memberForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  setMsg(null, "");

  // Validierung aller Pflichtfelder
  const requiredFields = [
    ["anrede", "Anrede"],
    ["vorname", "Vorname"],
    ["nachname", "Nachname"],
    ["geburtsdatum", "Geburtsdatum"],
    ["familienstand", "Familienstand"],
    ["staatsburgerschaft", "Staatsbürgerschaft"],
    ["identifikationsnummer", "Citizen ID"],
    ["discord_tag", "Discord Tag"],
    ["discord_user_id", "Discord User ID"],
    ["dmail", "D-Mail Adresse"],
    ["adresse", "Adresse"],
    ["postleitzahl", "Postleitzahl"],
    ["stadt", "Stadt"],
    ["personalbild_url", "Personalbild"],
    ["password", "Passwort"]
  ];

  for (const [key, label] of requiredFields) {
    if (!(state[key] ?? "").toString().trim()) {
      return setMsg("err", `${label} fehlt.`);
    }
  }

  // Passwort nochmals prüfen
  const pw = state.password.trim();
  const pwConfirm = state.password_confirm.trim();
  if (pw !== pwConfirm) {
    return setMsg("err", "Passwörter stimmen nicht überein!");
  }
  if (pw.length < 6) {
    return setMsg("err", "Passwort muss mindestens 6 Zeichen lang sein.");
  }

  if (!state.__dsgvo) return setMsg("err", "Bitte DSGVO Zustimmung bestätigen.");
  if (!state.__richtigkeit) return setMsg("err", "Bitte Richtigkeit bestätigen.");

  const btn = el("submitBtn");
  const old = btn?.innerHTML;
  if (btn){ btn.disabled = true; btn.textContent = "Wird erstellt…"; }

  try{
    const vorname = state.vorname.trim();
    const nachname = state.nachname.trim();
    const loginEmail = generateEmail(vorname, nachname);

    // 1. Firebase Auth Account erstellen
    const userCredential = await createUserWithEmailAndPassword(auth, loginEmail, pw);
    const uid = userCredential.user.uid;

    // 2. Mitgliedsnummer vergeben
    const memberNumber = await allocateMemberNumber();

    // 3. Firestore Dokument erstellen
    await createMemberDoc(memberNumber, uid);

    setMsg("ok", `✅ Erfolgreich erstellt!
    
Mitgliedsnummer: ${memberNumber}
Login-Email: ${loginEmail}

Du kannst dich nun mit dieser Email und deinem Passwort anmelden.`);

    setTimeout(() => {
      state = {};
      currentStep = 0;
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY + "_step");
      el("memberForm").reset();
    }, 6000);

  }catch(err){
    console.error(err);
    let errMsg = err?.message || err;
    if (err?.code === "auth/email-already-in-use") {
      errMsg = "Diese Email-Adresse existiert bereits im System!";
    } else if (err?.code === "auth/weak-password") {
      errMsg = "Das Passwort ist zu schwach!";
    }
    setMsg("err", "❌ Fehler: " + errMsg);
  }finally{
    if (btn){ btn.disabled = false; btn.innerHTML = old || `Absenden <span class="btn__shine"></span>`; }
  }
});

// Boot
initTheme();
renderStep();
