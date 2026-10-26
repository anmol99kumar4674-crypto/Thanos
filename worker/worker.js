/**
 * Thanos API — Cloudflare Worker + D1
 * Bind D1 database as DB. Set secrets ADMIN_KEY and CORS_ORIGIN.
 * GET /api/data is public; PUT /api/data requires X-Admin-Key.
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
    "access-control-allow-methods":"GET,PUT,OPTIONS",
    "access-control-allow-headers":"Content-Type,X-Admin-Key",
    "cache-control":"no-store"
  }});
}
export default {
 async fetch(request, env) {
   const origin = env.CORS_ORIGIN || "*";
   const url = new URL(request.url);
   if (request.method === "OPTIONS") return new Response(null,{status:204,headers:{
     "access-control-allow-origin":origin,"access-control-allow-methods":"GET,PUT,OPTIONS",
     "access-control-allow-headers":"Content-Type,X-Admin-Key","access-control-max-age":"86400"
   }});
   // Admin login validation endpoint. It checks the secret without modifying D1 data.
   if (url.pathname === "/api/auth") {
     if (request.method !== "POST") return json({error:"Method not allowed"},405,origin);
     if (!env.ADMIN_KEY || request.headers.get("X-Admin-Key") !== env.ADMIN_KEY)
       return json({error:"Unauthorized admin key"},401,origin);
     return json({ok:true},200,origin);
   }
   if (url.pathname !== "/api/data") return json({error:"Not found"},404,origin);
   if (!env.DB) return json({error:"D1 database binding DB is not configured"},500,origin);
   if (request.method === "GET") {
     try {
       const row = await env.DB.prepare("SELECT value FROM app_data WHERE id = 1").first();
       if (!row) return json(DEFAULT_DATA,200,origin);
       return json(JSON.parse(row.value),200,origin);
     } catch(e) { return json({error:"Database is not ready. Run schema.sql first."},500,origin); }
   }
   if (request.method === "PUT") {
     if (!env.ADMIN_KEY || request.headers.get("X-Admin-Key") !== env.ADMIN_KEY)
       return json({error:"Unauthorized admin key"},401,origin);
     let value;
     try { value = await request.json(); } catch { return json({error:"Invalid JSON"},400,origin); }
     if (!value || !Array.isArray(value.courses)) return json({error:"Expected courses array"},400,origin);
     if (JSON.stringify(value).length > 2_000_000) return json({error:"Data too large"},413,origin);
     try {
       await env.DB.prepare("INSERT INTO app_data (id, value, updated_at) VALUES (1, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP")
         .bind(JSON.stringify(value)).run();
       return json({ok:true,updatedAt:new Date().toISOString()},200,origin);
     } catch(e) { return json({error:"Could not save data. Check D1 schema."},500,origin); }
   }
   return json({error:"Method not allowed"},405,origin);
 }
};