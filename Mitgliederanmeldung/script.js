import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

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

/* ================= CONFIG ================= */
const ORG_ID = "ffwn";
const MEMBER_PREFIX = "21401";

/* Fixwerte (NICHT anzeigen, nur speichern) */
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
  { key: "summary", title: "Zusammenfassung", fields: [] }
];

/* ================= STATE ================= */
const STORAGE_KEY = "ffwn_member_wizard_token_v1";
let state = loadState();
let currentStep = loadStep();

/* ================= HELPERS ================= */
const el = (id) => document.getElementById(id);

function todayAT(){
  const d = new Date();
  return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()}`;
}
function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
function sanitizeDocId(s){
  return String(s).trim().replace(/\s+/g,"_").replace(/[\/\\?#.%[\]]/g,"_");
}

function loadState(){
  try{ return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }catch{ return {}; }
}
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
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
function normToken(s){
  return String(s || "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

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

async function handleTokenCheck(){
  const raw = el("tokenInput").value;
  const token = normToken(raw);
  el("tokenInput").value = token;

  if (!token) return showTokenMsg("err", "Bitte Token eingeben.");

  el("tokenBtn").disabled = true;
  showTokenMsg("", "Prüfe…");

  try{
    const res = await checkToken(token);
    if (!res.ok){
      showTokenMsg("err", res.reason);
      return;
    }

    state.__token = token;
    state.__token_ok = true;
    saveState();

    showTokenMsg("ok", "✅ Token gültig. Formular freigeschaltet.");
    unlockForm();

  }catch(e){
    console.error(e);
    showTokenMsg("err", "Fehler beim Prüfen.");
  }finally{
    el("tokenBtn").disabled = false;
  }
}

function unlockForm(){
  el("tokenGate").style.display = "none";
  el("memberForm").style.display = "block";
  renderStep();
}

/* ================= SUMMARY ================= */
function renderSummary(host){
  const g = (k) => (state[k] ?? "").toString().trim();

  const wrap = document.createElement("div");
  wrap.className = "summaryV2";

  wrap.innerHTML = `
    <div class="summaryHero">
      <div class="summaryHero__left">
        <div class="summaryHero__name">${escapeHtml(`${g("vorname")||"—"} ${g("nachname")||""}`.trim())}</div>
        <div class="summaryHero__unit">${escapeHtml(DEFAULTS.dienstzuteilung)}</div>
      </div>
    </div>

    <div class="summaryCards">
      ${makeCard("Person", [
        ["Geburtsdatum", g("geburtsdatum")],
        ["Beruf", g("beruf")],
        ["Geburtsort", g("geburtsort")],
        ["Familienstand", g("familienstand")],
        ["Staatsbürgerschaft", g("staatsburgerschaft")]
      ])}

      ${makeCard("Kontakt", [
        ["Citizen ID", g("identifikationsnummer")],
        ["Telefon", g("telefonnummer")],
        ["D-Mail", g("dmail")],
        ["Forumsname", g("forumsname")],
        ["Discord", g("discord_id")]
      ])}

      ${makeCard("Adresse", [
        ["Adresse", g("adresse")],
        ["PLZ", g("postleitzahl")],
        ["Stadt", g("stadt")],
        ["Personalbild (URL)", g("personalbild_url")]
      ])}
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

      <div class="summaryHint">Mit „Absenden“ wird gespeichert und danach die Mitgliedsnummer angezeigt.</div>
    </div>
  `;

  host.appendChild(wrap);

  el("dsgvo").onchange = (e)=>{ state.__dsgvo = e.target.checked; saveState(); };
  el("richtigkeit").onchange = (e)=>{ state.__richtigkeit = e.target.checked; saveState(); };

  function makeCard(title, rows){
    const filled = rows.filter(([,v]) => (v ?? "").toString().trim()).length;
    return `
      <div class="sCard">
        <div class="sCard__title">
          <div>${escapeHtml(title)}</div>
          <div class="sCard__count">${filled}/${rows.length}</div>
        </div>
        ${rows.map(([k,v]) => `
          <div class="kvRow">
            <div class="kvK">${escapeHtml(k)}</div>
            <div class="kvV ${v ? "" : "kvV--empty"}">${escapeHtml((v||"").trim() || "—")}</div>
          </div>
        `).join("")}
      </div>
    `;
  }
}

/* ================= FORM RENDER ================= */
function renderStep(){
  saveState();
  saveStep();

  const step = STEPS[currentStep];
  const host = el("stepHost");
  host.innerHTML = "";

  // Progressbar erst ab Schritt 2
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

/* ================= SUBMIT (TOKEN VERBRAUCHEN) ================= */
async function submitAll(){
  if (!state.__token_ok || !state.__token){
    setMsg("err", "Kein gültiger Token.");
    return;
  }
  if (!state.__dsgvo) return setMsg("err", "Bitte DSGVO bestätigen.");
  if (!state.__richtigkeit) return setMsg("err", "Bitte Richtigkeit bestätigen.");
  if (!validateRequired()) return;

  const token = state.__token;

  el("submitBtn").disabled = true;
  setMsg("", "");

  try{
    const res = await runTransaction(db, async (tx) => {
      // 1) Token prüfen & als benutzt markieren
      const tokenRef = doc(db, "orgs", ORG_ID, "tokens", token);
      const tokenSnap = await tx.get(tokenRef);
      if (!tokenSnap.exists()) throw new Error("Token nicht gefunden.");
      const tokenData = tokenSnap.data();
      if (tokenData.active === false) throw new Error("Token deaktiviert.");
      if (tokenData.used === true) throw new Error("Token bereits verwendet.");

      // 2) Member-Nummer hochzählen
      const counterRef = doc(db, "orgs", ORG_ID, "counters", "members");
      const cSnap = await tx.get(counterRef);
      const next = cSnap.exists() ? Number(cSnap.data().next || 1) : 1;
      tx.set(counterRef, { next: next + 1 }, { merge:true });

      const memberNumber = `${MEMBER_PREFIX}-${String(next).padStart(3,"0")}`;

      // 3) Member Doc anlegen
      const vorname = String(state.vorname||"").trim();
      const nachname = String(state.nachname||"").trim();
      const docId = sanitizeDocId(`${memberNumber}_${vorname}_${nachname}`);
      const memberRef = doc(db, "orgs", ORG_ID, "members", docId);
      const einsendeDatum = todayAT();

      tx.set(memberRef, {
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
        discord_id: state.discord_id ?? null,
        dmail: state.dmail ?? null,
        adresse: state.adresse ?? null,
        postleitzahl: state.postleitzahl ?? null,
        stadt: state.stadt ?? null,
        personalbild_url: state.personalbild_url ?? null,

        // Fixwerte (nur speichern)
        mitglied_seit: einsendeDatum,
        aktuelle_dienstzuteilung: DEFAULTS.dienstzuteilung,
        aktueller_dienstgrad: DEFAULTS.aktueller_dienstgrad,
        letzte_beforderung: einsendeDatum,
        funktion: DEFAULTS.funktion,
        ausbildner: DEFAULTS.ausbildner,
        ausbildner_fur: DEFAULTS.ausbildner_fur,
        dienstzuteilung: DEFAULTS.dienstzuteilung,
        aktives_mitglied: DEFAULTS.aktives_mitglied,

        token: token,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 4) Token als benutzt markieren (mit Referenz)
      tx.set(tokenRef, {
        used: true,
        usedAt: serverTimestamp(),
        usedBy: docId
      }, { merge:true });

      return { memberNumber, docId, einsendeDatum };
    });

    // Subcollection courses/_meta
    await setDoc(doc(db, "orgs", ORG_ID, "members", res.docId, "courses", "_meta"), {
      createdAt: serverTimestamp(),
      note: "Auto-created courses container"
    });

    // ✅ NEW: Beförderungshistorie anlegen
    await setDoc(doc(db, "orgs", ORG_ID, "members", res.docId, "befoerderungen", "_meta"), {
      createdAt: serverTimestamp(),
      note: "Auto-created promotion history container"
    });

    await setDoc(doc(db, "orgs", ORG_ID, "members", res.docId, "befoerderungen", "init"), {
      type: "init",
      from: null,
      to: DEFAULTS.aktueller_dienstgrad,
      date: res.einsendeDatum,
      createdAt: serverTimestamp()
    });

    setMsg("ok", `✅ Gespeichert!\nMitgliedsnummer: ${res.memberNumber}\nDokument: ${res.docId}`);

    // Reset (komplett)
    setTimeout(()=>{
      state = {};
      currentStep = 0;
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY+"_step");
      el("memberForm").style.display = "none";
      el("tokenGate").style.display = "block";
      el("tokenInput").value = "";
      showTokenMsg("", "");
    }, 1200);

  }catch(e){
    console.error(e);
    setMsg("err", "❌ Fehler: " + (e?.message || e));
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
  // ✅ FIX: nur formular reset, token bleibt
  const keepToken = { __token: state.__token, __token_ok: state.__token_ok };
  state = { ...keepToken };
  currentStep = 0;
  saveState(); saveStep();
  renderStep();
});

el("memberForm").addEventListener("submit", (e)=>{
  e.preventDefault();
  submitAll();
});

/* ================= BOOT ================= */
initTheme();

// Token gate wiring
el("tokenBtn").addEventListener("click", handleTokenCheck);
el("tokenInput").addEventListener("keydown", (e)=>{
  if (e.key === "Enter") handleTokenCheck();
});

// Auto unlock if already validated in localStorage
if (state.__token_ok && state.__token){
  unlockForm();
} else {
  el("memberForm").style.display = "none";
  el("tokenGate").style.display = "block";
}
