export interface Env {
  DB: D1Database;
  FLAGS: KVNamespace;
  ASSETS: Fetcher;
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
        env.DB.prepare("UPDATE releases SET is_active=0 WHERE is_active=1"),
        env.DB.prepare("INSERT INTO releases(id,version,object_key,sha256,byte_size,question_count,channel,is_active,published_at) VALUES(?,?,?,?,?,?,?,?,?)")
          .bind(id, version, objectKey, sha256, bytes.byteLength, bank.questions.length, channel, 1, now)
      ];
      for (let i = 0; i < chunkTexts.length; i++) {
        statements.push(env.DB.prepare(
          "INSERT INTO release_chunks(release_id,chunk_index,chunk_text) VALUES(?,?,?)"
        ).bind(id, i, chunkTexts[i]));
      }
      statements.push(auditStatement(env, "publish_release", version, { sha256, questionCount: bank.questions.length, channel, chunks: chunkTexts.length }));
      for (let i = 0; i < statements.length; i += 40) {
        await env.DB.batch(statements.slice(i, i + 40));
      }
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
        : await env.ASSETS.fetch(request);
      return withCors(response, headers);
    } catch (error) {
      console.error("SHBACE Cloud API error", error);
      return withCors(json({ error: "Internal service error." }, 500), headers);
    }
  }
};
