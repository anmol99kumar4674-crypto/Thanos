const API_BASE = "https://thanos-api.molkitofficial.workers.dev".replace(/\/$/, "");
const dataSeed = {
  courses: [
    { id: "mbbs", name: "MBBS", description: "Bachelor of Medicine and Bachelor of Surgery", years: [] },
    { id: "bds", name: "BDS", description: "Bachelor of Dental Surgery", years: [] },
    { id: "other", name: "OTHER", description: "Other learning programmes", years: [] }
  ]
};

let data = structuredClone(dataSeed);

async function loadData() {
  try {
    const response = await fetch(`${API_BASE}/api/data`, { cache: "no-store" });
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    const incoming = await response.json();
    if (incoming && Array.isArray(incoming.courses)) data = incoming;
  } catch (error) {
    console.error("Thanos API load failed:", error);
    data = structuredClone(dataSeed);
  }
}

function byId(id) { return document.getElementById(id); }
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

function renderCourses() {
  const grid = byId("course-grid");
  if (!grid) return;
  const heading = byId("page-title");
  const count = byId("course-count");
  const area = byId("learning-area");
  const back = byId("back-btn");

  if (heading) heading.textContent = "Choose your course";
  if (count) count.textContent = `${data.courses.length} courses`;
  if (area) area.classList.add("hidden");

  grid.innerHTML = data.courses.map((course, i) => `
    <button class="course-card" type="button" data-course="${i}">
      <span class="course-card__icon">${course.name === "MBBS" ? "✚" : course.name === "BDS" ? "✦" : "▣"}</span>
      <span class="course-card__title">${esc(course.name)}</span>
      <span class="course-card__description">${esc(course.description || "")}</span>
      <span class="course-card__arrow">Explore →</span>
    </button>`).join("");

  grid.querySelectorAll("[data-course]").forEach(btn => {
    btn.addEventListener("click", () => { pushLibraryHistory(); renderYears(data.courses[Number(btn.dataset.course)]); });
  });
  if (back) back.onclick = renderCourses;
}

function showGrid(title, items, countText, onClick, backAction) {
  const grid = byId("course-grid");
  if (!grid) return;
  const heading = byId("page-title");
  const count = byId("course-count");
  const area = byId("learning-area");
  const back = byId("back-btn");
  if (heading) heading.textContent = title;
  if (count) count.textContent = countText;
  if (area) area.classList.remove("hidden");

  grid.innerHTML = items.length ? items.map((item, i) => `
    <button class="course-card" type="button" data-item="${i}">
      <span class="course-card__icon">${esc(item.icon || "▤")}</span>
      <span class="course-card__title">${esc(item.title || item.name || `Item ${i + 1}`)}</span>
      <span class="course-card__description">${esc(item.description || "")}</span>
      <span class="course-card__arrow">Open →</span>
    </button>`).join("") : `<p class="empty-state">${esc(items.emptyMessage || "Nothing has been added here yet.")}</p>`;

  grid.querySelectorAll("[data-item]").forEach(btn => btn.addEventListener("click", () => { pushLibraryHistory(); onClick(items[Number(btn.dataset.item)]); }));
  if (back) back.onclick = backAction || renderCourses;
}

function renderYears(course) {
  const years = (course.years || []).map(y => ({ ...y, title: y.name || y.title || "Year", description: `${(y.subjects || []).length} subjects`, icon: "▤" }));
  showGrid(course.name, years, `${years.length} years`, year => renderSubjects(course, year), renderCourses);
}
function renderSubjects(course, year) {
  const subjects = (year.subjects || []).map(s => ({ ...s, title: s.name || s.title || "Subject", description: `${(s.chapters || []).length} chapters`, icon: "▧" }));
  showGrid(`${course.name} / ${year.name || year.title || "Year"}`, subjects, `${subjects.length} subjects`, subject => renderChapters(course, year, subject), () => renderYears(course));
}
function renderChapters(course, year, subject) {
  const chapters = (subject.chapters || []).map(c => ({ ...c, title: c.name || c.title || "Chapter", description: `${(c.lectures || []).length} lectures`, icon: "▤" }));
  showGrid(`${subject.name || subject.title || "Subject"} / Chapters`, chapters, `${chapters.length} chapters`, chapter => renderLectures(course, year, subject, chapter), () => renderSubjects(course, year));
}
function renderLectures(course, year, subject, chapter) {
  const grid = byId("course-grid");
  if (!grid) return;
  const heading = byId("page-title");
  const count = byId("course-count");
  const area = byId("learning-area");
  const back = byId("back-btn");
  const lectures = (chapter.lectures || []).filter(l => l.status !== "draft" && (!l.publishDate || new Date(l.publishDate) <= new Date()));
  if (heading) heading.textContent = `${chapter.name || chapter.title || "Chapter"} / Lectures`;
  if (count) count.textContent = `${lectures.length} lectures`;
  if (area) area.classList.remove("hidden");
  grid.innerHTML = lectures.length ? lectures.map(l => `
    <article class="course-card lecture-card">
      ${l.thumbnail ? `<img class="lecture-thumbnail" src="${esc(l.thumbnail)}" alt="">` : ""}
      <span class="course-card__title">${esc(l.title || l.name || "Lecture")}</span>
      ${l.notes ? `<p class="course-card__description">${esc(l.notes)}</p>` : ""}
      <div class="lecture-actions">
        ${(l.videoUrl || l.video) ? `<a class="course-card__arrow" href="${esc(l.videoUrl || l.video)}" target="_blank" rel="noopener noreferrer">Watch lecture →</a>` : ""}
        ${(l.pdfUrl || l.pdf) ? `<a class="course-card__arrow" href="${esc(l.pdfUrl || l.pdf)}" target="_blank" rel="noopener noreferrer">Open PDF →</a>` : ""}
      </div>
    </article>`).join("") : `<p class="empty-state">No published lectures are available yet.</p>`;
  if (back) back.onclick = () => renderChapters(course, year, subject);
}

// Keep course/year/subject/chapter navigation inside the site history.
function pushLibraryHistory() {
  try {
    history.pushState({ thanosLibraryLevel: true }, "", location.href);
  } catch (error) {
    console.warn("Browser history is unavailable", error);
  }
}
window.addEventListener("popstate", event => {
  // Browser Back goes one level up in the learning hierarchy, not straight out of the site.
  const back = byId("back-btn");
  if (back && !byId("learning-area")?.classList.contains("hidden")) {
    back.click();
  } else {
    renderCourses();
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  renderCourses();
});
