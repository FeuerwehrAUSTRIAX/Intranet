import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  deleteUser
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

// Apps Script Web App URL (für Discord Notify)
const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbz709Q94HDrCl55FOtHWUpXDe0rFvq9De61rb2M7YetOlhS3KeRAnway03yKG9vRjV3/exec";

// Startseite für Popout-Link (ggf. anpassen)
const HOME_URL = "index.html";

// Fixwerte (nicht anzeigen in Steps, aber im Summary als Info + speichern)
const DEFAULTS = {
  aktueller_dienstgrad: "PFM",
  funktion: "Mannschaft",
  ausbildner: "Nein",
  ausbildner_fur: "---",
  dienstzuteilung: "Feuerwehr Wiener Neustadt",
  aktives_mitglied: "Ja"
};

const STEPS = [
  // ✅ NEU: Token-Step VOR allen anderen
  {
    key: "token",
    title: "Einladungscode",
    fields: [
      {
        id: "invite_token",
        label: "Token",
        type: "text",
        required: true,
        placeholder: "z.B. FFWN-6ERL-JSQ7",
        span2: true
      }
    ]
  },

  {
    key: "personal",
    title: "Personendaten",
    fields: [
      { id: "anrede", label: "Anrede", type: "select", required: false, options: ["", "Herr", "Frau", "Divers"] },

      // optional: Titel als Dropdown (wenn du willst)
      // { id: "titel", label: "Titel", type: "select", required: false, options: ["", "Dr.", "Mag.", "Mag. (FH)", "Ing.", "Dipl.-Ing.", "Prof."] },
      { id: "titel", label: "Titel", type: "text", required: false, placeholder: "z.B. Ing., Dr." },

      { id: "vorname", label: "Namen (Vorname)", type: "text", required: true, placeholder: "Max" },
      { id: "nachname", label: "Nachnamen", type: "text", required: true, placeholder: "Mustermann" },

      { id: "geburtsdatum", label: "Geburtsdatum", type: "date", required: true },
      { id: "beruf", label: "Beruf", type: "text", required: false },
      { id: "geburtsort", label: "Geburtsort", type: "text", required: false },
      { id: "familienstand", label: "Familienstand", type: "select", required: false, options: ["", "ledig", "verheiratet", "geschieden", "verwitwet", "eingetr. Partnerschaft"] },

      // optional: Staatsbürgerschaft als Dropdown (deine lange Liste kannst du hier einsetzen)
      // { id: "staatsburgerschaft", label: "Staatsbürgerschaft", type: "select", required: false, options: ["", "AT – Österreich", ...] },
      { id: "staatsburgerschaft", label: "Staatsbürgerschaft", type: "text", required: false, placeholder: "AT" }
    ]
  },
  {
    key: "kontakt",
    title: "Kontakt",
    fields: [
      { id: "identifikationsnummer", label: "Identifikationsnummer (Citizen ID)", type: "text", required: true, placeholder: "CitizenID" },
      { id: "telefonnummer", label: "Telefonnummer", type: "tel", required: false, placeholder: "+43 …" },
      { id: "forumsname", label: "Forumsname", type: "text", required: false, placeholder: "Forumsname" },
      { id: "discord_id", label: "Discord ID", type: "text", required: false, placeholder: "Discord ID - 12 od. 15 Stellig" },
      { id: "dmail", label: "D-Mail Adresse", type: "email", required: true, placeholder: "name@email.at", span2: true }
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
  {
    key: "login",
    title: "Login-Daten",
    fields: [
      {
        id: "login_mail",
        label: "Dienstliche E-Mail-Adresse",
        type: "email",
        required: true,
        placeholder: "vorname.nachname@feuerwehr.gv.at",
        span2: true
      },
      {
        id: "password",
        label: "Passwort",
        type: "password",
        required: true
      },
      {
        id: "password_repeat",
        label: "Passwort wiederholen",
        type: "password",
        required: true
      }
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

/** ✅ Popout nach Erfolg */
function showSuccessPopout({ memberNumber, vorname, nachname, homeUrl = HOME_URL }) {
  document.getElementById("successPopout")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "successPopout";
  overlay.innerHTML = `
    <div class="popout__backdrop"></div>
    <div class="popout__card" role="dialog" aria-modal="true">
      <div class="popout__badge">Gespeichert</div>
      <div class="popout__title">${escapeHtml(memberNumber || "—")}</div>
      <div class="popout__subtitle">${escapeHtml(`${vorname || ""} ${nachname || ""}`.trim() || "—")}</div>

      <div class="popout__actions">
        <a class="popout__btn" href="${escapeHtml(homeUrl)}">Zur Startseite</a>
        <button class="popout__btn popout__btn--ghost" type="button" id="popoutClose">Schließen</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector("#popoutClose")?.addEventListener("click", close);
  overlay.querySelector(".popout__backdrop")?.addEventListener("click", close);

  const onKey = (ev) => {
    if (ev.key === "Escape") {
      close();
      document.removeEventListener("keydown", onKey);
    }
  };
  document.addEventListener("keydown", onKey);
}

// Wizard-State (Step-Wechsel + Reload safe)
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

function updateLoginMail(){
  const v = (state.vorname ?? "").toString().trim();
  const n = (state.nachname ?? "").toString().trim();
  if (!v || !n) return;

  const normalize = (s) => s
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/ä/g,"ae")
    .replace(/ö/g,"oe")
    .replace(/ü/g,"ue")
    .replace(/ß/g,"ss");

  const mail = `${normalize(v)}.${normalize(n)}@feuerwehr.gv.at`;
  state.login_mail = mail;

  const input = document.querySelector('[name="login_mail"]');
  if (input) input.value = mail;

  saveState();
}

/** ✅ Token check (existiert/active/unused) */
async function checkInviteTokenOrThrow(token){
  const tokenRef = doc(db, "orgs", ORG_ID, "tokens", token);
  const snap = await getDoc(tokenRef);

  if (!snap.exists()) throw new Error("❌ Token existiert nicht.");
  const data = snap.data();

  if (!data.active) throw new Error("❌ Token ist deaktiviert.");
  if (data.used) throw new Error("❌ Token wurde bereits eingelöst.");

  return true;
}

/** ✅ Token final einlösen (transaction-safe) */
async function redeemInviteTokenOrThrow(token, usedBy){
  const tokenRef = doc(db, "orgs", ORG_ID, "tokens", token);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(tokenRef);

    if (!snap.exists()) throw new Error("❌ Token existiert nicht.");
    const data = snap.data();

    if (!data.active) throw new Error("❌ Token ist deaktiviert.");
    if (data.used) throw new Error("❌ Token wurde bereits eingelöst.");

    tx.update(tokenRef, {
      used: true,
      usedAt: serverTimestamp(),
      usedBy: usedBy ?? null
    });
  });
}

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
    ["D-Mail Adresse", get("dmail")],
    ["Forumsname", get("forumsname")],
    ["Discord ID", get("discord_id")]
  ];

  const rowsAdresse = [
    ["Adresse", get("adresse")],
    ["Postleitzahl", get("postleitzahl")],
    ["Stadt", get("stadt")],
    ["Personalbild (URL)", get("personalbild_url")]
  ];

  const rowsLogin = [
    ["Login E-Mail", get("login_mail")]
  ];

  const requiredKeys = [
    ["invite_token", "Token"],
    ["vorname", "Vorname"],
    ["nachname", "Nachname"],
    ["geburtsdatum", "Geburtsdatum"],
    ["identifikationsnummer", "Citizen ID"],
    ["dmail", "D-Mail Adresse"],
    ["login_mail", "Login E-Mail"],
    ["password", "Passwort"],
    ["password_repeat", "Passwort wiederholen"]
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

  const loginCardWrap = document.createElement("div");
  loginCardWrap.className = "summaryCards";
  loginCardWrap.appendChild(makeCard("Login", rowsLogin));
  wrap.appendChild(loginCardWrap);

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
      Mit „Absenden“ wird gespeichert und danach die Mitgliedsnummer angezeigt.
    </div>
  `;
  wrap.appendChild(checks);
  host.appendChild(wrap);

  document.getElementById("dsgvo")?.addEventListener("change", e => {
    state.__dsgvo = e.target.checked; saveState();
  });
  document.getElementById("richtigkeit")?.addEventListener("change", e => {
    state.__richtigkeit = e.target.checked; saveState();
  });

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

  if (step.key === "login"){
    const hint = document.createElement("div");
    hint.className = "summaryHint";
    hint.textContent = "⚠️ Diese Zugangsdaten werden später für die Anmeldung im internen System benötigt.";
    host.appendChild(hint);

    updateLoginMail();
  }

  if (step.key === "token"){
    const hint = document.createElement("div");
    hint.className = "summaryHint";
    hint.textContent = "Bitte gib den Einladungscode ein. Ohne gültigen Token ist keine Registrierung möglich.";
    host.appendChild(hint);
  }

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

      if (f.id === "login_mail"){
        input.readOnly = true;
      }

      const v = state[f.id];
      if (v !== undefined && v !== null) input.value = String(v);

      input.addEventListener("input", () => {
        state[f.id] = input.value;
        saveState();

        if (f.id === "vorname" || f.id === "nachname") {
          updateLoginMail();
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

async function validateStep(){
  const step = STEPS[currentStep];
  if (step.key === "summary") return true;

  // ✅ NEU: Token-Step prüfen
  if (step.key === "token"){
    const token = (state.invite_token ?? "").toString().trim();
    if (!token){
      setMsg("err", "Bitte Token eingeben.");
      document.querySelector(`[name="invite_token"]`)?.focus?.();
      return false;
    }
    try{
      await checkInviteTokenOrThrow(token);
      setMsg("ok", "✅ Token gültig.");
      return true;
    }catch(e){
      setMsg("err", e?.message || String(e));
      document.querySelector(`[name="invite_token"]`)?.focus?.();
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

  if (step.key === "kontakt"){
    const citizen = (state.identifikationsnummer ?? "").toString().trim();
    if (!citizen){
      setMsg("err", "Identifikationsnummer (Citizen ID) ist Pflicht.");
      document.querySelector(`[name="identifikationsnummer"]`)?.focus?.();
      return false;
    }
  }

  if (step.key === "login"){
    if ((state.password ?? "") !== (state.password_repeat ?? "")) {
      setMsg("err", "❌ Die Passwörter stimmen nicht überein.");
      document.querySelector(`[name="password_repeat"]`)?.focus?.();
      return false;
    }
  }

  return true;
}

async function createMemberDoc(memberNumber, authUid){
  const vorname = (state.vorname ?? "").toString().trim();
  const nachname = (state.nachname ?? "").toString().trim();
  const docId = sanitizeDocId(`${memberNumber}_${vorname}_${nachname}`);
  const memberRef = doc(db, "orgs", ORG_ID, "members", docId);

  const einsendeDatum = todayAT();

  await setDoc(memberRef, {
    orgId: ORG_ID,
    mitgliedsnummer: memberNumber,

    // ✅ Auth-Verknüpfung
    auth_uid: authUid,
    login_mail: state.login_mail ?? null,

    // optional: Token im Member speichern (hilfreich fürs Tracking)
    invite_token: state.invite_token ?? null,

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
    discord_id: state.discord_id ?? null,
    adresse: state.adresse ?? null,
    postleitzahl: state.postleitzahl ?? null,
    stadt: state.stadt ?? null,
    dmail: state.dmail ?? null,
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

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  const coursesMetaRef = doc(db, "orgs", ORG_ID, "members", docId, "courses", "_meta");
  await setDoc(coursesMetaRef, {
    createdAt: serverTimestamp(),
    note: "Auto-created courses container"
  });

  return docId;
}

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

// Navigation
el("backBtn")?.addEventListener("click", () => {
  if (currentStep <= 0) return;
  currentStep -= 1;
  renderStep();
});

el("nextBtn")?.addEventListener("click", async () => {
  if (!(await validateStep())) return;
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

  // ✅ Token muss vorhanden sein (zusätzliche Sicherheit)
  const inviteToken = (state.invite_token ?? "").toString().trim();
  if (!inviteToken) return setMsg("err", "Token fehlt.");

  // Final checks
  const vorname = (state.vorname ?? "").toString().trim();
  const nachname = (state.nachname ?? "").toString().trim();
  if (!vorname || !nachname) return setMsg("err", "Vorname/Nachname fehlt.");
  if (!(state.geburtsdatum ?? "").toString().trim()) return setMsg("err", "Geburtsdatum fehlt.");
  if (!(state.dmail ?? "").toString().trim()) return setMsg("err", "D-Mail Adresse fehlt.");
  if (!(state.identifikationsnummer ?? "").toString().trim()) return setMsg("err", "Citizen ID fehlt.");

  if (!(state.login_mail ?? "").toString().trim()) return setMsg("err", "Login E-Mail fehlt.");
  if (!(state.password ?? "").toString().trim()) return setMsg("err", "Passwort fehlt.");
  if ((state.password ?? "") !== (state.password_repeat ?? "")) return setMsg("err", "Passwörter stimmen nicht überein.");

  if (!state.__dsgvo) return setMsg("err", "Bitte DSGVO Zustimmung bestätigen.");
  if (!state.__richtigkeit) return setMsg("err", "Bitte Richtigkeit bestätigen.");

  const btn = el("submitBtn");
  const old = btn?.innerHTML;
  if (btn){ btn.disabled = true; btn.textContent = "Wird gesendet…"; }

  let createdAuthUser = null;

  try{
    // ✅ Nochmal Token check (falls er in der Zwischenzeit eingelöst wurde)
    await checkInviteTokenOrThrow(inviteToken);

    // 1) Auth-User erstellen
    const email = (state.login_mail ?? "").toString().trim();
    const password = (state.password ?? "").toString();

    const cred = await createUserWithEmailAndPassword(auth, email, password);
    createdAuthUser = cred.user; // für rollback
    const uid = cred.user.uid;

    // 2) Member Nummer + Doc erstellen (UID speichern)
    const memberNumber = await allocateMemberNumber();
    const docId = await createMemberDoc(memberNumber, uid);

    // 3) ✅ Token final einlösen (transaction-safe)
    await redeemInviteTokenOrThrow(inviteToken, email);

    // 🔔 Discord Notify via Apps Script (ASYNC – blockiert NICHT)
    fetch(APPS_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({
        event: "member_created",
        memberNumber,
        uid,
        docId,

        // Person
        anrede: state.anrede ?? null,
        titel: state.titel ?? null,
        vorname: state.vorname ?? null,
        nachname: state.nachname ?? null,
        geburtsdatum: state.geburtsdatum ?? null,
        beruf: state.beruf ?? null,
        geburtsort: state.geburtsort ?? null,
        familienstand: state.familienstand ?? null,
        staatsburgerschaft: state.staatsburgerschaft ?? null,

        // Kontakt
        identifikationsnummer: state.identifikationsnummer ?? null,
        telefonnummer: state.telefonnummer ?? null,
        forumsname: state.forumsname ?? null,
        discord_id: state.discord_id ?? null,
        dmail: state.dmail ?? null,

        // Adresse
        adresse: state.adresse ?? null,
        postleitzahl: state.postleitzahl ?? null,
        stadt: state.stadt ?? null,
        personalbild_url: state.personalbild_url ?? null,

        // Login (ohne Passwort!)
        login_mail: state.login_mail ?? null,

        // Token
        invite_token: inviteToken
      })
    }).catch(() => {});

    // ✅ Popout anzeigen
    showSuccessPopout({ memberNumber, vorname, nachname, homeUrl: HOME_URL });

    // Wizard-Status zurücksetzen (damit neuer Eintrag clean ist)
    setTimeout(() => {
      state = {};
      currentStep = 0;
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY + "_step");
      el("memberForm").reset();
      renderStep();
    }, 800);

  }catch(err){
    console.error(err);

    // Rollback: wenn Auth angelegt, aber danach was schief ging -> User wieder löschen
    try{
      if (createdAuthUser && auth.currentUser) {
        await deleteUser(auth.currentUser);
      }
    }catch(e){
      console.warn("Rollback deleteUser fehlgeschlagen:", e);
    }

    const msg =
      err?.code === "auth/email-already-in-use" ? "❌ Diese Login-E-Mail existiert bereits."
    : err?.code === "auth/invalid-email" ? "❌ Ungültige E-Mail."
    : err?.code === "auth/weak-password" ? "❌ Passwort zu schwach (Firebase)."
    : err?.message ? err.message
    : "❌ Fehler: " + String(err);

    setMsg("err", msg);

  }finally{
    if (btn){ btn.disabled = false; btn.innerHTML = old || `Absenden <span class="btn__shine"></span>`; }
  }
});

// Boot
initTheme();
renderStep();
