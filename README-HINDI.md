# Thanos — Course / Year / Subject / Chapter / Lecture

यह starter project एक responsive education website और admin panel देता है।

## शामिल फीचर्स
- Public frontend: Course → Year → Subject → Chapter → Lecture
- MBBS, BDS और OTHER शुरुआती courses
- Admin से Course, Year, Subject, Chapter जोड़ना
- Lecture title, video URL, PDF URL, notes URL, thumbnail URL, description
- Publish date, schedule date/time, Published / Draft / Scheduled status
- Lecture edit और delete
- Cloudflare Worker API + D1 database scaffold
- Admin key frontend में hardcode नहीं है; request पर `X-Admin-Key` header में जाता है

## Important
Frontend और API अलग origins पर हों तो `assets/app.js` तथा `assets/admin.js` की पहली लाइन में `THANOS_API_BASE` को अपने Worker URL से सेट करें, उदाहरण:
`const API_BASE = "https://thanos-api.YOUR-SUBDOMAIN.workers.dev";`

इसे अपनी वेबसाइट के domain के अनुसार बदलें। URL के अंत में slash न रखें।

## Cloudflare setup
1. GitHub पर इस folder के files upload करें।
2. Cloudflare Dashboard में D1 database बनाएं, नाम `thanos-db` रख सकते हैं।
3. D1 Console में `worker/schema.sql` का SQL चलाएं।
4. Worker बनाकर `worker/worker.js` deploy करें। Login के लिए `/api/auth` endpoint वाला नया Worker code भी deploy करना ज़रूरी है।
5. Worker settings में D1 binding जोड़ें: variable name `DB`, अपनी बनाई database चुनें।
6. Worker Secrets में `ADMIN_KEY` नाम का मजबूत, अलग admin key सेट करें।
7. Variable `CORS_ORIGIN` को frontend के exact origin पर सेट करें, जैसे `https://thanos.pages.dev`। Custom domain हो तो उसी domain का origin रखें।
8. `worker/wrangler.toml.example` में `database_id` बदलकर इसे `wrangler.toml` नाम से उपयोग कर सकते हैं; या Dashboard से binding जोड़ें।
9. `assets/app.js` और `assets/admin.js` में `API_BASE` को deployed Worker URL पर सेट करें।
10. Frontend files को Cloudflare Pages या GitHub Pages पर deploy करें। Cloudflare Pages पर custom domain जोड़ना भी संभव है।
11. वेबसाइट खोलें, फिर `/admin.html` खोलकर वही `ADMIN_KEY` डालें।

## GitHub पर upload
- Repository खोलें → Add file → Upload files → इस ZIP की extracted files upload करें → Commit changes.
- अगर आपका पहले से Thanos repo है, तो पुराने files का backup लेकर ही overwrite करें।

## सीमाएँ / सुरक्षा नोट
- यह project एक JSON document के रूप में hierarchy store करता है; छोटे/मध्यम content catalogue के लिए सरल तरीका है।
- Admin key browser sessionStorage में केवल current session के लिए रहती है और हर write request पर Worker से verify होती है। Admin key साझा न करें।
- इस starter में public data GET endpoint पूरा catalogue देता है। निजी/paid lectures के लिए user login, permissions और signed/private media URLs अलग से जोड़ने होंगे।
- Video URL के लिए इस version में external link खुलता है; embedded player support बाद में जोड़ा जा सकता है।
- Schedule visibility browser/API data में मौजूद schedule timestamp पर आधारित है; admin द्वारा चुने गए समय से पहले scheduled lecture public listing में नहीं दिखेगा।
