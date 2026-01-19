// =====================================================
// courses_admin.js  (FULL WORKING VERSION)
// =====================================================

// ✅ FIREBASE IMPORTS
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// ✅ YOUR FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyAEKPiUzXc_tFvmiop4hDEdhv8Rkg2kWjU",
  authDomain: "intranet-ffwn.firebaseapp.com",
  projectId: "intranet-ffwn",
  storageBucket: "intranet-ffwn.appspot.com",
  messagingSenderId: "221055908808",
  appId: "1:221055908808:web:b1c63120bc73aa26a6defd"
};

const ORG_ID = "ffwn";
const TEMPLATE_COLL = "courses_vorlagen";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const el = (id) => document.getElementById(id);

// =====================================================
// DEBUG: show JS / Promise errors in UI (so "geht nix" becomes visible)
// =====================================================
window.addEventListener("error", (e) => {
  try {
    const msg = e?.message || "Unbekannter JS-Fehler";
    showMsg("err", "JS Fehler: " + msg);
  } catch {}
});
window.addEventListener("unhandledrejection", (e) => {
  try {
    const msg = e?.reason?.message || String(e?.reason || "Unbekannter Promise-Fehler");
    showMsg("err", "Promise Fehler: " + msg);
  } catch {}
});

// =====================================================
// CLONE fallback (structuredClone may be missing)
// =====================================================
const clone = (v) => {
  try {
    if (typeof structuredClone === "function") return structuredClone(v);
  } catch {}
  return JSON.parse(JSON.stringify(v ?? null));
};

// =====================================================
// CONFIRM POPOUT (uses your .popout markup)
// IDs required in HTML:
// confirmPopout, confirmBackdrop, confirmOk, confirmCancel, confirmBadge, confirmTitle, confirmText
// =====================================================
function openConfirm({
  badge = "BESTÄTIGEN",
  title = "Bestätigen",
  text = "Sicher?",
  okText = "OK",
  danger = true
} = {}) {
  const pop = el("confirmPopout");
  const backdrop = el("confirmBackdrop");
  const okBtn = el("confirmOk");
  const cancelBtn = el("confirmCancel");

  // Fallback if popout markup missing
  if (!pop || !backdrop || !okBtn || !cancelBtn || !el("confirmTitle") || !el("confirmText") || !el("confirmBadge")) {
    return Promise.resolve(window.confirm(text || "Sicher?"));
  }

  el("confirmBadge").textContent = badge;
  el("confirmTitle").textContent = title;
  el("confirmText").textContent = text;

  okBtn.textContent = okText;
  okBtn.classList.toggle("btn--danger", !!danger);
  okBtn.classList.toggle("btn--primary", !danger);

  pop.setAttribute("aria-hidden", "false");
  okBtn.focus();

  return new Promise((resolve) => {
    const close = (val) => {
      pop.setAttribute("aria-hidden", "true");
      cleanup();
      resolve(val);
    };

    const onOk = () => close(true);
    const onCancel = () => close(false);
    const onBackdrop = () => close(false);
    const onKey = (e) => { if (e.key === "Escape") close(false); };

    function cleanup() {
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      backdrop.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKey);
    }

    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    backdrop.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKey);
  });
}

// =====================================================
// Helpers / UI Messages
// =====================================================
function showMsg(type, text) {
  const ok = el("msgOk");
  const err = el("msgErr");
  if (!ok || !err) return;

  ok.style.display = "none";
  err.style.display = "none";

  if (!text) return;

  const box = type === "ok" ? ok : err;
  box.textContent = text;
  box.style.display = "block";
}

function codeToCourseId(code) {
  return String(code || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_");
}

// =====================================================
// Firestore refs
// =====================================================
const coursesCol = () => collection(db, "orgs", ORG_ID, TEMPLATE_COLL);
const courseRef = (id) => doc(db, "orgs", ORG_ID, TEMPLATE_COLL, id);

// =====================================================
// App state
// =====================================================
let cache = {
  courses: [],
  selectedId: null
};

let materials = [];
let questions = [];

// =====================================================
// LEFT PANEL COLLAPSE (always visible button)
// Requires CSS: .split.is-collapsed { ... } (you already have it)
// =====================================================
const COLLAPSE_KEY = "ffwn_courses_left_collapsed";

function getSplitEl() {
  return document.querySelector(".split");
}
function isCollapsed() {
  return getSplitEl()?.classList.contains("is-collapsed") || false;
}
function updateToggleBtnText() {
  const btn = el("toggleLeftBtn") || el("toggleLeftBtnFloating");
  if (!btn) return;
  const collapsed = isCollapsed();
  btn.textContent = collapsed ? "≡ Kurse anzeigen" : "≡ Kurse ausblenden";
  btn.title = collapsed ? "Kursliste anzeigen" : "Kursliste ausblenden";
}
function applyCollapsedState(collapsed) {
  const split = getSplitEl();
  if (!split) {
    console.warn("❗ .split nicht gefunden – Toggle geht nicht.");
    return;
  }
  split.classList.toggle("is-collapsed", !!collapsed);
  try { localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0"); } catch {}
  updateToggleBtnText();
}
function ensureAlwaysVisibleToggleButton() {
  // If HTML button exists -> use it
  const existing = el("toggleLeftBtn");
  if (existing) {
    existing.addEventListener("click", () => applyCollapsedState(!isCollapsed()));
    updateToggleBtnText();
    return;
  }

  // Otherwise create floating button (always visible)
  const btn = document.createElement("button");
  btn.id = "toggleLeftBtnFloating";
  btn.type = "button";
  btn.className = "btn btn--ghost";
  btn.textContent = "≡ Kurse";
  btn.title = "Kursliste ein-/ausblenden";

  // inline styles so no CSS change needed
  btn.style.position = "fixed";
  btn.style.right = "18px";
  btn.style.bottom = "18px";
  btn.style.zIndex = "99999";
  btn.style.backdropFilter = "blur(10px)";
  btn.style.boxShadow = "0 18px 55px rgba(0,0,0,.35)";

  btn.addEventListener("click", () => applyCollapsedState(!isCollapsed()));
  document.body.appendChild(btn);

  updateToggleBtnText();
}
function setupCollapseFromStorage() {
  let collapsed = false;
  try { collapsed = localStorage.getItem(COLLAPSE_KEY) === "1"; } catch {}
  applyCollapsedState(collapsed);
}

// =====================================================
// DB SAVE: one central function that ALWAYS saves everything (details + materials + questions)
// =====================================================
function getSelectedPrereqs() {
  const box = el("prereqBox");
  if (!box) return [];
  return [...box.querySelectorAll("input:checked")].map(i => i.value);
}

function getMaterialsFromUI() {
  return materials;
}
function getQuestionsFromUI() {
  return questions;
}

function buildPayloadFromUI() {
  return {
    code: (el("code")?.value || "").trim(),
    title: (el("title")?.value || "").trim(),
    category: el("category")?.value || null,
    description: el("description")?.value || null,
    sort: Number(el("sort")?.value) || null,
    active: (el("active")?.value || "true") === "true",
    validityMonths: Number(el("validityMonths")?.value) || null,
    prerequisites: { courses: getSelectedPrereqs() },
    materials: getMaterialsFromUI(),
    questions: getQuestionsFromUI(),
    updatedAt: serverTimestamp()
  };
}

function resolveCourseIdForSave(payload) {
  if (cache.selectedId) return cache.selectedId;
  const existing = (el("courseId")?.value || "").trim();
  if (existing) return existing;
  if (payload.code) return codeToCourseId(payload.code);
  return "";
}

async function persistCourseToFirestore({ showSuccess = true } = {}) {
  const payload = buildPayloadFromUI();

  if (!payload.code) {
    showMsg("err", "Bitte zuerst Code eingeben (z.B. BD10), dann kann gespeichert werden.");
    return false;
  }

  const courseId = resolveCourseIdForSave(payload) || codeToCourseId(payload.code);

  // keep UI consistent
  if (el("courseId")) {
    el("courseId").value = courseId;
    el("courseId").readOnly = true;
  }

  try {
    showMsg("err", "");

    const ref = courseRef(courseId);
    const exists = await getDoc(ref);
    if (!exists.exists()) payload.createdAt = serverTimestamp();

    await setDoc(ref, payload, { merge: true });

    cache.selectedId = courseId;

    if (showSuccess) showMsg("ok", "Gespeichert ✅");

    await loadCourses();
    await selectCourse(courseId);
    return true;
  } catch (err) {
    console.error("FIRESTORE SAVE ERROR:", err);
    showMsg("err", "Firestore Fehler: " + (err?.message || String(err)));
    return false;
  }
}

// =====================================================
// Load / List / Select
// =====================================================
async function loadCourses() {
  try {
    const snap = await getDocs(coursesCol());
    cache.courses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderCourseList();
    renderPrerequisites([]); // base list
  } catch (err) {
    console.error("LOAD COURSES ERROR:", err);
    showMsg("err", "Firestore Fehler: " + (err?.message || String(err)));
  }
}

function renderCourseList() {
  const host = el("courseList");
  if (!host) return;
  host.innerHTML = "";

  cache.courses
    .sort((a, b) => (a.sort ?? 999) - (b.sort ?? 999))
    .forEach(course => {
      const row = document.createElement("div");
      row.className = "row" + (course.id === cache.selectedId ? " row--active" : "");
      row.innerHTML = `
        <div class="row__main">
          <div class="row__title">${course.title || "(ohne Titel)"}</div>
          <div class="row__sub">
            <span class="tag">${course.category || "-"}</span>
            <span class="tag">${course.code || "-"}</span>
            <span class="tag ${(course.validityMonths ? "" : "tag--off")}">
              ${course.validityMonths ? `gültig: ${course.validityMonths}M` : "keine Gültigkeit"}
            </span>
          </div>
        </div>
        <div class="row__meta">
          <span class="tag ${(course.active !== false) ? "tag--ok" : "tag--warn"}">
            ${(course.active !== false) ? "aktiv" : "inaktiv"}
          </span>
        </div>
      `;
      row.onclick = () => selectCourse(course.id);
      host.appendChild(row);
    });
}

function renderPrerequisites(selected = []) {
  const box = el("prereqBox");
  if (!box) return;
  box.innerHTML = "";

  cache.courses
    .filter(c => c.id !== cache.selectedId)
    .forEach(course => {
      const row = document.createElement("label");
      row.className = "prItem";
      row.innerHTML = `
        <input type="checkbox" value="${course.id}" ${selected.includes(course.id) ? "checked" : ""}>
        <div>
          <div class="prItem__name">${course.title || "(ohne Titel)"}</div>
          <div class="prItem__code">${course.code || course.id}</div>
        </div>
      `;
      box.appendChild(row);
    });
}

function setDeactivateBtnLabel(isActive) {
  const btn = el("deactivateBtn");
  if (!btn) return;
  btn.textContent = isActive ? "Deaktivieren" : "Aktivieren";
  btn.title = isActive ? "Setzt active=false" : "Setzt active=true";
}

async function selectCourse(id) {
  try {
    const snap = await getDoc(courseRef(id));
    if (!snap.exists()) return;

    const data = snap.data();
    cache.selectedId = id;

    if (el("courseId")) {
      el("courseId").value = id;
      el("courseId").readOnly = true;
    }

    el("code").value = data.code || "";
    el("title").value = data.title || "";
    el("category").value = data.category || "";
    el("description").value = data.description || "";
    el("sort").value = data.sort ?? "";
    el("active").value = String(data.active !== false);
    el("validityMonths").value = data.validityMonths ?? "";

    setDeactivateBtnLabel(data.active !== false);

    renderPrerequisites(data.prerequisites?.courses || []);
    renderCourseList();

    renderMaterials(data.materials || []);
    renderQuestions(data.questions || []);
    updateTabCounts(data);

    updateToggleBtnText();
  } catch (err) {
    console.error("SELECT ERROR:", err);
    showMsg("err", "Fehler beim Laden: " + (err?.message || String(err)));
  }
}

// =====================================================
// Save / New / Toggle Active / Delete Course
// =====================================================
async function saveCourse(e) {
  e.preventDefault();
  await persistCourseToFirestore({ showSuccess: true });
}

function newCourse() {
  cache.selectedId = null;

  el("courseForm")?.reset();

  if (el("courseId")) {
    el("courseId").value = "";
    el("courseId").readOnly = true;
  }

  setDeactivateBtnLabel(true);

  materials = [];
  questions = [];

  renderPrerequisites([]);
  renderCourseList();
  renderMaterials([]);
  renderQuestions([]);
  updateTabCounts({});

  showMsg("ok", "");
  showMsg("err", "");
}

async function toggleActiveCourse() {
  if (!cache.selectedId) return;

  try {
    const ref = courseRef(cache.selectedId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const curActive = snap.data().active !== false;
    const nextActive = !curActive;

    await updateDoc(ref, { active: nextActive, updatedAt: serverTimestamp() });
    showMsg("ok", nextActive ? "Kurs aktiviert ✅" : "Kurs deaktiviert ✅");

    setDeactivateBtnLabel(nextActive);
    await loadCourses();
    await selectCourse(cache.selectedId);
  } catch (err) {
    console.error("TOGGLE ERROR:", err);
    showMsg("err", "Firestore Fehler: " + (err?.message || String(err)));
  }
}

async function deleteCourse() {
  if (!cache.selectedId) return;

  const course = cache.courses.find(c => c.id === cache.selectedId);
  const name = course?.title || course?.code || cache.selectedId;

  const ok = await openConfirm({
    badge: "LÖSCHEN",
    title: "Kurs löschen",
    text: `Willst du „${name}“ wirklich endgültig löschen?`,
    okText: "Endgültig löschen",
    danger: true
  });
  if (!ok) return;

  try {
    await deleteDoc(courseRef(cache.selectedId));
    showMsg("ok", "Kurs gelöscht ✅");
    newCourse();
    await loadCourses();
  } catch (err) {
    console.error("DELETE COURSE ERROR:", err);
    showMsg("err", "Firestore Fehler: " + (err?.message || String(err)));
  }
}

// =====================================================
// Tabs
// =====================================================
["tabDetails", "tabMaterials", "tabQuestions"].forEach(tabId => {
  const t = el(tabId);
  if (!t) return;
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.remove("tab--active"));
    document.querySelectorAll(".panel").forEach(x => x.classList.remove("panel--active"));
    el(tabId).classList.add("tab--active");
    el(el(tabId).getAttribute("aria-controls")).classList.add("panel--active");
  });
});

// =====================================================
// Materials (Unterlagen) - save/delete triggers Firestore save
// =====================================================
function renderMaterials(list = []) {
  materials = clone(list) || [];
  const host = el("materialsList");
  if (!host) return;
  host.innerHTML = "";

  materials.forEach((mat, i) => {
    const row = document.createElement("div");
    row.className = "miniRow";
    row.innerHTML = `
      <div>
        <div class="miniRow__title">${mat.title}</div>
        <div class="miniRow__sub">${mat.type || "link"} · <a href="${mat.url}" target="_blank" rel="noopener noreferrer">${mat.url}</a></div>
      </div>
      <div class="miniRow__actions">
        <button class="btn btn--sm btn--ghost" type="button" onclick="editMaterial(${i})">Bearbeiten</button>
        <button class="btn btn--sm btn--danger" type="button" onclick="deleteMaterial(${i})">Löschen</button>
      </div>
    `;
    host.appendChild(row);
  });

  if (el("materialsCount")) el("materialsCount").textContent = materials.length;
  el("matResetBtn")?.click();
}

el("matSaveBtn")?.addEventListener("click", async () => {
  try {
    const mat = {
      id: el("matId").value || crypto.randomUUID(),
      title: el("matTitle").value.trim(),
      url: el("matUrl").value.trim(),
      type: el("matType").value,
      note: el("matNote").value
    };

    if (!mat.title || !mat.url) {
      showMsg("err", "Bitte Titel und Link bei der Unterlage ausfüllen.");
      return;
    }

    const idx = materials.findIndex(m => m.id === mat.id);
    if (idx >= 0) materials[idx] = mat;
    else materials.push(mat);

    renderMaterials(materials);

    // ✅ Save whole course with updated materials
    await persistCourseToFirestore({ showSuccess: true });
  } catch (err) {
    console.error("MAT SAVE ERROR:", err);
    showMsg("err", "Fehler Unterlage: " + (err?.message || String(err)));
  }
});

el("matResetBtn")?.addEventListener("click", () => {
  if (el("matId")) el("matId").value = "";
  if (el("matTitle")) el("matTitle").value = "";
  if (el("matUrl")) el("matUrl").value = "";
  if (el("matType")) el("matType").value = "auto";
  if (el("matNote")) el("matNote").value = "";
});

window.editMaterial = (i) => {
  const m = materials[i];
  if (!m) return;
  el("matId").value = m.id;
  el("matTitle").value = m.title;
  el("matUrl").value = m.url;
  el("matType").value = m.type || "auto";
  el("matNote").value = m.note || "";
};

window.deleteMaterial = async (i) => {
  const mat = materials[i];
  if (!mat) return;

  const ok = await openConfirm({
    badge: "LÖSCHEN",
    title: "Unterlage löschen",
    text: `Willst du „${mat.title || "diese Unterlage"}“ wirklich löschen?`,
    okText: "Löschen",
    danger: true
  });
  if (!ok) return;

  materials.splice(i, 1);
  renderMaterials(materials);

  // ✅ Save whole course after delete
  await persistCourseToFirestore({ showSuccess: true });
};

// =====================================================
// Questions (Fragen) - save/delete triggers Firestore save
// =====================================================
function renderQuestions(list = []) {
  questions = clone(list) || [];
  const host = el("questionsList");
  if (!host) return;
  host.innerHTML = "";

  questions.forEach((q, i) => {
    const row = document.createElement("div");
    row.className = "qRow";
    row.onclick = () => editQuestion(i);
    row.innerHTML = `<div class="qRow__title">${q.text || "(Frage fehlt)"}</div>`;
    host.appendChild(row);
  });

  if (el("questionsCount")) el("questionsCount").textContent = questions.length;
}

function resetQuestionEditor() {
  if (el("qId")) el("qId").value = "";
  if (el("qText")) el("qText").value = "";
  if (el("qPoints")) el("qPoints").value = 1;
  if (el("qType")) el("qType").value = "single";
  if (el("qActive")) el("qActive").value = "true";
  if (el("qExplanation")) el("qExplanation").value = "";
  if (el("answersBox")) el("answersBox").innerHTML = "";
}

el("qNewBtn")?.addEventListener("click", resetQuestionEditor);

el("ansAddBtn")?.addEventListener("click", () => {
  const box = el("answersBox");
  if (!box) return;

  const row = document.createElement("div");
  row.className = "ansRow";
  row.innerHTML = `
    <input type="checkbox" class="ansCorrect">
    <input type="text" class="ansText" placeholder="Antworttext">
    <button class="btn btn--sm btn--danger" type="button" onclick="this.parentElement.remove()">–</button>
  `;
  box.appendChild(row);
});

el("qSaveBtn")?.addEventListener("click", async () => {
  try {
    const text = (el("qText")?.value || "").trim();
    if (!text) {
      showMsg("err", "Bitte Fragetext ausfüllen.");
      return;
    }

    const answersBox = el("answersBox");
    const ansRows = answersBox ? [...answersBox.children] : [];

    const q = {
      id: el("qId").value || crypto.randomUUID(),
      text,
      points: Number(el("qPoints").value) || 1,
      type: el("qType").value,
      active: el("qActive").value === "true",
      explanation: el("qExplanation").value || "",
      answers: ansRows.map(row => ({
        text: (row.querySelector(".ansText")?.value || "").trim(),
        correct: !!row.querySelector(".ansCorrect")?.checked
      }))
    };

    const filledAnswers = (q.answers || []).filter(a => a.text.length > 0);
    if (q.type !== "truefalse" && filledAnswers.length < 2) {
      showMsg("err", "Bitte mindestens 2 Antworten anlegen (und Text ausfüllen).");
      return;
    }

    const idx = questions.findIndex(x => x.id === q.id);
    if (idx >= 0) questions[idx] = q;
    else questions.push(q);

    renderQuestions(questions);
    resetQuestionEditor();

    // ✅ Save whole course with updated questions
    await persistCourseToFirestore({ showSuccess: true });
  } catch (err) {
    console.error("Q SAVE ERROR:", err);
    showMsg("err", "Fehler Frage: " + (err?.message || String(err)));
  }
});

el("qDeleteBtn")?.addEventListener("click", async () => {
  const id = el("qId")?.value;
  if (!id) return;

  const ok = await openConfirm({
    badge: "LÖSCHEN",
    title: "Frage löschen",
    text: "Willst du diese Frage wirklich löschen?",
    okText: "Löschen",
    danger: true
  });
  if (!ok) return;

  questions = questions.filter(q => q.id !== id);
  renderQuestions(questions);
  resetQuestionEditor();

  // ✅ Save after delete
  await persistCourseToFirestore({ showSuccess: true });
});

window.editQuestion = (i) => {
  const q = questions[i];
  if (!q) return;

  el("qId").value = q.id;
  el("qText").value = q.text || "";
  el("qPoints").value = q.points ?? 1;
  el("qType").value = q.type || "single";
  el("qActive").value = q.active ? "true" : "false";
  el("qExplanation").value = q.explanation || "";

  const box = el("answersBox");
  if (!box) return;
  box.innerHTML = "";

  (q.answers || []).forEach(ans => {
    const row = document.createElement("div");
    row.className = "ansRow";
    row.innerHTML = `
      <input type="checkbox" class="ansCorrect" ${ans.correct ? "checked" : ""}>
      <input type="text" class="ansText" value="${(ans.text || "").replace(/"/g, "&quot;")}">
      <button class="btn btn--sm btn--danger" type="button" onclick="this.parentElement.remove()">–</button>
    `;
    box.appendChild(row);
  });
};

function updateTabCounts(data = {}) {
  if (el("materialsCount")) el("materialsCount").textContent = data.materials?.length || 0;
  if (el("questionsCount")) el("questionsCount").textContent = data.questions?.length || 0;
}

// =====================================================
// Bind events / Init
// =====================================================
function bindEvents() {
  el("courseForm")?.addEventListener("submit", saveCourse);

  (el("newBtn") || el("newCourseBtn"))?.addEventListener("click", newCourse);
  el("resetEditorBtn")?.addEventListener("click", newCourse);

  el("deactivateBtn")?.addEventListener("click", toggleActiveCourse);
  el("deleteCourseBtn")?.addEventListener("click", deleteCourse);

  // courseId auto from Code (only if new)
  el("code")?.addEventListener("input", () => {
    if (cache.selectedId) return;
    if (el("courseId")) el("courseId").value = codeToCourseId(el("code").value);
  });
}

bindEvents();
ensureAlwaysVisibleToggleButton();
setupCollapseFromStorage();
loadCourses();
setDeactivateBtnLabel(true);
