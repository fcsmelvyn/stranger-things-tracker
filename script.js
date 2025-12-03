// script.js
// Tracker minimal: localStorage + export/import JSON + CRUD

const STORAGE_KEY = "stranger_tracker_reports_v1";

let reports = [];
let editId = null;

const $ = id => document.getElementById(id);

function uid() {
  return 'id-' + Math.random().toString(36).slice(2,9);
}

function load() {
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    reports = raw ? JSON.parse(raw) : [];
  }catch(e){ reports = [] }
  renderList();
  updateStats();
}

function saveLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
  updateStats();
}

function updateStats(){
  $("statCount").textContent = `${reports.length} signalement(s)`;
}

function createCardHTML(r){
  const d = new Date(r.datetime || r.date + " " + (r.time || ""));
  const prettyDate = isNaN(d) ? r.date || "—" : d.toLocaleString();
  return `
    <div class="report card" data-id="${r.id}">
      <div class="btns">
        <button class="small-btn" data-action="edit">✎</button>
        <button class="small-btn" data-action="del">🗑</button>
      </div>
      <h4>${escapeHtml(r.title)}</h4>
      <div class="meta">${escapeHtml(r.location)} • ${prettyDate}</div>
      <p>${escapeHtml(r.notes || '')}</p>
    </div>
  `;
}

function renderList(filterText = "", filterRange = "all"){
  const list = $("list");
  const q = filterText.trim().toLowerCase();
  const now = new Date();
  const filterFn = (r) => {
    if(q){
      const hay = (r.title + " " + r.location + " " + (r.notes||"")).toLowerCase();
      if(!hay.includes(q)) return false;
    }
    if(filterRange === "all") return true;
    const d = new Date(r.date);
    if(isNaN(d)) return true;
    const diffDays = (now - d) / (1000*60*60*24);
    if(filterRange === "today") return diffDays < 1;
    if(filterRange === "week") return diffDays < 7;
    if(filterRange === "month") return diffDays < 31;
    return true;
  };

  const filtered = reports.filter(filterFn);
  if(filtered.length === 0){
    list.innerHTML = `<div class="card"><em>Aucun signalement pour le filtre courant.</em></div>`;
    return;
  }
  list.innerHTML = filtered.map(createCardHTML).join("");
  // attach event listeners
  list.querySelectorAll(".report").forEach(el=>{
    el.querySelectorAll("[data-action]").forEach(btn=>{
      btn.onclick = onCardAction;
    });
  });
}

function onCardAction(e){
  const action = e.currentTarget.dataset.action;
  const id = e.currentTarget.closest(".report").dataset.id;
  if(action === "del"){
    if(confirm("Supprimer ce signalement ?")) {
      reports = reports.filter(r => r.id !== id);
      saveLocal();
      renderList($("search").value, $("filterDate").value);
    }
  } else if(action === "edit"){
    startEdit(id);
  }
}

function startEdit(id){
  const r = reports.find(x => x.id === id);
  if(!r) return;
  editId = id;
  $("inputTitle").value = r.title;
  $("inputLocation").value = r.location;
  $("inputDate").value = r.date || "";
  $("inputTime").value = r.time || "";
  $("inputNotes").value = r.notes || "";
  $("saveBtn").classList.add("hidden");
  $("updateBtn").classList.remove("hidden");
  $("cancelEditBtn").classList.remove("hidden");
}

function cancelEdit(){
  editId = null;
  $("reportForm").reset();
  $("saveBtn").classList.remove("hidden");
  $("updateBtn").classList.add("hidden");
  $("cancelEditBtn").classList.add("hidden");
}

function submitForm(e){
  e.preventDefault();
  const title = $("inputTitle").value.trim();
  const location = $("inputLocation").value.trim();
  const date = $("inputDate").value || "";
  const time = $("inputTime").value || "";
  const notes = $("inputNotes").value.trim();

  if(!title || !location) {
    alert("Titre et lieu sont requis.");
    return;
  }

  if(editId){
    const r = reports.find(x => x.id === editId);
    if(r){
      r.title = title; r.location = location; r.date = date; r.time = time; r.notes = notes;
      r.updatedAt = new Date().toISOString();
    }
    editId = null;
  } else {
    const newR = {
      id: uid(),
      title, location, date, time, notes,
      createdAt: new Date().toISOString()
    };
    reports.unshift(newR);
  }

  saveLocal();
  $("reportForm").reset();
  cancelEdit();
  renderList($("search").value, $("filterDate").value);
}

// export JSON
function exportJSON(){
  const blob = new Blob([JSON.stringify(reports, null, 2)], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "reports.json";
  a.click();
  URL.revokeObjectURL(url);
}

// import JSON
function importFile(file){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try{
      const data = JSON.parse(ev.target.result);
      if(!Array.isArray(data)) throw new Error("Format invalide");
      // simple merge: on ajoute en tête (préserve existants)
      reports = [...data, ...reports];
      saveLocal();
      renderList($("search").value, $("filterDate").value);
      alert("Import terminé. Les données ont été ajoutées.");
    }catch(err){
      alert("Impossible d'importer : " + err.message);
    }
  };
  reader.readAsText(file);
}

// helpers
function escapeHtml(s){
  if(!s) return "";
  return s.replace(/[&<>"']/g, (m)=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[m]));
}

/* ---------- Wiring ---------- */
document.addEventListener("DOMContentLoaded", ()=>{
  load();

  $("reportForm").addEventListener("submit", submitForm);
  $("updateBtn").addEventListener("click", (e)=>{
    // simulate submit while editing
    if(editId) {
      const ev = new Event('submit', {cancelable:true});
      $("reportForm").dispatchEvent(ev);
    }
  });
  $("cancelEditBtn").addEventListener("click", cancelEdit);

  $("exportBtn").addEventListener("click", exportJSON);
  $("importFile").addEventListener("change", (ev)=>{
    const f = ev.target.files[0];
    if(f) importFile(f);
    ev.target.value = ""; // reset
  });

  $("clearBtn").addEventListener("click", ()=>{
    if(confirm("Effacer toutes les données locales ?")) {
      reports = [];
      saveLocal();
      renderList();
    }
  });

  $("search").addEventListener("input", (e)=>{
    renderList(e.target.value, $("filterDate").value);
  });

  $("filterDate").addEventListener("change", (e)=>{
    renderList($("search").value, e.target.value);
  });
});
