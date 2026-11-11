export interface Env {
  DB: D1Database;
  FLAGS: KVNamespace;
  ADMIN_API_TOKEN: string;
  APP_ORIGIN: string;
}

type ReleaseRow = {
  id: string;
  version: string;
  object_key: string;
  sha256: string;
  byte_size: number;
  question_count: number;
  channel: string;
  is_active: number;
  created_at: string;
  published_at: string | null;
};

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };
const ADMIN_HTML = "<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<meta name=\"theme-color\" content=\"#07152d\">\n<title>SHBACE Cloud Admin</title>\n<style>\n:root{color-scheme:dark;font-family:Inter,system-ui,sans-serif;background:#07152d;color:#eaf2ff}\n*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 10% 0,#12366a 0,transparent 38%),#07152d;min-height:100vh}\nmain{max-width:980px;margin:auto;padding:28px 18px 60px}.brand{display:flex;align-items:center;gap:12px;margin-bottom:28px}.mark{width:46px;height:46px;border-radius:15px;background:linear-gradient(135deg,#2e8bff,#42d3cb);display:grid;place-items:center;font-weight:900;color:#06152b;font-size:22px}.brand h1{font-size:20px;margin:0}.brand p{margin:3px 0 0;color:#91a9ca;font-size:13px}\n.card{background:#0d203d;border:1px solid #254367;border-radius:18px;padding:20px;margin:14px 0;box-shadow:0 12px 35px #0003}.card h2{font-size:17px;margin:0 0 14px}.muted{color:#9db2d0;font-size:13px;line-height:1.6}\nlabel{display:block;font-size:13px;color:#b8cbe4;margin:12px 0 6px}input,textarea,button{font:inherit}input,textarea{width:100%;background:#07152d;color:#f3f7ff;border:1px solid #365477;border-radius:10px;padding:12px}textarea{min-height:130px;resize:vertical}button{border:0;border-radius:10px;padding:11px 16px;background:#287ee8;color:white;font-weight:700;cursor:pointer;margin:10px 8px 0 0}button.secondary{background:#1a3658;border:1px solid #416184}button.danger{background:#923c50}.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.status{padding:11px 13px;border-radius:10px;background:#102b4b;color:#bcd7f8;margin-top:12px;white-space:pre-wrap;font-size:13px}.item{display:flex;align-items:center;justify-content:space-between;gap:12px;border-top:1px solid #284361;padding:12px 0}.item small{display:block;color:#8fa8c9;margin-top:4px}.toggle{display:flex;align-items:center;gap:9px;margin:12px 0}.toggle input{width:auto}.hidden{display:none!important}@media(max-width:650px){.row{grid-template-columns:1fr}.card{padding:16px}}\n</style>\n</head>\n<body><main>\n<header class=\"brand\"><div class=\"mark\">S</div><div><h1>SHBACE MEDICAL · CLOUD</h1><p>Private administration console</p></div></header>\n<section class=\"card\">\n<h2>Secure connection</h2><p class=\"muted\">Paste the Worker admin token. It is kept only in this browser tab session and is never saved to the repository.</p>\n<label for=\"api\">Cloudflare Worker URL</label><input id=\"api\" placeholder=\"https://shbace-medical-cloud.your-subdomain.workers.dev\">\n<label for=\"token\">Admin API token</label><input id=\"token\" type=\"password\" autocomplete=\"off\" placeholder=\"Paste Worker secret\">\n<button id=\"connect\">Connect</button><div id=\"status\" class=\"status\">Not connected.</div>\n</section>\n<section id=\"console\" class=\"hidden\">\n<div class=\"card\"><h2>Publish question bank</h2><p class=\"muted\">Upload a JSON bank with the existing SHBACE shape: an object containing <code>questions</code> and <code>order</code>. Publishing creates a versioned cloud snapshot; it does not alter the app's bundled original bank.</p>\n<div class=\"row\"><div><label for=\"version\">Release version</label><input id=\"version\" placeholder=\"1.1.1\"></div><div><label for=\"bankfile\">Question-bank JSON file</label><input id=\"bankfile\" type=\"file\" accept=\".json,application/json\"></div></div>\n<label for=\"bankjson\">Or paste question-bank JSON</label><textarea id=\"bankjson\" placeholder='{\"questions\":[],\"order\":{}}'></textarea>\n<button id=\"publish\">Validate & publish</button></div>\n<div class=\"card\"><h2>Feature switches</h2><p class=\"muted\">Switches are configuration only. Features remain disabled until their client-side implementation is released and verified.</p>\n<label class=\"toggle\"><input type=\"checkbox\" id=\"flag-remoteQuestionBank\"> Remote question-bank delivery</label>\n<label class=\"toggle\"><input type=\"checkbox\" id=\"flag-flashcards\"> Flashcards module</label>\n<label class=\"toggle\"><input type=\"checkbox\" id=\"flag-cloudProgressSync\"> Cloud progress sync</label>\n<button id=\"saveFlags\">Save feature switches</button></div>\n<div class=\"card\"><h2>Release history</h2><div id=\"releases\" class=\"muted\">Connect to load releases.</div><button class=\"secondary\" id=\"refresh\">Refresh</button></div>\n<div class=\"card\"><h2>Admin audit trail</h2><div id=\"audit\" class=\"muted\">Connect to load audit events.</div><button class=\"secondary\" id=\"refreshAudit\">Refresh audit</button></div>\n</section>\n<script>\n(function(){\n'use strict';\nconst $=id=>document.getElementById(id);\nlet api='',token='';\nfunction message(text){$('status').textContent=text}\nfunction authHeaders(){return {'Authorization':'Bearer '+token,'Content-Type':'application/json'}}\nasync function call(path,options={}){const r=await fetch(api.replace(/\\/$/,'')+path,{...options,headers:{...authHeaders(),...(options.headers||{})}});const body=await r.json().catch(()=>({error:'Invalid server response'}));if(!r.ok)throw new Error(body.error||('HTTP '+r.status));return body}\n$('connect').onclick=async()=>{api=$('api').value.trim();token=$('token').value.trim();if(!/^https:\\/\\//.test(api)||!token){message('Enter an HTTPS Worker URL and admin token.');return}try{const r=await call('/v1/admin/releases');sessionStorage.setItem('shbace-cloud-api',api);sessionStorage.setItem('shbace-cloud-token',token);$('console').classList.remove('hidden');message('Connected securely.');renderReleases(r.releases||[]);await loadFeatures()}catch(e){message('Connection failed: '+e.message)}};\nasync function loadFeatures(){const r=await fetch(api.replace(/\\/$/,'')+'/v1/release');const d=await r.json();const f=d.features||{};['remoteQuestionBank','flashcards','cloudProgressSync'].forEach(k=>{$('flag-'+k).checked=!!f[k]})}\nfunction renderReleases(items){$('releases').innerHTML='';if(!items.length){$('releases').textContent='No releases have been published yet.';return}items.forEach(item=>{const div=document.createElement('div');div.className='item';const info=document.createElement('div');const strong=document.createElement('strong');strong.textContent=item.version+(item.active?' · ACTIVE':'');const small=document.createElement('small');small.textContent=item.questionCount+' questions · '+item.channel+' · '+item.sha256.slice(0,12);info.append(strong,small);div.append(info);if(!item.active){const b=document.createElement('button');b.className='secondary';b.textContent='Rollback to this version';b.onclick=async()=>{if(!confirm('Make '+item.version+' active?'))return;try{await call('/v1/admin/rollback',{method:'POST',body:JSON.stringify({version:item.version})});message('Rollback complete.');await refresh()}catch(e){message(e.message)}};div.append(b)}$('releases').append(div)})}\nasync function refresh(){const r=await call('/v1/admin/releases');renderReleases(r.releases||[])}\nasync function refreshAudit(){const r=await call('/v1/admin/audit');$('audit').innerHTML='';(r.events||[]).forEach(e=>{const d=document.createElement('div');d.className='item';const s=document.createElement('span');s.textContent=e.action+' · '+(e.target||'—');const sm=document.createElement('small');sm.textContent=e.created_at+' · '+e.details_json;d.append(s,sm);$('audit').append(d)})}\n$('refresh').onclick=()=>refresh().catch(e=>message(e.message));\n$('refreshAudit').onclick=()=>refreshAudit().catch(e=>message(e.message));\n$('bankfile').onchange=async e=>{const f=e.target.files[0];if(f)$('bankjson').value=await f.text()};\n$('publish').onclick=async()=>{try{const version=$('version').value.trim();const bank=JSON.parse($('bankjson').value);if(!version)throw new Error('Enter a release version.');if(!Array.isArray(bank.questions)||!bank.order)throw new Error('The JSON must include questions[] and order{}.');if(!confirm('Publish '+version+' with '+bank.questions.length+' questions?'))return;const r=await call('/v1/admin/releases',{method:'POST',body:JSON.stringify({version,bank,channel:'stable'})});message('Published '+r.release.version+' · '+r.release.questionCount+' questions.');$('bankjson').value='';$('bankfile').value='';await refresh()}catch(e){message('Publish failed: '+e.message)}};\n$('saveFlags').onclick=async()=>{try{const features={remoteQuestionBank:$('flag-remoteQuestionBank').checked,flashcards:$('flag-flashcards').checked,cloudProgressSync:$('flag-cloudProgressSync').checked};const r=await call('/v1/admin/features',{method:'PUT',body:JSON.stringify({features})});message('Feature switches saved.');}catch(e){message(e.message)}};\nconst savedApi=sessionStorage.getItem('shbace-cloud-api');if(savedApi)$('api').value=savedApi;\n})();\n</script>\n</main></body></html>\n";
const MAX_BANK_BYTES = 12 * 1024 * 1024;

function json(data: unknown, status = 200, extra: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...jsonHeaders, "cache-control": "no-store", ...extra }
  });
}

function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aa = enc.encode(a);
  const bb = enc.encode(b);
  let diff = aa.length ^ bb.length;
  const length = Math.max(aa.length, bb.length);
  for (let i = 0; i < length; i++) diff |= (aa[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

function cors(request: Request, env: Env): Headers {
  const origin = request.headers.get("Origin");
  const headers = new Headers({
    "access-control-allow-methods": "GET,POST,PUT,OPTIONS",
    "access-control-allow-headers": "Content-Type,Authorization,If-None-Match",
    "access-control-max-age": "86400",
    "vary": "Origin"
  });
  if (origin && (origin === env.APP_ORIGIN || origin === new URL(request.url).origin)) {
    headers.set("access-control-allow-origin", origin);
  }
  return headers;
}

function withCors(response: Response, headers: Headers): Response {
  const merged = new Headers(response.headers);
  headers.forEach((value, key) => merged.set(key, value));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: merged });
}

function adminAuthorized(request: Request, env: Env): boolean {
  const supplied = request.headers.get("Authorization") || "";
  const token = supplied.startsWith("Bearer ") ? supplied.slice(7) : "";
  return !!env.ADMIN_API_TOKEN && safeEqual(token, env.ADMIN_API_TOKEN);
}

function auditStatement(env: Env, action: string, target: string | null, details: unknown = {}) {
  return env.DB.prepare(
    "INSERT INTO admin_audit(action,target,details_json) VALUES(?,?,?)"
  ).bind(action, target, JSON.stringify(details));
}

async function activeRelease(env: Env): Promise<ReleaseRow | null> {
  return await env.DB.prepare(
    "SELECT * FROM releases WHERE is_active = 1 ORDER BY published_at DESC LIMIT 1"
  ).first<ReleaseRow>();
}

function releaseDto(row: ReleaseRow) {
  return {
    id: row.id, version: row.version, sha256: row.sha256,
    byteSize: row.byte_size, questionCount: row.question_count,
    channel: row.channel, publishedAt: row.published_at, active: !!row.is_active
  };
}

function validVersion(value: unknown): value is string {
  return typeof value === "string" && /^[0-9A-Za-z][0-9A-Za-z._+-]{0,63}$/.test(value);
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });

  if (request.method === "GET" && path === "/v1/health") {
    return json({ ok: true, service: "shbace-medical-cloud", apiVersion: 1, time: new Date().toISOString() });
  }

  if (request.method === "GET" && path === "/v1/release") {
    const row = await activeRelease(env);
    const cfg = await env.DB.prepare("SELECT config_value FROM app_config WHERE config_key='features'").first<{config_value:string}>();
    let features = { remoteQuestionBank: false, flashcards: false, cloudProgressSync: false };
    if (cfg?.config_value) {
      try { features = { ...features, ...JSON.parse(cfg.config_value) }; } catch { /* retain safe defaults */ }
    }
    return json({ release: row ? releaseDto(row) : null, features });
  }

  if (request.method === "GET" && path === "/v1/question-bank") {
    const row = await activeRelease(env);
    if (!row) return json({ error: "No cloud question-bank release has been published." }, 404);
    const chunks = await env.DB.prepare(
      "SELECT chunk_text FROM release_chunks WHERE release_id=? ORDER BY chunk_index ASC"
    ).bind(row.id).all<{chunk_text:string}>();
    if (!chunks.results?.length) return json({ error: "Published content chunks are missing." }, 503);
    const bankText = chunks.results.map(part => part.chunk_text).join("");
    const etag = '"' + row.sha256 + '"';
    if (request.headers.get("If-None-Match") === etag) {
      return new Response(null, { status: 304, headers: { etag, "cache-control": "public, max-age=60" } });
    }
    return new Response(bankText, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=60, stale-while-revalidate=300",
        etag,
        "x-shbace-release": row.version,
        "x-shbace-sha256": row.sha256
      }
    });
  }

  if (path.startsWith("/v1/admin/")) {
    if (!adminAuthorized(request, env)) return json({ error: "Unauthorized" }, 401);
    if (request.method === "GET" && path === "/v1/admin/releases") {
      const rows = await env.DB.prepare("SELECT * FROM releases ORDER BY created_at DESC LIMIT 100").all<ReleaseRow>();
      return json({ releases: (rows.results || []).map(releaseDto) });
    }
    if (request.method === "GET" && path === "/v1/admin/audit") {
      const rows = await env.DB.prepare("SELECT id,action,target,details_json,created_at FROM admin_audit ORDER BY id DESC LIMIT 100").all();
      return json({ events: rows.results || [] });
    }

    if (request.method === "POST" && path === "/v1/admin/releases") {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).byteLength > MAX_BANK_BYTES) return json({ error: "Question bank exceeds 12 MiB limit." }, 413);
      let body: any;
      try { body = JSON.parse(raw); } catch { return json({ error: "Request body must be valid JSON." }, 400); }
      const version = body?.version;
      const bank = body?.bank;
      const channel = body?.channel === "preview" ? "preview" : "stable";
      if (!validVersion(version)) return json({ error: "Invalid release version." }, 400);
      if (!bank || !Array.isArray(bank.questions) || !bank.order || typeof bank.order !== "object") {
        return json({ error: "Bank must contain a questions array and an order object." }, 400);
      }
      if (bank.questions.length < 1 || bank.questions.length > 100000) return json({ error: "Question count is outside the supported range." }, 400);
      const ids = new Set<string>();
      for (const question of bank.questions) {
        if (!question || typeof question.id !== "string" || !question.id.trim() || ids.has(question.id)) {
          return json({ error: "Every question must have a unique, non-empty string ID." }, 400);
        }
        ids.add(question.id);
      }
      const bytes = new TextEncoder().encode(JSON.stringify(bank));
      if (bytes.byteLength > MAX_BANK_BYTES) return json({ error: "Serialized question bank exceeds 12 MiB limit." }, 413);
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const sha256 = Array.from(new Uint8Array(digest)).map(x => x.toString(16).padStart(2, "0")).join("");
      const existing = await env.DB.prepare("SELECT id FROM releases WHERE version=?").bind(version).first<{id:string}>();
      if (existing) return json({ error: "This release version already exists. Choose a new version; published snapshots are immutable." }, 409);
      const id = crypto.randomUUID();
      const objectKey = "d1:" + version;
      const bankText = new TextDecoder().decode(bytes);
      const chunkTexts: string[] = [];
      for (let offset = 0; offset < bankText.length;) {
        let end = Math.min(offset + 32000, bankText.length);
        if (end < bankText.length && end > offset) {
          const last = bankText.charCodeAt(end - 1);
          if (last >= 0xD800 && last <= 0xDBFF) end--;
        }
        chunkTexts.push(bankText.slice(offset, end));
        offset = end;
      }
      const now = new Date().toISOString();
      const statements = [
        env.DB.prepare("INSERT INTO releases(id,version,object_key,sha256,byte_size,question_count,channel,is_active,published_at) VALUES(?,?,?,?,?,?,?,?,?)")
          .bind(id, version, objectKey, sha256, bytes.byteLength, bank.questions.length, channel, 0, now)
      ];
      for (let i = 0; i < chunkTexts.length; i++) {
        statements.push(env.DB.prepare(
          "INSERT INTO release_chunks(release_id,chunk_index,chunk_text) VALUES(?,?,?)"
        ).bind(id, i, chunkTexts[i]));
      }
      // Audit is committed together with activation after all chunks have been written.
      for (let i = 0; i < statements.length; i += 40) {
        await env.DB.batch(statements.slice(i, i + 40));
      }
      // Activate only after every chunk is safely stored; interrupted uploads never replace the live bank.
      await env.DB.batch([
        env.DB.prepare("UPDATE releases SET is_active=0 WHERE is_active=1"),
        env.DB.prepare("UPDATE releases SET is_active=1,published_at=? WHERE id=?").bind(new Date().toISOString(), id),
        auditStatement(env, "publish_release", version, { sha256, questionCount: bank.questions.length, channel, chunks: chunkTexts.length })
      ]);
      return json({ ok: true, release: { id, version, sha256, byteSize: bytes.byteLength, questionCount: bank.questions.length, channel, publishedAt: now, active: true } }, 201);
    }

    if (request.method === "POST" && path === "/v1/admin/rollback") {
      let body: any;
      try { body = await request.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
      if (!validVersion(body?.version)) return json({ error: "A valid target version is required." }, 400);
      const target = await env.DB.prepare("SELECT * FROM releases WHERE version=?").bind(body.version).first<ReleaseRow>();
      if (!target) return json({ error: "Release not found." }, 404);
      await env.DB.batch([
        env.DB.prepare("UPDATE releases SET is_active=0 WHERE is_active=1"),
        env.DB.prepare("UPDATE releases SET is_active=1,published_at=? WHERE version=?").bind(new Date().toISOString(), body.version),
        auditStatement(env, "rollback_release", body.version)
      ]);
      return json({ ok: true, activeVersion: body.version });
    }

    if (request.method === "PUT" && path === "/v1/admin/features") {
      let body: any;
      try { body = await request.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
      if (!body?.features || typeof body.features !== "object" || Array.isArray(body.features)) return json({ error: "features must be an object." }, 400);
      const allowed = ["remoteQuestionBank", "flashcards", "cloudProgressSync"];
      const features: Record<string, boolean> = {};
      for (const key of allowed) {
        if (key in body.features && typeof body.features[key] !== "boolean") return json({ error: "Feature values must be boolean." }, 400);
        features[key] = typeof body.features[key] === "boolean" ? body.features[key] : false;
      }
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO app_config(config_key,config_value,updated_at) VALUES('features',?,CURRENT_TIMESTAMP) ON CONFLICT(config_key) DO UPDATE SET config_value=excluded.config_value,updated_at=CURRENT_TIMESTAMP"
        ).bind(JSON.stringify(features)),
        auditStatement(env, "update_features", "features", features)
      ]);
      return json({ ok: true, features });
    }

    return json({ error: "Admin endpoint not found." }, 404);
  }

  return json({ error: "Endpoint not found." }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const headers = cors(request, env);
    try {
      const response = url.pathname.startsWith("/v1/")
        ? await handleApi(request, env)
        : new Response(ADMIN_HTML, {
            headers: {
              "content-type": "text/html; charset=utf-8",
              "cache-control": "no-store",
              "x-content-type-options": "nosniff",
              "referrer-policy": "no-referrer"
            }
          });
      return withCors(response, headers);
    } catch (error) {
      console.error("SHBACE Cloud API error", error);
      return withCors(json({ error: "Internal service error." }, 500), headers);
    }
  }
};
