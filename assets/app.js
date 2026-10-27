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


// Safe internal navigation history helper. It must exist before course cards are clicked.
function pushLibraryHistory() {
  try {
    history.pushState({ thanosLibrary: true }, "", location.href);
  } catch (error) {
    console.warn("Could not update browser history:", error);
  }
}

function renderCourses() {
  const grid = byId("course-grid");
  if (!grid) return;
  const heading = byId("page-title");
  const count = byId("course-count");
  const back = byId("back-btn");

  if (heading) heading.textContent = "Choose your course";
  if (count) count.textContent = `${data.courses.length} courses`;

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
  if (back) {
    back.textContent = "← Back";
    back.classList.add("hidden");
    back.onclick = renderCourses;
  }
}

function showGrid(title, items, countText, onClick, backAction) {
  const grid = byId("course-grid");
  if (!grid) return;
  const heading = byId("page-title");
  const count = byId("course-count");
  const back = byId("back-btn");
  if (back) back.classList.remove("hidden");
  if (heading) heading.textContent = title;
  if (count) count.textContent = countText;

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
  const subjects = (year.subjects || []).map(s => ({ ...s, title: s.name || s.title || "Subject", description: `${(s.teachers || []).length} teachers`, icon: "▧" }));
  showGrid(`${course.name} / ${year.name || year.title || "Year"}`, subjects, `${subjects.length} subjects`, subject => renderTeachers(course, year, subject), () => renderYears(course));
}
function renderTeachers(course, year, subject) {
  const teachers = (subject.teachers || []).map(t => ({ ...t, title: t.name || "Teacher", description: `${(t.chapters || []).length} chapters`, icon: "♙" }));
  showGrid(`${subject.name || subject.title || "Subject"} / Teachers`, teachers, `${teachers.length} teachers`, teacher => renderChapters(course, year, subject, teacher), () => renderSubjects(course, year));
}
function renderChapters(course, year, subject, teacher) {
  const chapters = (teacher.chapters || []).map(ch => ({ ...ch, title: ch.name || ch.title || "Chapter", description: `${(ch.lectures || []).length} lectures`, icon: "▤" }));
  showGrid(`${teacher.name || "Teacher"} / Chapters`, chapters, `${chapters.length} chapters`, chapter => renderLectures(course, year, subject, teacher, chapter), () => renderTeachers(course, year, subject));
}

function renderLectures(course, year, subject, teacher, chapter) {
  const grid = byId("course-grid");
  if (!grid) return;
  const heading = byId("page-title");
  const count = byId("course-count");
  const back = byId("back-btn");
  const lectureSource = chapter.lectures || [];
  const lectures = lectureSource.filter(l => l.status !== "draft" && (!l.publishDate || new Date(l.publishDate) <= new Date()));
  if (heading) heading.textContent = `${chapter.name || chapter.title || "Chapter"} / Lectures`;
  if (count) count.textContent = `${lectures.length} lectures`;
  if (back) {
    back.classList.remove("hidden");
    back.textContent = "← Chapters";
    back.onclick = () => renderChapters(course, year, subject, teacher);
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
    btn.addEventListener("click", () => renderInlinePlayer(lectures[Number(btn.dataset.watch)], course, year, subject, teacher, chapter));
  });
}

function renderInlinePlayer(lecture, course, year, subject, teacher, chapter) {
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
    back.classList.remove("hidden");
    back.textContent = "← Lectures";
    back.onclick = () => renderLectures(course, year, subject, teacher, chapter);
  }

  const isVideoFile = /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);
  grid.innerHTML = `
    <section class="inline-player-card">
      <div class="inline-player-top">
        <div><span class="eyebrow">NOW PLAYING</span><h2>${esc(lecture.title || lecture.name || "Lecture")}</h2></div>
        <span class="player-live">Lecture</span>
      </div>
      <div class="inline-player-frame">
        <div class="player-loading" id="player-loading" role="status" aria-live="polite">
          <span class="player-spinner" aria-hidden="true"></span>
          <strong>Video loading…</strong>
          <small>Please wait while the lecture player connects.</small>
        </div>
        ${isVideoFile
          ? `<video controls playsinline preload="metadata" src="${safeUrl}">Your browser does not support video playback.</video>`
          : `<iframe class="player-embed" src="${safeUrl}" title="${esc(lecture.title || "Lecture video")}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`}
      </div>
      <div class="inline-player-footer">
        <span>${esc(chapter.name || chapter.title || "Chapter")}</span>
        <button type="button" class="btn btn-light" id="return-to-lectures">Back to lectures</button>
      </div>
      ${lecture.pdfUrl || lecture.pdf ? `<a class="course-card__arrow player-pdf-link" href="${esc(lecture.pdfUrl || lecture.pdf)}" target="_blank" rel="noopener noreferrer">Open lecture PDF ↗</a>` : ""}
    </section>`;
  const returnBtn = byId("return-to-lectures");
  if (returnBtn) returnBtn.addEventListener("click", () => renderLectures(course, year, subject, teacher, chapter));

  const loading = byId("player-loading");
  const frame = grid.querySelector(".player-embed");
  const video = grid.querySelector("video");
  const hideLoading = () => { if (loading) loading.classList.add("is-hidden"); };
  if (frame) {
    frame.addEventListener("load", () => window.setTimeout(hideLoading, 1200), { once: true });
    // Do not leave our loading overlay forever if a cross-origin player is slow.
    window.setTimeout(hideLoading, 10000);
  } else if (video) {
    video.addEventListener("loadedmetadata", hideLoading, { once: true });
    video.addEventListener("canplay", hideLoading, { once: true });
    video.addEventListener("error", () => {
      if (loading) {
        loading.classList.add("has-error");
        const title = loading.querySelector("strong");
        const detail = loading.querySelector("small");
        if (title) title.textContent = "Video could not be loaded";
        if (detail) detail.textContent = "Please check the video URL or try again.";
      }
    }, { once: true });
  }
}

window.addEventListener("popstate", () => {
  const back = byId("back-btn");
  if (back && !back.classList.contains("hidden") && typeof back.onclick === "function") {
    back.onclick();
  } else {
    renderCourses();
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  renderCourses();
});
