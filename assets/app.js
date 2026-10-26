const API_BASE = (window.THANOS_API_BASE || "").replace(/\/$/, "");
const seed = {courses:[
{id:"mbbs",name:"MBBS",description:"Bachelor of Medicine and Bachelor of Surgery",years:[]},
{id:"bds",name:"BDS",description:"Bachelor of Dental Surgery",years:[]},
{id:"other",name:"OTHER",description:"Other learning programmes",years:[]}
]};
let data=seed, path=[];
async function loadData(){try{const r=await fetch(API_BASE+"/api/data");if(!r.ok)throw Error();data=await r.json();if(!data.courses)data=seed}catch(e){data=seed}}
const el=id=>document.getElementById(id);
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function idName(x){return x?.name||""}
function renderCourses(){const grid=el("course-grid");el("course-count").textContent=`${data.courses.length} courses`;grid.innerHTML=data.courses.length?data.courses.map((c,i)=>`<button class="course-card" data-course="${esc(c.id)}"><div class="course-icon">${["✚","✦","▤"][i%3]}</div><h3>${esc(c.name)}</h3><p>${esc(c.description||"Explore subjects, chapters and lectures.")}</p><div class="card-bottom"><span>${(c.years||[]).length} years available</span><span>Explore →</span></div></button>`).join(""):`<div class="empty">No courses have been published yet.</div>`;grid.querySelectorAll("[data-course]").forEach(b=>b.onclick=()=>{path=[b.dataset.course];renderContent()});}
function find(){let c=data.courses.find(x=>x.id===path[0]),y=c?.years?.find(x=>x.id===path[1]),s=y?.subjects?.find(x=>x.id===path[2]),ch=s?.chapters?.find(x=>x.id===path[3]);return {c,y,s,ch}}
function renderContent(){const {c,y,s,ch}=find();el("learning-area").classList.remove("hidden");el("course-grid").classList.add("hidden");el("breadcrumb").textContent=[c?.name,y?.name,s?.name,ch?.name].filter(Boolean).join("  /  ");const heading=el("current-heading"),grid=el("content-grid");let items=[],level="";
if(!y){heading.textContent="Choose a year";items=(c?.years||[]).map(x=>({item:x,meta:`${(x.subjects||[]).length} subjects`,level:"year"}));}
else if(!s){heading.textContent="Subjects";items=(y.subjects||[]).map(x=>({item:x,meta:`${(x.chapters||[]).length} chapters`,level:"subject"}));}
else if(!ch){heading.textContent="Chapters";items=(s.chapters||[]).map(x=>({item:x,meta:`${(x.lectures||[]).filter(isVisible).length} lectures`,level:"chapter"}));}
else{heading.textContent="Lectures";items=(ch.lectures||[]).filter(isVisible).map(x=>({item:x,meta:x.description||"",level:"lecture"}));}
if(!items.length){grid.innerHTML='<div class="empty">Content will appear here once the admin adds it.</div>';return}
grid.innerHTML=items.map(({item,meta,level:l})=>l==="lecture"?`<article class="lecture-item">${item.thumbnail?`<img class="lecture-thumb" src="${esc(item.thumbnail)}" alt="">`:'<div class="lecture-thumb"></div>'}<div><h3>${esc(item.title)}</h3><p class="muted">${esc(meta)}</p><div class="lecture-links">${item.videoUrl?`<a href="${esc(item.videoUrl)}" target="_blank" rel="noopener">▶ Watch video</a>`:""}${item.pdfUrl?`<a href="${esc(item.pdfUrl)}" target="_blank" rel="noopener">↓ PDF</a>`:""}${item.notesUrl?`<a href="${esc(item.notesUrl)}" target="_blank" rel="noopener">Notes</a>`:""}</div></div></article>`:`<button class="content-card" data-next="${esc(item.id)}"><h3>${esc(item.name)}</h3><p>${esc(meta)}</p><span class="arrow">Open →</span></button>`).join("");
grid.querySelectorAll("[data-next]").forEach(b=>b.onclick=()=>{path.push(b.dataset.next);renderContent()});}
function isVisible(l){if(l.status==="draft")return false;const date=l.scheduleAt||"";if(l.status==="scheduled"&&date&&new Date(date)>new Date())return false;if(date&&new Date(date)>new Date())return false;return true}
el("back-btn").onclick=()=>{if(path.length)path.pop();if(!path.length){el("learning-area").classList.add("hidden");el("course-grid").classList.remove("hidden")}else renderContent()};
(async()=>{await loadData();renderCourses()})();