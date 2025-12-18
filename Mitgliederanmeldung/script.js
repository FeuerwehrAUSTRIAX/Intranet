import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  updateDoc,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  getAuth,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

/* =========================
 *  KONFIG
 * ========================= */
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

// Fixwerte (nicht anzeigen, aber speichern)
const DEFAULTS = {
  aktueller_dienstgrad: "PFM",
  funktion: "Mannschaft",
  ausbildner: "Nein",
  ausbildner_fur: "---",
  dienstzuteilung: "Feuerwehr Wiener Neustadt",
  aktives_mitglied: "Ja"
};

/* =========================
 *  Helpers
 * ========================= */
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

function normalizeMailPart(s){
  return String(s || "")
    .trim()
    .toLowerCase()
    .replaceAll("ä","ae").replaceAll("ö","oe").replaceAll("ü","ue").replaceAll("ß","ss")
    .replace(/[^a-z0-9. -]/g, "")
    .replace(/\s+/g, ".")
    .replace(/-+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "");
}
function computeFfwnEmail(vorname, nachname){
  const v = normalizeMailPart(vorname);
  const n = normalizeMailPart(nachname);
  if (!v || !n) return "";
  return `${v}.${n}@feuerwehr.gv.at`;
}
function isValidDobDdMmYyyy(v){
  const s = String(v || "").trim();
  if (!/^\d{2}\.\d{2}\.\d{4}$/.test(s)) return false;
  const [dd, mm, yyyy] = s.split(".").map(Number);
  if (!dd || !mm || !yyyy) return false;
  if (mm < 1 || mm > 12) return false;
  const maxDay = new Date(yyyy, mm, 0).getDate();
  return dd >= 1 && dd <= maxDay;
}

/* =========================
 *  Steps (Wizard)
 * ========================= */
const STEPS = [
  {
    key: "personal",
    title: "Personendaten",
    fields: [
      { id: "anrede", label: "Anrede", type: "select", required: false, options: ["", "Herr", "Frau", "Divers"] },
      { id: "titel", label: "Titel", type: "select", required: false,
        options: ["", "Ing.", "Dr.", "Mag.", "DI", "Prof.", "MBA", "BSc", "MSc"]
      },
      { id: "vorname", label: "Namen (Vorname)", type: "text", required: true, placeholder: "Max" },
      { id: "nachname", label: "Nachnamen", type: "text", required: true, placeholder: "Mustermann" },
      { id: "geburtsdatum", label: "Geburtsdatum", type: "text", required: true, placeholder: "dd.mm.yyyy" },
      { id: "beruf", label: "Beruf", type: "text", required: false },
      { id: "geburtsort", label: "Geburtsort", type: "text", required: false },
      { id: "familienstand", label: "Familienstand", type: "select", required: false,
        options: ["", "ledig", "verheiratet", "geschieden", "verwitwet", "eingetr. Partnerschaft"]
      },
      { id: "staatsburgerschaft", label: "Staatsbürgerschaft", type: "select", required: false,
        options: ["", "AT", "DE", "CH", "HU", "SK", "CZ", "SI", "HR", "IT", "RO", "BG", "PL", "Andere"]
      }
    ]
  },
  {
    key: "kontakt",
    title: "Kontakt",
    fields: [
      { id: "identifikationsnummer", label: "Identifikationsnummer (Citizen ID)", type: "text", required: true, placeholder: "CitizenID" },
      { id: "telefonnummer", label: "Telefonnummer", type: "tel", required: false, placeholder: "+43 …" },
      { id: "forumsname", label: "Forumsname", type: "text", required: false },

      { id: "discord_name", label: "Discord Name", type: "text", required: false, placeholder: "z.B. @marco oder marco#1234" },
      { id: "discord_userid", label: "Discord_UserID", type: "text", required: true,
        placeholder: "z.B. 123456789012345678", span2: true
      },

      { id: "ffwn_email", label: "FFWN Mailadresse", type: "email", required: true, placeholder: "", span2: true },

      // User muss nur Passwort erstellen (wird NICHT gespeichert)
      { id: "auth_password", label: "Passwort (für Login)", type: "password", required: true,
        placeholder: "Passwort festlegen (min. 6 Zeichen)", span2: true
      },

      { id: "dmail", label: "D-Mail Adresse (optional)", type: "email", required: false, placeholder: "name@email.at", span2: true }
    ]
  },
  {
    key: "adresse",
    title: "Adresse & Bild",
    fields: [
      { id: "adresse", label: "Adresse", type: "text", required: false, placeholder: "Straße Hausnummer", span2: true },
      { id: "postleitzahl", label: "Postleitzahl", type: "text", required: false, placeholder: "2700" },
      { id: "stadt", label: "Stadt", type: "text", required: false, placeholder: "Wiener Neustadt" },
      { id: "personalbild_url", label: "Personalbild (URL)", type: "text", required: false, placeholder: "https://…", span2: true }
    ]
  },
  { key: "summary", title: "Zusammenfassung", fields: [] }
];

/* =========================
 *  Firebase init
 * ========================= */
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/* =========================
 *  State (persist)
 * ========================= */
const STORAGE_KEY = "ffwn_member_wizard_state_v9";
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

/* Mail automatisch setzen */
function syncAutoEmail(){
  const mail = computeFfwnEmail(state.vorname, state.nachname);
  if (mail) state.ffwn_email = mail;
  saveState();
  const input = document.querySelector(`[name="ffwn_email"]`);
  if (input && mail) input.value = mail;
}

/* Mitgliedsnummer fortlaufend */
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

/* Firestore: Member Stammdaten (OHNE Passwort, UID kommt später) */
async function createMemberDoc(memberNumber){
  const vorname = (state.vorname ?? "").toString().trim();
  const nachname = (state.nachname ?? "").toString().trim();
  const docId = sanitizeDocId(`${memberNumber}_${vorname}_${nachname}`);
  const memberRef = doc(db, "orgs", ORG_ID, "members", docId);

  const einsendeDatum = todayAT();

  await setDoc(memberRef, {
    orgId: ORG_ID,
    mitgliedsnummer: memberNumber,

    anrede: state.anrede ?? null,
    titel: state.titel ?? null,
    vorname,
    nachname,

    geburtsdatum: state.geburtsdatum ?? null,
    beruf: state.beruf ?? null,
    geburtsort: state.geburtsort ?? null,
    familienstand: state.familienstand ?? null,
    staatsburgerschaft: state.staatsburgerschaft ?? null,

    identifikationsnummer: state.identifikationsnummer ?? null,
    telefonnummer: state.telefonnummer ?? null,
    forumsname: state.forumsname ?? null,

    discord_name: state.discord_name ?? null,
    discord_userid: state.discord_userid ?? null,

    ffwn_email: state.ffwn_email ?? null,
    dmail: state.dmail ?? null,

    adresse: state.adresse ?? null,
    postleitzahl: state.postleitzahl ?? null,
    stadt: state.stadt ?? null,
    personalbild_url: state.personalbild_url ?? null,

    // Fixwerte (nur speichern)
    mitglied_seit: einsendeDatum,
    aktueller_dienstgrad: DEFAULTS.aktueller_dienstgrad,
    letzte_beforderung: einsendeDatum,
    funktion: DEFAULTS.funktion,
    ausbildner: DEFAULTS.ausbildner,
    ausbildner_fur: DEFAULTS.ausbildner_fur,
    dienstzuteilung: DEFAULTS.dienstzuteilung,
    aktives_mitglied: DEFAULTS.aktives_mitglied,

    // UID wird nach Auth-Erstellung eingetragen
    uid: null,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  // Kurse Container
  const coursesMetaRef = doc(db, "orgs", ORG_ID, "members", docId, "courses", "_meta");
  await setDoc(coursesMetaRef, {
    createdAt: serverTimestamp(),
    note: "Auto-created courses container"
  });

  return docId;
}

/* Summary */
function renderSummary(host){
  const get = (k) => (state[k] ?? "").toString().trim();

  const rowsPerson = [
    ["Anrede", get("anrede")],
    ["Titel", get("titel")],
    ["Geburtsdatum", get("geburtsdatum")],
    ["Beruf", get("beruf")],
    ["Geburtsort", get("geburtsort")],
    ["Familienstand", get("familienstand")],
    ["Staatsbürgerschaft", get("staatsburgerschaft")]
  ];

  const rowsKontakt = [
    ["Citizen ID", get("identifikationsnummer")],
    ["Telefonnummer", get("telefonnummer")],
    ["Forumsname", get("forumsname")],
    ["Discord Name", get("discord_name")],
    ["Discord_UserID", get("discord_userid")],
    ["FFWN Mailadresse", get("ffwn_email")],
    ["Passwort", get("auth_password") ? "••••••••" : ""],
    ["D-Mail Adresse", get("dmail")]
  ];

  const rowsAdresse = [
    ["Adresse", get("adresse")],
    ["Postleitzahl", get("postleitzahl")],
    ["Stadt", get("stadt")],
    ["Personalbild (URL)", get("personalbild_url")]
  ];

  const requiredKeys = [
    ["vorname", "Vorname"],
    ["nachname", "Nachname"],
    ["geburtsdatum", "Geburtsdatum"],
    ["identifikationsnummer", "Citizen ID"],
    ["discord_userid", "Discord_UserID"],
    ["ffwn_email", "FFWN Mailadresse"],
    ["auth_password", "Passwort"]
  ];
  const missing = requiredKeys.filter(([k]) => !get(k)).map(([,label]) => label);

  const wrap = document.createElement("div");
  wrap.className = "summaryV2";

  const hero = document.createElement("div");
  hero.className = "summaryHero";
  const name = `${get("vorname") || "—"} ${get("nachname") || ""}`.trim();
  hero.innerHTML = `
    <div class="summaryHero__left">
      <div class="summaryHero__name">${escapeHtml(name || "—")}</div>
      <div class="summaryHero__unit">${escapeHtml(DEFAULTS.dienstzuteilung)}</div>
    </div>
  `;

  const imgUrl = get("personalbild_url");
  if (imgUrl){
    const media = document.createElement("div");
    media.className = "summaryMedia";
    const img = document.createElement("img");
    img.src = imgUrl;
    img.alt = "Personalbild Vorschau";
    img.onerror = () => media.remove();
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

  const cards = document.createElement("div");
  cards.className = "summaryCards";
  cards.appendChild(makeCard("Person", rowsPerson));
  cards.appendChild(makeCard("Kontakt", rowsKontakt));
  cards.appendChild(makeCard("Adresse", rowsAdresse));
  wrap.appendChild(cards);

  const checks = document.createElement("div");
  checks.className = "summaryChecks";
  checks.innerHTML = `
    <label class="check">
      <input id="dsgvo" type="checkbox" ${state.__dsgvo ? "checked" : ""}>
      <span>Ich stimme der Datenverarbeitung (DSGVO) zu. <span class="req">*</span></span>
    </label>

    <label class="check">
      <input id="richtigkeit" type="checkbox" ${state.__richtigkeit ? "checked" : ""}>
      <span>Ich bestätige, dass die Angaben korrekt sind. <span class="req">*</span></span>
    </label>

    <div class="summaryHint">
      Mit „Absenden“ werden Stammdaten gespeichert, der Login erstellt und die UID in den Stammdaten eingetragen.
    </div>
  `;
  wrap.appendChild(checks);
  host.appendChild(wrap);

  document.getElementById("dsgvo")?.addEventListener("change", e => { state.__dsgvo = e.target.checked; saveState(); });
  document.getElementById("richtigkeit")?.addEventListener("change", e => { state.__richtigkeit = e.target.checked; saveState(); });

  function makeCard(title, rows){
    const c = document.createElement("div");
    c.className = "sCard";
    const filled = rows.filter(([,v]) => (v ?? "").trim()).length;
    c.innerHTML = `
      <div class="sCard__title">
        <div>${escapeHtml(title)}</div>
        <div class="sCard__count">${filled}/${rows.length}</div>
      </div>
    `;

    const kv = document.createElement("div");
    kv.className = "kv";

    for (const [k,v] of rows){
      const val = (v ?? "").trim();
      const row = document.createElement("div");
      row.className = "kvRow";
      row.innerHTML = `
        <div class="kvK">${escapeHtml(k)}</div>
        <div class="kvV ${val ? "" : "kvV--empty"}">${escapeHtml(val || "—")}</div>
      `;
      kv.appendChild(row);
    }
    c.appendChild(kv);
    return c;
  }
}

/* Render Step */
function renderStep(){
  saveState();
  saveStep();
  syncAutoEmail();

  const step = STEPS[currentStep];
  const host = el("stepHost");
  if (!host) return;
  host.innerHTML = "";

  // Progress erst ab Schritt 2
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

      // ffwn_email readonly
      if (f.id === "ffwn_email"){
        input.readOnly = true;
      }

      const v = state[f.id];
      if (v !== undefined && v !== null) input.value = String(v);

      input.addEventListener("input", () => {
        state[f.id] = input.value;
        saveState();

        if (f.id === "vorname" || f.id === "nachname"){
          syncAutoEmail();
        }
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

/* Validate Step */
function validateStep(){
  const step = STEPS[currentStep];
  if (step.key === "summary") return true;

  for (const f of step.fields){
    if (!f.required) continue;
    const v = (state[f.id] ?? "").toString().trim();
    if (!v){
      setMsg("err", `Bitte ausfüllen: ${f.label}`);
      document.querySelector(`[name="${CSS.escape(f.id)}"]`)?.focus?.();
      return false;
    }
  }

  if (step.key === "personal"){
    const dob = (state.geburtsdatum ?? "").toString().trim();
    if (dob && !isValidDobDdMmYyyy(dob)){
      setMsg("err", "Geburtsdatum bitte im Format dd.mm.yyyy eingeben.");
      document.querySelector(`[name="geburtsdatum"]`)?.focus?.();
      return false;
    }
  }

  if (step.key === "kontakt"){
    syncAutoEmail();
    const mail = (state.ffwn_email ?? "").toString().trim();
    if (!mail){
      setMsg("err", "FFWN Mailadresse konnte nicht erzeugt werden (Vorname/Nachname prüfen).");
      return false;
    }
  }

  return true;
}

/* Theme */
function initTheme(){
  const stored = localStorage.getItem("ffwn_theme");
  const initial = stored || "dark";
  document.documentElement.setAttribute("data-theme", initial);
  el("themeLabel").textContent = initial === "dark" ? "Dark" : "Light";

  el("themeToggle")?.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") || "dark";
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("ffwn_theme", next);
    el("themeLabel").textContent = next === "dark" ? "Dark" : "Light";
  });
}

/* =========================
 *  Navigation / Events
 * ========================= */
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

  // Final Checks
  const vorname = (state.vorname ?? "").toString().trim();
  const nachname = (state.nachname ?? "").toString().trim();
  if (!vorname || !nachname) return setMsg("err", "Vorname/Nachname fehlt.");

  const dob = (state.geburtsdatum ?? "").toString().trim();
  if (!dob) return setMsg("err", "Geburtsdatum fehlt.");
  if (!isValidDobDdMmYyyy(dob)) return setMsg("err", "Geburtsdatum bitte im Format dd.mm.yyyy eingeben.");

  if (!(state.identifikationsnummer ?? "").toString().trim()) return setMsg("err", "Citizen ID fehlt.");
  if (!(state.discord_userid ?? "").toString().trim()) return setMsg("err", "Discord_UserID fehlt.");

  syncAutoEmail();
  const email = (state.ffwn_email ?? "").toString().trim();
  if (!email) return setMsg("err", "FFWN Mailadresse fehlt.");

  const password = (state.auth_password ?? "").toString();
  if (!password.trim()) return setMsg("err", "Passwort fehlt.");
  if (password.trim().length < 6) return setMsg("err", "Passwort muss mindestens 6 Zeichen haben.");

  if (!state.__dsgvo) return setMsg("err", "Bitte DSGVO Zustimmung bestätigen.");
  if (!state.__richtigkeit) return setMsg("err", "Bitte Richtigkeit bestätigen.");

  const btn = el("submitBtn");
  const old = btn?.innerHTML;
  if (btn){ btn.disabled = true; btn.textContent = "Wird gespeichert…"; }

  try{
    // 1) Member speichern (OHNE UID)
    const memberNumber = await allocateMemberNumber();
    const docId = await createMemberDoc(memberNumber);

    // 2) Firebase Auth User anlegen (liefert UID)
    if (btn){ btn.textContent = "Login wird erstellt…"; }
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;

    // 3) UID in Member-Dokument schreiben
    if (btn){ btn.textContent = "UID wird gespeichert…"; }
    await updateDoc(doc(db, "orgs", ORG_ID, "members", docId), {
      uid,
      updatedAt: serverTimestamp()
    });

    setMsg("ok", `✅ Fertig!\nMitgliedsnummer: ${memberNumber}\nUID: ${uid}`);

    // Passwort aus State entfernen
    delete state.auth_password;
    saveState();

    // Reset
    setTimeout(() => {
      state = {};
      currentStep = 0;
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY + "_step");
      el("memberForm").reset();
    }, 1500);

  }catch(err){
    console.error(err);
    setMsg("err", "❌ Fehler: " + (err?.message || err));
  }finally{
    if (btn){ btn.disabled = false; btn.innerHTML = old || `Absenden <span class="btn__shine"></span>`; }
  }
});

/* Boot */
initTheme();
renderStep();
