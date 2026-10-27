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
    btn.addEventListener("click", () => renderYears(data.courses[Number(btn.dataset.course)]));
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

  grid.querySelectorAll("[data-item]").forEach(btn => btn.addEventListener("click", () => onClick(items[Number(btn.dataset.item)])));
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
  if (back) {
    back.textContent = "← Chapters";
    back.onclick = () => renderChapters(course, year, subject);
  }

  grid.innerHTML = lectures.length ? lectures.map((l, i) => `
    <article class="course-card lecture-card">
      ${l.thumbnail ? `<img class="lecture-thumbnail" src="${esc(l.thumbnail)}" alt="">` : ""}
      <span class="course-card__title">${esc(l.title || l.name || "Lecture")}</span>
      ${l.notes ? `<p class="course-card__description">${esc(l.notes)}</p>` : ""}
      <div class="lecture-actions">
        ${(l.videoUrl || l.video) ? `<button class="course-card__arrow watch-inline-btn" type="button" data-watch="${i}">▶ Watch lecture</button>` : ""}
        ${(l.pdfUrl || l.pdf) ? `<a class="course-card__arrow" href="${esc(l.pdfUrl || l.pdf)}" target="_blank" rel="noopener noreferrer">Open PDF ↗</a>` : ""}
      </div>
    </article>`).join("") : `<p class="empty-state">No published lectures are available yet.</p>`;

  grid.querySelectorAll("[data-watch]").forEach(btn => {
    btn.addEventListener("click", () => renderInlinePlayer(lectures[Number(btn.dataset.watch)], course, year, subject, chapter));
  });
}

function renderInlinePlayer(lecture, course, year, subject, chapter) {
  const grid = byId("course-grid");
  const heading = byId("page-title");
  const count = byId("course-count");
  const back = byId("back-btn");
  if (!grid) return;

  const url = lecture.videoUrl || lecture.video || "";
  const safeUrl = esc(url);
  if (heading) heading.textContent = lecture.title || lecture.name || "Lecture";
  if (count) count.textContent = "Now playing";
  if (back) {
    back.textContent = "← Lectures";
    back.onclick = () => renderLectures(course, year, subject, chapter);
  }

  // Stream pages (such as /video/2?chat=...) are embedded in an iframe.
  // Native video files are played with the browser's built-in video element.
  const isVideoFile = /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);
  grid.innerHTML = `
    <section class="inline-player-card">
      <div class="inline-player-top">
        <div><span class="eyebrow">NOW PLAYING</span><h2>${esc(lecture.title || lecture.name || "Lecture")}</h2></div>
        <span class="player-live">Lecture</span>
      </div>
      <div class="inline-player-frame">
        ${isVideoFile
          ? `<video controls autoplay playsinline preload="metadata" src="${safeUrl}">Your browser does not support video playback.</video>`
          : `<iframe src="${safeUrl}" title="${esc(lecture.title || "Lecture video")}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`}
      </div>
      <div class="inline-player-footer">
        <span>${esc(chapter.name || chapter.title || "Chapter")}</span>
        <button type="button" class="btn btn-light" id="return-to-lectures">Back to lectures</button>
      </div>
      ${lecture.pdfUrl || lecture.pdf ? `<a class="course-card__arrow player-pdf-link" href="${esc(lecture.pdfUrl || lecture.pdf)}" target="_blank" rel="noopener noreferrer">Open lecture PDF ↗</a>` : ""}
    </section>`;
  const returnBtn = byId("return-to-lectures");
  if (returnBtn) returnBtn.addEventListener("click", () => renderLectures(course, year, subject, chapter));
}
document.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  renderCourses();
});
