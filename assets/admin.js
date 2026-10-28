/* Thanos Admin Panel - connected to the Cloudflare D1 API */
const API_BASE = "https://thanos-api.molkitofficial.workers.dev".replace(/\/$/, "");
const $ = id => document.getElementById(id);
let data = { courses: [] };
let key = sessionStorage.getItem("thanos_admin_key") || "";
let editLecture = null;

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[c]);


function normalizeTeacherHierarchy(payload) {
  (payload.courses || []).forEach(c => (c.years || []).forEach(y => (y.subjects || []).forEach(s => {
    s.teachers ||= [];
    if ((s.chapters || []).length) {
      s.teachers.unshift({ id: "legacy-" + (s.id || Math.random().toString(36).slice(2)), name: "General Faculty", description: "Existing chapters", chapters: s.chapters });
      s.chapters = [];
    }
  })));
  return payload;
}

function toast(message) {
  const t = $("toast");
  if (!t) return;
  t.textContent = message;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2500);
}

async function request(url, opts = {}, adminKey = key) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (adminKey) headers["X-Admin-Key"] = adminKey;
  const response = await fetch(API_BASE + url, { ...opts, headers, cache: "no-store" });
  let body = {};
  try { body = await response.json(); } catch {}
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

async function load() {
  try {
    data = normalizeTeacherHierarchy(await request("/api/data"));
    if (!data || !Array.isArray(data.courses)) data = { courses: [] };
    renderAll();
  } catch (error) {
    data = { courses: [] };
    renderAll();
    if (/Unauthorized/i.test(error.message)) {
      showLogin();
      $("login-msg").textContent = "Admin key गलत है। दोबारा कोशिश करें।";
    } else {
      showLogin();
      $("login-msg").textContent = `API कनेक्शन नहीं हुआ: ${error.message}`;
    }
  }
}

async function save() {
  try {
    await request("/api/data", { method: "PUT", body: JSON.stringify(data) });
    toast("Changes saved");
    renderAll();
    return true;
  } catch (error) {
    toast(error.message);
    return false;
  }
}

function showLogin() {
  $("login-panel").classList.remove("hidden");
  $("dashboard").classList.add("hidden");
}
function showDashboard() {
  $("login-panel").classList.add("hidden");
  $("dashboard").classList.remove("hidden");
}

$("login-form").onsubmit = async event => {
  event.preventDefault();
  const candidate = $("admin-key").value.trim();
  $("login-msg").textContent = "Connecting…";
  try {
    // Validate the key by writing back the exact current data; an invalid key is rejected by the Worker.
    const current = normalizeTeacherHierarchy(await request("/api/data", {}, ""));
    if (!current || !Array.isArray(current.courses)) throw new Error("Invalid API data");
    await request("/api/data", { method: "PUT", body: JSON.stringify(current) }, candidate);
    key = candidate;
    data = current;
    sessionStorage.setItem("thanos_admin_key", key);
    showDashboard();
    renderAll();
    $("login-msg").textContent = "";
  } catch (error) {
    key = "";
    $("login-msg").textContent = /Unauthorized/i.test(error.message)
      ? "Admin Key गलत है। Cloudflare में सेव की गई ADMIN_KEY डालें।"
      : `कनेक्शन नहीं हुआ: ${error.message}`;
  }
};

$("logout-btn").onclick = () => {
  key = "";
  sessionStorage.removeItem("thanos_admin_key");
  showLogin();
};

function options(id, items, placeholder, selected) {
  const select = $(id);
  if (!select) return;
  const old = selected ?? select.value;
  select.innerHTML = `<option value="">${placeholder}</option>` +
    items.map(item => `<option value="${esc(item.id)}">${esc(item.name || item.title || "")}</option>`).join("");
  if (items.some(item => item.id === old)) select.value = old;
}
function course(id) { return data.courses.find(c => c.id === id); }
function year(courseId, id) { return course(courseId)?.years?.find(y => y.id === id); }
function subject(courseId, yearId, id) { return year(courseId, yearId)?.subjects?.find(s => s.id === id); }
function chapter(courseId, yearId, subjectId, id) {
  return subject(courseId, yearId, subjectId)?.chapters?.find(c => c.id === id);
}

function allCounts() {
  let subjects = 0, chapters = 0, lectures = 0;
  data.courses.forEach(c => (c.years || []).forEach(y => (y.subjects || []).forEach(s => {
    subjects++;
    (s.teachers || []).forEach(t => (t.chapters || []).forEach(ch => { chapters++; lectures += (ch.lectures || []).length; }));
    (s.chapters || []).forEach(ch => { chapters++; lectures += (ch.lectures || []).length; });
  })));
  return { subjects, chapters, lectures };
}


function formatVisitTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-IN", {dateStyle:"medium", timeStyle:"short"});
}
function formatDuration(value) {
  const seconds = Math.max(0, Number(value) || 0);
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
  return h ? `${h}h ${m}m` : m ? `${m}m ${s}s` : `${s}s`;
}
async function loadVisits() {
  const rows = $("visit-rows");
  const summary = $("visit-summary");
  if (!rows || !summary) return;
  rows.innerHTML = '<tr><td colspan="7">Loading student visits…</td></tr>';
  try {
    const result = await request("/api/visits");
    const visits = result.visits || [];
    const active = visits.filter(v => v.status === "active").length;
    summary.textContent = `${visits.length} total sessions · ${active} currently active`;
    rows.innerHTML = visits.length ? visits.map(v => `
      <tr>
        <td><strong>${esc(v.student_name)}</strong><small class="visit-id">${esc(v.session_id)}</small></td>
        <td>${esc(v.course)}</td>
        <td>${esc(formatVisitTime(v.started_at))}</td>
        <td>${esc(formatVisitTime(v.last_seen_at))}</td>
        <td>${esc(formatVisitTime(v.ended_at))}</td>
        <td><strong>${esc(formatDuration(v.duration_seconds))}</strong></td>
        <td><span class="badge ${v.status === "active" ? "published" : "ended"}">${esc(v.status)}</span></td>
      </tr>`).join("") : '<tr><td colspan="7">Abhi koi student visit record nahi hai.</td></tr>';
  } catch (error) {
    summary.textContent = "Student tracking data load nahi hua.";
    rows.innerHTML = `<tr><td colspan="7">${esc(error.message)} — Worker deploy karein aur D1 mein student_visits table banayein.</td></tr>`;
  }
}

function renderAll() {
  const counts = allCounts();
  $("stat-courses").textContent = data.courses.length;
  $("stat-subjects").textContent = counts.subjects;
  $("stat-chapters").textContent = counts.chapters;
  $("stat-lectures").textContent = counts.lectures;
  ["year-course", "subject-course", "teacher-course", "chapter-course", "lecture-course"].forEach(id =>
    options(id, data.courses, "Select course"));
  refreshDependent();
  renderManageLists();
  renderLectures();
  loadVisits();
}

function refreshDependent() {
  const cid = $("subject-course").value;
  options("subject-year", course(cid)?.years || [], "Select year");
  const tc = $("teacher-course").value;
  options("teacher-year", course(tc)?.years || [], "Select year");
  options("teacher-subject", year(tc, $("teacher-year").value)?.subjects || [], "Select subject");
  const cc = $("chapter-course").value;
  options("chapter-year", course(cc)?.years || [], "Select year");
  options("chapter-subject", year(cc, $("chapter-year").value)?.subjects || [], "Select subject");
  options("chapter-teacher", subject(cc, $("chapter-year").value, $("chapter-subject").value)?.teachers || [], "Select teacher");
  const lc = $("lecture-course").value;
  options("lecture-year", course(lc)?.years || [], "Select year");
  options("lecture-subject", year(lc, $("lecture-year").value)?.subjects || [], "Select subject");
  options("lecture-teacher", subject(lc, $("lecture-year").value, $("lecture-subject").value)?.teachers || [], "Select teacher");
  options("lecture-chapter", subject(lc, $("lecture-year").value, $("lecture-subject").value)?.teachers?.find(t => t.id === $("lecture-teacher").value)?.chapters || [], "Select chapter");
}
["subject-course", "teacher-course", "chapter-course", "lecture-course"].forEach(id => $(id).onchange = refreshDependent);
["teacher-year", "chapter-year", "lecture-year"].forEach(id => $(id).onchange = refreshDependent);
$("teacher-subject").onchange = refreshDependent;
$("chapter-subject").onchange = refreshDependent;
$("lecture-subject").onchange = refreshDependent;
$("lecture-teacher").onchange = refreshDependent;

$("course-form").onsubmit = async event => {
  event.preventDefault();
  const name = $("course-name").value.trim();
  if (!name) return toast("Enter a course name");
  if (data.courses.some(c => c.name.toLowerCase() === name.toLowerCase())) return toast("Course already exists");
  data.courses.push({ id: uid(), name, description: $("course-desc").value.trim(), years: [] });
  if (await save()) event.target.reset();
};

$("year-form").onsubmit = async event => {
  event.preventDefault();
  const selectedCourse = course($("year-course").value);
  if (!selectedCourse) return toast("Select a course");
  const name = $("year-name").value.trim();
  if (!name) return toast("Enter a year name");
  selectedCourse.years ||= [];
  if (selectedCourse.years.some(y => y.name.toLowerCase() === name.toLowerCase())) return toast("Year already exists");
  selectedCourse.years.push({ id: uid(), name, subjects: [] });
  if (await save()) event.target.reset();
};

$("subject-form").onsubmit = async event => {
  event.preventDefault();
  const selectedYear = year($("subject-course").value, $("subject-year").value);
  if (!selectedYear) return toast("Select course and year");
  const name = $("subject-name").value.trim();
  if (!name) return toast("Enter a subject name");
  selectedYear.subjects ||= [];
  if (selectedYear.subjects.some(s => s.name.toLowerCase() === name.toLowerCase())) return toast("Subject already exists");
  selectedYear.subjects.push({ id: uid(), name, teachers: [], chapters: [] });
  if (await save()) event.target.reset();
};

$("teacher-form").onsubmit = async event => {
  event.preventDefault();
  const selectedSubject = subject($("teacher-course").value, $("teacher-year").value, $("teacher-subject").value);
  if (!selectedSubject) return toast("Select course, year and subject");
  const name = $("teacher-name").value.trim();
  if (!name) return toast("Enter teacher name");
  selectedSubject.teachers ||= [];
  if (selectedSubject.teachers.some(t => (t.name || "").toLowerCase() === name.toLowerCase())) return toast("Teacher already exists");
  selectedSubject.teachers.push({ id: uid(), name, description: $("teacher-desc").value.trim(), chapters: [] });
  if (await save()) event.target.reset();
};

$("chapter-form").onsubmit = async event => {
  event.preventDefault();
  const selectedSubject = subject($("chapter-course").value, $("chapter-year").value, $("chapter-subject").value);
  if (!selectedSubject) return toast("Select a subject");
  const selectedTeacher = (selectedSubject.teachers || []).find(t => t.id === $("chapter-teacher").value);
  if (!selectedTeacher) return toast("Select a teacher");
  const name = $("chapter-name").value.trim();
  if (!name) return toast("Enter a chapter name");
  selectedTeacher.chapters ||= [];
  selectedTeacher.chapters.push({ id: uid(), name, lectures: [] });
  if (await save()) event.target.reset();
};

function renderManageLists() {
  $("course-list").innerHTML = data.courses.map(c => `
    <div class="manage-row">
      <div><strong>${esc(c.name)}</strong><small>${(c.years || []).length} years</small></div>
      <div class="mini-actions">
        <button class="mini-btn" data-addyear="${esc(c.id)}">＋ Year</button>
        <button class="mini-btn danger" data-delcourse="${esc(c.id)}">Delete</button>
      </div>
    </div>`).join("");

  $("subject-list").innerHTML = data.courses.flatMap(c => (c.years || []).flatMap(y =>
    (y.subjects || []).map(s => `
      <div class="manage-row">
        <div><strong>${esc(s.name)}</strong><small>${esc(c.name)} / ${esc(y.name)} · ${(s.teachers || []).length} teachers</small></div>
        <button class="mini-btn danger" data-delsubject="${esc(c.id)}|${esc(y.id)}|${esc(s.id)}">Delete</button>
      </div>`))).join("");

  $("teacher-list").innerHTML = data.courses.flatMap(c => (c.years || []).flatMap(y =>
    (y.subjects || []).flatMap(s => (s.teachers || []).map(t => `
      <div class="manage-row"><div><strong>${esc(t.name)}</strong><small>${esc(c.name)} / ${esc(y.name)} / ${esc(s.name)} · ${(t.chapters || []).length} chapters</small></div></div>`)))).join("");

  $("course-list").querySelectorAll("[data-addyear]").forEach(button => button.onclick = () => {
    $("year-course").value = button.dataset.addyear;
    $("year-name").focus();
  });
  $("course-list").querySelectorAll("[data-delcourse]").forEach(button => button.onclick = async () => {
    if (confirm("Delete this course and all its content?")) {
      data.courses = data.courses.filter(c => c.id !== button.dataset.delcourse);
      await save();
    }
  });
  $("subject-list").querySelectorAll("[data-delsubject]").forEach(button => button.onclick = async () => {
    if (!confirm("Delete this subject and all its chapters/lectures?")) return;
    const [courseId, yearId, subjectId] = button.dataset.delsubject.split("|");
    const selectedYear = year(courseId, yearId);
    if (selectedYear) {
      selectedYear.subjects = selectedYear.subjects.filter(s => s.id !== subjectId);
      await save();
    }
  });
}

function renderLectures() {
  const search = $("lecture-search").value.toLowerCase();
  let rows = [];
  for (const c of (data.courses || [])) {
    for (const y of (c.years || [])) {
      for (const s of (y.subjects || [])) {
        for (const t of (s.teachers || [])) {
          for (const ch of (t.chapters || [])) {
            for (const l of (ch.lectures || [])) rows.push({ c, y, s, t, ch, l });
          }
        }
        for (const ch of (s.chapters || [])) {
          for (const l of (ch.lectures || [])) rows.push({ c, y, s, t: null, ch, l });
        }
      }
    }
  }
  rows = rows.filter(x => `${x.l.title} ${x.c.name} ${x.s.name} ${x.ch.name}`.toLowerCase().includes(search));
  $("lecture-list").innerHTML = rows.length ? rows.map(({ c, y, s, t, ch, l }) => `
    <div class="lecture-admin-row">
      <div><h4>${esc(l.title)} <span class="badge ${esc(l.status || "published")}">${esc(l.status || "published")}</span></h4>
      <p>${esc(c.name)} / ${esc(y.name)} / ${esc(s.name)} / ${esc(t?.name || "Legacy")} / ${esc(ch.name)}<br>
      ${l.videoUrl ? "Video · " : ""}${l.pdfUrl ? "PDF · " : ""}${l.scheduleAt ? "Schedule: " + esc(l.scheduleAt) : ""}</p></div>
      <div class="mini-actions"><button class="mini-btn" data-edit="${esc(l.id)}">Edit</button><button class="mini-btn danger" data-delete="${esc(l.id)}">Delete</button></div>
    </div>`).join("") : '<div class="empty">No lectures found. Add your first lecture above.</div>';

  $("lecture-list").querySelectorAll("[data-edit]").forEach(button => button.onclick = () => editLectureById(button.dataset.edit));
  $("lecture-list").querySelectorAll("[data-delete]").forEach(button => button.onclick = async () => {
    if (!confirm("Delete this lecture?")) return;
    data.courses.forEach(c => (c.years || []).forEach(y => (y.subjects || []).forEach(s => {
      (s.teachers || []).forEach(t => (t.chapters || []).forEach(ch => { ch.lectures = (ch.lectures || []).filter(l => l.id !== button.dataset.delete); }));
      (s.chapters || []).forEach(ch => { ch.lectures = (ch.lectures || []).filter(l => l.id !== button.dataset.delete); });
    })));
    await save();
  });
}
$("lecture-search").oninput = renderLectures;
if ($("refresh-visits")) $("refresh-visits").onclick = loadVisits;

function editLectureById(id) {
  for (const c of data.courses) for (const y of (c.years || [])) for (const s of (y.subjects || [])) for (const t of (s.teachers || [])) for (const ch of (t.chapters || [])) {
    const lecture = (ch.lectures || []).find(item => item.id === id);
    if (!lecture) continue;
    editLecture = { id, c, y, s, t, ch };
    $("lecture-course").value = c.id; refreshDependent();
    $("lecture-year").value = y.id; refreshDependent();
    $("lecture-subject").value = s.id; refreshDependent();
    $("lecture-teacher").value = t.id; refreshDependent();
    $("lecture-chapter").value = ch.id;
    $("lecture-title").value = lecture.title || "";
    $("lecture-video").value = lecture.videoUrl || "";
    $("lecture-pdf").value = lecture.pdfUrl || "";
    $("lecture-notes").value = lecture.notesUrl || lecture.notes || "";
    $("lecture-thumb").value = lecture.thumbnail || "";
    $("lecture-date").value = lecture.publishDate || "";
    $("lecture-schedule").value = lecture.scheduleAt || "";
    $("lecture-status").value = lecture.status || "published";
    $("lecture-description").value = lecture.description || "";
    $("lecture-submit").textContent = "Save changes";
    $("cancel-edit").classList.remove("hidden");
    window.scrollTo({ top: $("lecture-form").getBoundingClientRect().top + window.scrollY - 100, behavior: "smooth" });
    return;
  }
}

function resetLectureForm() {
  $("lecture-form").reset();
  editLecture = null;
  $("lecture-submit").textContent = "＋ Save Lecture";
  $("cancel-edit").classList.add("hidden");
  $("lecture-msg").textContent = "";
}
$("cancel-edit").onclick = resetLectureForm;

$("lecture-form").onsubmit = async event => {
  event.preventDefault();
  const selectedSubject = subject($("lecture-course").value, $("lecture-year").value, $("lecture-subject").value);
  const selectedTeacher = (selectedSubject?.teachers || []).find(t => t.id === $("lecture-teacher").value);
  const selectedChapter = selectedTeacher?.chapters?.find(ch => ch.id === $("lecture-chapter").value);
  if (!selectedChapter) return toast("Select a chapter");
  const item = {
    id: editLecture?.id || uid(),
    title: $("lecture-title").value.trim(),
    videoUrl: $("lecture-video").value.trim(),
    pdfUrl: $("lecture-pdf").value.trim(),
    notesUrl: $("lecture-notes").value.trim(),
    notes: $("lecture-notes").value.trim(),
    thumbnail: $("lecture-thumb").value.trim(),
    publishDate: $("lecture-date").value,
    scheduleAt: $("lecture-schedule").value,
    status: $("lecture-status").value,
    description: $("lecture-description").value.trim(),
    updatedAt: new Date().toISOString()
  };
  if (!item.title) return toast("Enter a lecture title");
  if (editLecture) {
    const oldIndex = editLecture.ch.lectures.findIndex(l => l.id === editLecture.id);
    if (oldIndex >= 0) editLecture.ch.lectures.splice(oldIndex, 1);
  }
  selectedChapter.lectures ||= [];
  selectedChapter.lectures.push(item);
  if (await save()) resetLectureForm();
};

(async () => {
  if (key) {
    try {
      // Re-check the stored key against the protected write endpoint without changing the stored data.
      const current = normalizeTeacherHierarchy(await request("/api/data", {}, ""));
      await request("/api/data", { method: "PUT", body: JSON.stringify(current) }, key);
      data = current;
      showDashboard();
      renderAll();
    } catch {
      key = "";
      sessionStorage.removeItem("thanos_admin_key");
      showLogin();
    }
  } else {
    showLogin();
  }
})();
