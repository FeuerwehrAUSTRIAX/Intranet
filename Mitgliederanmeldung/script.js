import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";

/* ================= FIREBASE ================= */
const firebaseConfig = {
  apiKey: "AIzaSyAEKPiUzXc_tFvmiop4hDEdhv8Rkg2kWjU",
  authDomain: "intranet-ffwn.firebaseapp.com",
  projectId: "intranet-ffwn",
  storageBucket: "intranet-ffwn.firebasestorage.app",
  messagingSenderId: "221055908808",
  appId: "1:221055908808:web:b1c63120bc73aa26a6defd"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const functions = getFunctions(app);

/* ================= CONFIG ================= */
const ORG_ID = "ffwn";
const EMAIL_DOMAIN = "feuerwehr.gv.at";
const REDIRECT_AFTER_SUCCESS = "login.html"; // <— dahin leiten wir weiter

const DEFAULTS = {
  aktueller_dienstgrad: "PFM",
  funktion: "Mannschaft",
  ausbildner: "Nein",
  ausbildner_fur: "---",
  dienstzuteilung: "Feuerwehr Wiener Neustadt",
  aktives_mitglied: "Ja"
};

/* ================= STEPS ================= */
const STEPS = [
  {
    key: "personal",
    title: "Personendaten",
    fields: [
      { id: "anrede", label: "Anrede", type: "select", options: ["", "Herr", "Frau", "Divers"] },
      { id: "titel", label: "Titel", type: "text" },
      { id: "vorname", label: "Vorname", type: "text", required: true },
      { id: "nachname", label: "Nachname", type: "text", required: true },
      { id: "geburtsdatum", label: "Geburtsdatum", type: "date", required: true },
      { id: "beruf", label: "Beruf", type: "text" },
      { id: "geburtsort", label: "Geburtsort", type: "text" },
      { id: "familienstand", label: "Familienstand", type: "select", options: ["", "ledig", "verheiratet", "geschieden", "verwitwet"] },
      { id: "staatsburgerschaft", label: "Staatsbürgerschaft", type: "text" }
    ]
  },
  {
    key: "kontakt",
    title: "Kontakt",
    fields: [
      { id: "identifikationsnummer", label: "Citizen ID", type: "text", required: true },
      { id: "telefonnummer", label: "Telefonnummer", type: "tel" },
      { id: "forumsname", label: "Forumsname", type: "text" },
      { id: "discord_id", label: "Discord ID", type: "text" },
      { id: "dmail", label: "D-Mail Adresse", type: "email", required: true, span2: true }
    ]
  },
  {
    key: "adresse",
    title: "Adresse & Bild",
    fields: [
      { id: "adresse", label: "Adresse", type: "text", span2: true },
      { id: "postleitzahl", label: "Postleitzahl", type: "text" },
      { id: "stadt", label: "Stadt", type: "text" },
      { id: "personalbild_url", label: "Personalbild (URL)", type: "text", span2: true }
    ]
  },
  { key: "summary", title: "Account & Zusammenfassung", fields: [] }
];

/* ================= STATE ================= */
// Formdaten dürfen persistieren – Token/Passwort NICHT!
const STORAGE_KEY = "ffwn_member_register_v1";
let state = loadState();
let currentStep = loadStep();

// Token & Passwort NUR RAM:
let sessionToken = null;
let sessionTokenOk = false;
let sessionPw1 = "";
let sessionPw2 = "";

/* ================= HELPERS ================= */
const el = (id) => document.getElementById(id);

function loadState(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}
function saveState(){
  // Token/Passwort nie speichern
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function loadStep(){
  const n = Number(localStorage.getItem(STORAGE_KEY+"_step") || "0");
  return Number.isFinite(n) ? Math.max(0, Math.min(n, STEPS.length-1)) : 0;
}
function saveStep(){ localStorage.setItem(STORAGE_KEY+"_step", String(currentStep)); }

function setMsg(kind, txt){
  el("msgOk").style.display = "none";
  el("msgErr").style.display = "none";
  if(!txt) return;
  const box = kind === "ok" ? el("msgOk") : el("msgErr");
  box.textContent = txt;
  box.style.display = "block";
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function normToken(s){
  return String(s || "").trim().replace(/\s+/g, "").toUpperCase();
}

// Name -> email-safe
function slugName(s){
  return String(s || "")
    .trim()
    .toLowerCase()
    .replaceAll("ä","ae")
    .replaceAll("ö","oe")
    .replaceAll("ü","ue")
    .replaceAll("ß","ss")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\./, "")
    .replace(/\.$/, "");
}

function suggestedEmail(){
  const v = slugName(state.vorname);
  const n = slugName(state.nachname);
  if(!v || !n) return "";
  return `${v}.${n}@${EMAIL_DOMAIN}`;
}

function buildMemberData(){
  return {
    anrede: state.anrede ?? null,
    titel: state.titel ?? null,
    vorname: String(state.vorname||"").trim(),
    nachname: String(state.nachname||"").trim(),
    geburtsdatum: state.geburtsdatum ?? null,
    beruf: state.beruf ?? null,
    geburtsort: state.geburtsort ?? null,
    familienstand: state.familienstand ?? null,
    staatsburgerschaft: state.staatsburgerschaft ?? null,
    identifikationsnummer: state.identifikationsnummer ?? null,
    telefonnummer: state.telefonnummer ?? null,
    forumsname: state.forumsname ?? null,
    discord_id: state.discord_id ?? null,
    dmail: state.dmail ?? null,
    adresse: state.adresse ?? null,
    postleitzahl: state.postleitzahl ?? null,
    stadt: state.stadt ?? null,
    personalbild_url: state.personalbild_url ?? null,

    // Defaults:
    aktueller_dienstgrad: DEFAULTS.aktueller_dienstgrad,
    funktion: DEFAULTS.funktion,
    ausbildner: DEFAULTS.ausbildner,
    ausbildner_fur: DEFAULTS.ausbildner_fur,
    dienstzuteilung: DEFAULTS.dienstzuteilung,
    aktives_mitglied: DEFAULTS.aktives_mitglied,
  };
}

/* ================= THEME ================= */
function initTheme(){
  const stored = localStorage.getItem("ffwn_theme") || "dark";
  document.documentElement.setAttribute("data-theme", stored);
  el("themeLabel").textContent = stored === "dark" ? "Dark" : "Light";

  el("themeToggle").onclick = () => {
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("ffwn_theme", next);
    el("themeLabel").textContent = next === "dark" ? "Dark" : "Light";
  };
}

/* ================= TOKEN GATE ================= */
async function checkToken(token){
  const ref = doc(db, "orgs", ORG_ID, "tokens", token);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { ok:false, reason:"Token nicht gefunden." };
  const data = snap.data();
  if (data.active === false) return { ok:false, reason:"Token deaktiviert." };
  if (data.used === true) return { ok:false, reason:"Token wurde bereits verwendet." };
  return { ok:true };
}

function showTokenMsg(type, text){
  const box = el("tokenMsg");
  box.className = "tokenGate__msg " + (type || "");
  box.textContent = text || "";
}

function lockForm(){
  el("memberForm").style.display = "none";
  el("tokenGate").style.display = "block";
}

function unlockForm(){
  el("tokenGate").style.display = "none";
  el("memberForm").style.display = "block";
  renderStep();
}

async function handleTokenCheck(){
  const token = normToken(el("tokenInput").value);
  el("tokenInput").value = token;
  if (!token) return showTokenMsg("err", "Bitte Token eingeben.");

  el("tokenBtn").disabled = true;
  showTokenMsg("", "Prüfe…");

  try{
    const res = await checkToken(token);
    if (!res.ok){
      sessionToken = null; sessionTokenOk = false;
      showTokenMsg("err", res.reason);
      return;
    }
    sessionToken = token; sessionTokenOk = true; // nur RAM
    showTokenMsg("ok", "✅ Token gültig. Formular freigeschaltet.");
    unlockForm();
  }catch(e){
    console.error(e);
    sessionToken = null; sessionTokenOk = false;
    showTokenMsg("err", `Fehler beim Prüfen: ${e?.message || e}`);
  }finally{
    el("tokenBtn").disabled = false;
  }
}

/* ================= SUMMARY ================= */
function renderSummary(host){
  const g = (k) => (state[k] ?? "").toString().trim();
  const mail = state.login_email || suggestedEmail();

  const wrap = document.createElement("div");
  wrap.className = "summaryV2";

  wrap.innerHTML = `
    <div class="sCard">
      <div class="sCard__title"><div>Intranet-Login erstellen</div><div class="sCard__count">Pflicht</div></div>
      <div class="grid">
        <div class="field field--span2">
          <label>Login E-Mail <span class="req">*</span></label>
          <input id="loginEmail" type="email" value="${escapeHtml(mail)}" autocomplete="email" />
          <div class="muted" style="font-size:12px;margin-top:6px;">
            Standard: vorname.nachname@${escapeHtml(EMAIL_DOMAIN)}
          </div>
        </div>

        <div class="field">
          <label>Passwort <span class="req">*</span></label>
          <input id="pw1" type="password" minlength="8" autocomplete="new-password" placeholder="mind. 8 Zeichen" />
        </div>

        <div class="field">
          <label>Passwort wiederholen <span class="req">*</span></label>
          <input id="pw2" type="password" minlength="8" autocomplete="new-password" placeholder="nochmal eingeben" />
        </div>
      </div>
      <div class="muted" style="margin-top:10px">
        Hinweis: Das Passwort wird <b>nur</b> in Firebase Authentication gespeichert (nicht in Firestore).
      </div>
    </div>

    <div class="sCard" style="margin-top:12px">
      <div class="sCard__title"><div>Zusammenfassung</div><div class="sCard__count">Info</div></div>
      <div class="kvRow"><div class="kvK">Name</div><div class="kvV">${escapeHtml(`${g("vorname")} ${g("nachname")}`)}</div></div>
      <div class="kvRow"><div class="kvK">Discord</div><div class="kvV">${escapeHtml(g("discord_id") || "—")}</div></div>
      <div class="kvRow"><div class="kvK">D-Mail</div><div class="kvV">${escapeHtml(g("dmail") || "—")}</div></div>
    </div>

    <div class="summaryChecks">
      <label class="check">
        <input id="dsgvo" type="checkbox" ${state.__dsgvo ? "checked":""}>
        <span>Ich stimme der Datenverarbeitung (DSGVO) zu <span class="req">*</span></span>
      </label>

      <label class="check">
        <input id="richtigkeit" type="checkbox" ${state.__richtigkeit ? "checked":""}>
        <span>Ich bestätige, dass die Angaben korrekt sind <span class="req">*</span></span>
      </label>
    </div>
  `;

  host.appendChild(wrap);

  el("dsgvo").onchange = (e)=>{ state.__dsgvo = e.target.checked; saveState(); };
  el("richtigkeit").onchange = (e)=>{ state.__richtigkeit = e.target.checked; saveState(); };

  el("loginEmail").oninput = (e)=>{
    state.login_email = e.target.value.trim().toLowerCase();
    saveState();
  };

  el("pw1").oninput = (e)=>{ sessionPw1 = e.target.value; };
  el("pw2").oninput = (e)=>{ sessionPw2 = e.target.value; };
}

/* ================= FORM RENDER ================= */
function renderStep(){
  saveState();
  saveStep();

  const step = STEPS[currentStep];
  const host = el("stepHost");
  host.innerHTML = "";

  el("wizTop").style.display = currentStep === 0 ? "none" : "flex";
  if (currentStep > 0){
    const pct = Math.round(((currentStep+1)/STEPS.length)*100);
    el("wizBar").style.width = `${pct}%`;
    el("wizLabel").textContent = `Schritt ${currentStep+1}/${STEPS.length}`;
  }

  const title = document.createElement("div");
  title.className = "stepTitle";
  title.textContent = step.title;
  host.appendChild(title);

  if (step.key === "summary"){
    if (!state.login_email) {
      state.login_email = suggestedEmail();
      saveState();
    }
    renderSummary(host);
  } else {
    const grid = document.createElement("div");
    grid.className = "grid";

    for (const f of step.fields){
      const wrap = document.createElement("div");
      wrap.className = "field" + (f.span2 ? " field--span2" : "");

      const lab = document.createElement("label");
      lab.innerHTML = `${escapeHtml(f.label)}${f.required ? ' <span class="req">*</span>' : ""}`;
      wrap.appendChild(lab);

      let input;
      if (f.type === "select"){
        input = document.createElement("select");
        for (const o of (f.options || [])){
          const opt = document.createElement("option");
          opt.value = o;
          opt.textContent = o || "Bitte auswählen…";
          if (o === "") { opt.disabled = true; opt.selected = true; }
          input.appendChild(opt);
        }
      } else {
        input = document.createElement("input");
        input.type = f.type || "text";
      }

      input.value = state[f.id] || "";
      input.addEventListener("input", ()=>{
        state[f.id] = input.value;

        // automatisch login-email vorschlagen
        if ((f.id === "vorname" || f.id === "nachname")) {
          const suggested = suggestedEmail();
          if (!state.login_email || state.login_email.endsWith("@"+EMAIL_DOMAIN)) {
            state.login_email = suggested;
          }
        }

        saveState();
      });

      wrap.appendChild(input);
      grid.appendChild(wrap);
    }

    host.appendChild(grid);
  }

  el("backBtn").style.display = currentStep === 0 ? "none" : "inline-flex";
  el("nextBtn").style.display = currentStep === STEPS.length-1 ? "none" : "inline-flex";
  el("submitBtn").style.display = currentStep === STEPS.length-1 ? "inline-flex" : "none";

  setMsg("", "");
}

function validateRequired(){
  const need = [
    ["vorname", "Vorname"],
    ["nachname", "Nachname"],
    ["geburtsdatum", "Geburtsdatum"],
    ["identifikationsnummer", "Citizen ID"],
    ["dmail", "D-Mail Adresse"]
  ];
  for (const [k,label] of need){
    if (!String(state[k]||"").trim()){
      setMsg("err", `Bitte ausfüllen: ${label}`);
      return false;
    }
  }
  return true;
}

function validateAccountFields(){
  const email = String(state.login_email || "").trim().toLowerCase();
  if (!email) return (setMsg("err","Bitte Login E-Mail angeben."), false);
  if (!email.includes("@")) return (setMsg("err","Login E-Mail ist ungültig."), false);

  if (!sessionPw1 || sessionPw1.length < 8) return (setMsg("err","Passwort muss mindestens 8 Zeichen haben."), false);
  if (sessionPw1 !== sessionPw2) return (setMsg("err","Passwörter stimmen nicht überein."), false);

  return true;
}

/* ================= SUBMIT ================= */
async function submitAll(){
  if (!sessionTokenOk || !sessionToken) return setMsg("err","Kein gültiger Token (bitte neu prüfen).");
  if (!state.__dsgvo) return setMsg("err","Bitte DSGVO bestätigen.");
  if (!state.__richtigkeit) return setMsg("err","Bitte Richtigkeit bestätigen.");
  if (!validateRequired()) return;
  if (!validateAccountFields()) return;

  el("submitBtn").disabled = true;
  setMsg("", "");

  try{
    const fn = httpsCallable(functions, "registerMemberWithToken");
    const res = await fn({
      orgId: ORG_ID,
      token: sessionToken,
      email: String(state.login_email).trim().toLowerCase(),
      password: sessionPw1,
      memberData: buildMemberData()
    });

    setMsg("ok", `✅ Registrierung fertig!\nMitgliedsnummer: ${res.data.memberNumber}\nWeiterleitung zum Login…`);

    // reset + redirect
    setTimeout(()=>{
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY+"_step");
      state = {};
      currentStep = 0;

      sessionToken = null; sessionTokenOk = false;
      sessionPw1 = ""; sessionPw2 = "";

      window.location.href = REDIRECT_AFTER_SUCCESS;
    }, 900);

  }catch(e){
    console.error(e);
    setMsg("err", `❌ Fehler: ${e?.message || e}`);
  }finally{
    el("submitBtn").disabled = false;
  }
}

/* ================= NAV ================= */
el("nextBtn").addEventListener("click", ()=>{
  const step = STEPS[currentStep];
  if (step.key !== "summary"){
    for (const f of step.fields){
      if (f.required && !String(state[f.id]||"").trim()){
        setMsg("err", `Bitte ausfüllen: ${f.label}`);
        return;
      }
    }
  }
  currentStep = Math.min(currentStep+1, STEPS.length-1);
  renderStep();
});

el("backBtn").addEventListener("click", ()=>{
  currentStep = Math.max(currentStep-1, 0);
  renderStep();
});

el("resetBtn").addEventListener("click", ()=>{
  state = {};
  currentStep = 0;
  saveState(); saveStep();

  sessionToken = null; sessionTokenOk = false;
  sessionPw1 = ""; sessionPw2 = "";

  el("tokenInput").value = "";
  showTokenMsg("", "");
  lockForm();
  setMsg("", "");
});

el("memberForm").addEventListener("submit", (e)=>{
  e.preventDefault();
  submitAll();
});

/* ================= BOOT ================= */
initTheme();
el("tokenBtn").addEventListener("click", handleTokenCheck);
el("tokenInput").addEventListener("keydown", (e)=>{ if (e.key === "Enter") handleTokenCheck(); });

lockForm();
renderStep();
