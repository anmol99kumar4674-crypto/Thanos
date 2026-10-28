/**
 * Thanos API — Cloudflare Worker + D1
 * Bind D1 as DB; set ADMIN_KEY secret and CORS_ORIGIN variable if desired.
 * Student name/course is a lightweight profile, NOT secure identity verification.
 */
const DEFAULT_DATA = { courses: [
  { id: "mbbs", name: "MBBS", description: "Bachelor of Medicine and Bachelor of Surgery", years: [] },
  { id: "bds", name: "BDS", description: "Bachelor of Dental Surgery", years: [] },
  { id: "other", name: "OTHER", description: "Other learning programmes", years: [] }
] };
function json(data, status=200, origin="*") {
  return new Response(JSON.stringify(data), { status, headers: {
    "content-type":"application/json; charset=utf-8",
    "access-control-allow-origin": origin || "*",
    "access-control-allow-methods":"GET,POST,PUT,OPTIONS",
    "access-control-allow-headers":"Content-Type,X-Admin-Key",
    "cache-control":"no-store"
  }});
}
async function body(request) { try { return await request.json(); } catch { return null; } }
function adminOK(request, env) { return !!env.ADMIN_KEY && request.headers.get("X-Admin-Key") === env.ADMIN_KEY; }
export default {
 async fetch(request, env) {
   const origin = env.CORS_ORIGIN || "*";
   const url = new URL(request.url);
   if (request.method === "OPTIONS") return new Response(null,{status:204,headers:{
     "access-control-allow-origin":origin,"access-control-allow-methods":"GET,POST,PUT,OPTIONS",
     "access-control-allow-headers":"Content-Type,X-Admin-Key","access-control-max-age":"86400"
   }});
   if (!env.DB) return json({error:"D1 database binding DB is not configured"},500,origin);

   if (url.pathname === "/api/data") {
     if (request.method === "GET") {
       try {
         const row = await env.DB.prepare("SELECT value FROM app_data WHERE id = 1").first();
         return json(row ? JSON.parse(row.value) : DEFAULT_DATA,200,origin);
       } catch(e) { return json({error:"Database is not ready. Run schema.sql first."},500,origin); }
     }
     if (request.method === "PUT") {
       if (!adminOK(request,env)) return json({error:"Unauthorized admin key"},401,origin);
       const value = await body(request);
       if (!value || !Array.isArray(value.courses)) return json({error:"Expected courses array"},400,origin);
       if (JSON.stringify(value).length > 2_000_000) return json({error:"Data too large"},413,origin);
       try {
         await env.DB.prepare("INSERT INTO app_data (id, value, updated_at) VALUES (1, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP").bind(JSON.stringify(value)).run();
         return json({ok:true,updatedAt:new Date().toISOString()},200,origin);
       } catch(e) { return json({error:"Could not save data. Check D1 schema."},500,origin); }
     }
     return json({error:"Method not allowed"},405,origin);
   }

   if (url.pathname === "/api/visit/start" && request.method === "POST") {
     const b = await body(request);
     const name = String(b?.name || "").trim().slice(0,100);
     const course = String(b?.course || "").trim().slice(0,100);
     const sessionId = String(b?.sessionId || "").trim().slice(0,100);
     if (!name || !course || !sessionId) return json({error:"Name, course and sessionId are required"},400,origin);
     try {
       await env.DB.prepare("INSERT INTO student_visits (session_id, student_name, course, started_at, last_seen_at, ended_at, duration_seconds, status) VALUES (?, ?, ?, ?, ?, NULL, 0, 'active') ON CONFLICT(session_id) DO UPDATE SET student_name=excluded.student_name, course=excluded.course, started_at=excluded.started_at, last_seen_at=excluded.last_seen_at, ended_at=NULL, duration_seconds=0, status='active'")
         .bind(sessionId,name,course,new Date().toISOString(),new Date().toISOString()).run();
       return json({ok:true,sessionId},200,origin);
     } catch(e) { return json({error:"Visit tracking table missing. Run worker/schema.sql in D1."},500,origin); }
   }
   if (url.pathname === "/api/visit/ping" && request.method === "POST") {
     const b = await body(request); const sessionId = String(b?.sessionId || "").slice(0,100);
     if (!sessionId) return json({error:"sessionId required"},400,origin);
     try {
       const now = new Date().toISOString();
       await env.DB.prepare("UPDATE student_visits SET last_seen_at=?, duration_seconds=MAX(0, CAST((julianday(?) - julianday(started_at))*86400 AS INTEGER)) WHERE session_id=? AND status='active'").bind(now,now,sessionId).run();
       return json({ok:true},200,origin);
     } catch(e) { return json({error:"Visit tracking table missing"},500,origin); }
   }
   if (url.pathname === "/api/visit/end" && request.method === "POST") {
     const b = await body(request); const sessionId = String(b?.sessionId || "").slice(0,100);
     if (!sessionId) return json({error:"sessionId required"},400,origin);
     try {
       const now = new Date().toISOString();
       await env.DB.prepare("UPDATE student_visits SET ended_at=?, last_seen_at=?, duration_seconds=MAX(0, CAST((julianday(?) - julianday(started_at))*86400 AS INTEGER)), status='ended' WHERE session_id=? AND status='active'").bind(now,now,now,sessionId).run();
       return json({ok:true},200,origin);
     } catch(e) { return json({error:"Visit tracking table missing"},500,origin); }
   }
   if (url.pathname === "/api/visits" && request.method === "GET") {
     if (!adminOK(request,env)) return json({error:"Unauthorized admin key"},401,origin);
     try {
       const result = await env.DB.prepare("SELECT session_id, student_name, course, started_at, last_seen_at, ended_at, duration_seconds, status FROM student_visits ORDER BY started_at DESC LIMIT 1000").all();
       return json({visits:result.results || []},200,origin);
     } catch(e) { return json({error:"Visit tracking table missing. Run worker/schema.sql in D1."},500,origin); }
   }
   return json({error:"Not found"},404,origin);
 }
};
