'use strict';
const crypto = require('node:crypto');
const DAY = 86400000;
const MAX_AGE = 30 * DAY;
const SESSION_TTL = 8 * 60 * 60 * 1000;
const COOKIE = 'shbace_analytics_admin';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TABLES = Object.freeze({
  pwa: { installs: 'pwa_analytics_installs', events: 'pwa_analytics_events' },
  android: { installs: 'android_analytics_installs', events: 'android_analytics_events' }
});
let db = null;

function getTables(platform) { return TABLES[platform] || null; }

const RATE_LIMIT_WINDOW_SECONDS = 900;
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const INGESTION_PER_MINUTE_LIMIT = 120;
const INGESTION_PER_DAY_LIMIT = 5000;
const ADMIN_RATE_LIMIT_SCRIPT =
  "local count = redis.call('INCR', KEYS[1]); " +
  "if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; " +
  "return {count, redis.call('TTL', KEYS[1])}";
const INGESTION_RATE_LIMIT_SCRIPT =
  "local now = tonumber(ARGV[1]); local minuteLimit = tonumber(ARGV[2]); local dayLimit = tonumber(ARGV[3]); " +
  "redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - 60000); " +
  "local minuteCount = tonumber(redis.call('ZCARD', KEYS[1])); " +
  "local dayCount = tonumber(redis.call('GET', KEYS[2]) or '0'); " +
  "if minuteCount >= minuteLimit then " +
  " local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES'); " +
  " local retry = 1; if oldest[2] then retry = math.max(1, math.ceil((tonumber(oldest[2]) + 60000 - now) / 1000)); end; " +
  " return {0, minuteCount, dayCount, retry, 1}; end; " +
  "local nextUtcDay = (math.floor(now / 86400000) + 1) * 86400000; " +
  "local dayRetry = math.max(1, math.ceil((nextUtcDay - now) / 1000)); " +
  "if dayCount >= dayLimit then return {0, minuteCount, dayCount, dayRetry, 2}; end; " +
  "local sequence = redis.call('INCR', KEYS[3]); redis.call('EXPIRE', KEYS[3], 120); " +
  "local member = tostring(now) .. ':' .. tostring(sequence); " +
  "redis.call('ZADD', KEYS[1], now, member); redis.call('EXPIRE', KEYS[1], 120); " +
  "local nextDay = redis.call('INCR', KEYS[2]); " +
  "if nextDay == 1 then redis.call('EXPIRE', KEYS[2], 172800); end; " +
  "return {1, minuteCount + 1, nextDay, 0, 0}";

function rateLimitConfig() {
  const endpoint = process.env.UPSTASH_REDIS_REST_URL || '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || '';
  const secret = process.env.ANALYTICS_RATE_LIMIT_SECRET || '';
  if (!endpoint || !token || Buffer.byteLength(secret, 'utf8') < 32) return null;
  try {
    const parsed = new URL(endpoint);
    const localTestEndpoint = process.env.NODE_ENV === 'test' &&
      (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost');
    if ((parsed.protocol !== 'https:' && !(localTestEndpoint && parsed.protocol === 'http:')) ||
        parsed.username || parsed.password) return null;
    return { endpoint: parsed.href.endsWith('/') ? parsed.href.slice(0, -1) : parsed.href, token, secret };
  } catch (_) { return null; }
}
function adminRateLimitKey() {
  const config = rateLimitConfig();
  if (!config) return null;
  const digest = crypto.createHmac('sha256', config.secret).update('admin-login-global-v1').digest('hex');
  return 'shbace:analytics:admin-login:v2:' + digest;
}
function ingestionRateLimitKeys(platform, now) {
  const config = rateLimitConfig();
  if (!config || !TABLES[platform]) return null;
  now = now === undefined ? Date.now() : now;
  const day = new Date(now).toISOString().slice(0, 10);
  const prefix = 'shbace:analytics:ingest:v1:' + platform + ':';
  return {
    minute: prefix + 'sliding-minute',
    day: prefix + 'day:' + day,
    sequence: prefix + 'sequence'
  };
}
async function redisRateLimitCommand(command) {
  const config = rateLimitConfig();
  if (!config || typeof fetch !== 'function') return null;
  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + config.token, 'Content-Type': 'application/json' },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(3000)
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload && !payload.error ? payload.result : null;
  } catch (_) { return null; }
}
async function consumePostgresRateLimit(scope, now, windowSeconds, windowLimit, dailyLimit) {
  let sql;
  try { sql = database(); } catch (_) { return { available: false, allowed: false, retryAfterSeconds: 0, reason: 'database_unavailable' }; }
  if (!sql) return { available: false, allowed: false, retryAfterSeconds: 0, reason: 'database_not_configured' };
  now = now === undefined ? Date.now() : now;
  try {
    const rows = await sql.query(
      'SELECT allowed, window_count, daily_count, retry_after_seconds, reason ' +
      'FROM consume_shbace_analytics_rate_limit($1, $2::timestamptz, $3::integer, $4::integer, $5::integer)',
      [scope, new Date(now).toISOString(), windowSeconds, windowLimit, dailyLimit]
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row || typeof row.allowed !== 'boolean') {
      return { available: false, allowed: false, retryAfterSeconds: 0, reason: 'invalid_response' };
    }
    const windowCount = Number(row.window_count);
    const dailyCount = Number(row.daily_count);
    const retryAfterSeconds = Number(row.retry_after_seconds);
    if (![windowCount, dailyCount, retryAfterSeconds].every(Number.isFinite) || retryAfterSeconds < 0) {
      return { available: false, allowed: false, retryAfterSeconds: 0, reason: 'invalid_response' };
    }
    return {
      available: true,
      allowed: row.allowed,
      minuteCount: windowCount,
      dayCount: dailyCount,
      retryAfterSeconds: row.allowed ? 0 : Math.max(1, retryAfterSeconds),
      reason: row.allowed ? null : (row.reason === 'daily_limit' ? 'daily_limit' : 'minute_limit')
    };
  } catch (_) {
    return { available: false, allowed: false, retryAfterSeconds: 0, reason: 'database_unavailable' };
  }
}

async function consumeAdminLoginAttempt(_req, now) {
  const key = adminRateLimitKey();
  if (!key) return consumePostgresRateLimit('admin-login', now, RATE_LIMIT_WINDOW_SECONDS, RATE_LIMIT_MAX_ATTEMPTS, null);
  const result = await redisRateLimitCommand(['EVAL', ADMIN_RATE_LIMIT_SCRIPT, '1', key, String(RATE_LIMIT_WINDOW_SECONDS)]);
  if (!Array.isArray(result) || result.length < 2) return { available: false, allowed: false, retryAfterSeconds: 0, reason: 'redis_unavailable' };
  const count = Number(result[0]), ttl = Number(result[1]);
  if (!Number.isFinite(count) || !Number.isFinite(ttl) || ttl < 0) return { available: false, allowed: false, retryAfterSeconds: 0, reason: 'invalid_response' };
  return { available: true, allowed: count <= RATE_LIMIT_MAX_ATTEMPTS, retryAfterSeconds: count <= RATE_LIMIT_MAX_ATTEMPTS ? 0 : Math.max(1, ttl), minuteCount: count };
}

async function clearAdminLoginAttempts() {
  const key = adminRateLimitKey();
  if (key) {
    const result = await redisRateLimitCommand(['DEL', key]);
    return result !== null && Number.isFinite(Number(result)) && Number(result) >= 0;
  }
  let sql;
  try { sql = database(); } catch (_) { return false; }
  if (!sql) return false;
  try {
    const rows = await sql.query(
      'SELECT reset_shbace_analytics_rate_limit($1) AS reset',
      ['admin-login']
    );
    return Array.isArray(rows) && rows.length > 0 && rows[0].reset === true;
  } catch (_) { return false; }
}

async function consumeIngestionAttempt(platform, now) {
  now = now === undefined ? Date.now() : now;
  if (!TABLES[platform]) {
    return { available: false, allowed: false, retryAfterSeconds: 0, reason: 'invalid_platform' };
  }
  const keys = ingestionRateLimitKeys(platform, now);
  if (!keys) {
    return consumePostgresRateLimit(
      'ingest:' + platform,
      now,
      60,
      INGESTION_PER_MINUTE_LIMIT,
      INGESTION_PER_DAY_LIMIT
    );
  }
  const result = await redisRateLimitCommand([
    'EVAL', INGESTION_RATE_LIMIT_SCRIPT, '3', keys.minute, keys.day, keys.sequence,
    String(now), String(INGESTION_PER_MINUTE_LIMIT), String(INGESTION_PER_DAY_LIMIT)
  ]);
  if (!Array.isArray(result) || result.length < 5) {
    return { available: false, allowed: false, retryAfterSeconds: 0, reason: 'redis_unavailable' };
  }
  const allowed = Number(result[0]) === 1;
  const minuteCount = Number(result[1]), dayCount = Number(result[2]), ttl = Number(result[3]), window = Number(result[4]);
  if (![minuteCount, dayCount, ttl, window].every(Number.isFinite) || ttl < 0) {
    return { available: false, allowed: false, retryAfterSeconds: 0, reason: 'invalid_response' };
  }
  return {
    available: true, allowed, minuteCount, dayCount,
    retryAfterSeconds: allowed ? 0 : Math.max(1, ttl),
    reason: allowed ? null : (window === 2 ? 'daily_limit' : 'minute_limit')
  };
}


function validateEvent(body, now) {
  now = now === undefined ? Date.now() : now;
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_body');
  const keys = Object.keys(body).sort();
  if (keys.join(',') !== 'eventId,installId,occurredAt') throw new Error('invalid_fields');
  if (typeof body.installId !== 'string' || !UUID.test(body.installId)) throw new Error('invalid_install_id');
  if (typeof body.eventId !== 'string' || !UUID.test(body.eventId)) throw new Error('invalid_event_id');
  if (typeof body.occurredAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(body.occurredAt)) throw new Error('invalid_timestamp');
  const time = Date.parse(body.occurredAt);
  if (!Number.isFinite(time) || new Date(time).toISOString() !== body.occurredAt) throw new Error('invalid_timestamp');
  if (time > now + 300000) throw new Error('timestamp_in_future');
  if (time < now - MAX_AGE) throw new Error('event_too_old');
  return { installId: body.installId.toLowerCase(), eventId: body.eventId.toLowerCase(), occurredAt: new Date(time).toISOString() };
}

function sendJson(res, status, value) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(value));
}
function bodyBytes(body) {
  try { return Buffer.byteLength(typeof body === 'string' ? body : JSON.stringify(body === undefined ? null : body), 'utf8'); }
  catch (_) { return Infinity; }
}

// Read Vercel's raw Node IncomingMessage stream before touching its lazy req.body
// parser. This enforces the small application limit before JSON allocation.
function readRawRequestBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const headers = req && req.headers || {};
    const contentLength = headers['content-length'];
    if (contentLength !== undefined) {
      const value = String(contentLength);
      if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
        req.pause();
        return resolve({ invalidLength: true });
      }
      if (Number(value) > maxBytes) {
        req.pause();
        return resolve({ tooLarge: true });
      }
    }

    const chunks = [];
    let total = 0;
    let settled = false;
    const cleanup = () => {
      req.removeListener('data', onData);
      req.removeListener('end', onEnd);
      req.removeListener('error', onError);
      req.removeListener('aborted', onAborted);
    };
    const finish = (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const onData = (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buffer.length;
      if (total > maxBytes) {
        // Stop consuming immediately. The hosting runtime will close/drain
        // the rejected request; no JSON parser or application handler sees it.
        req.pause();
        finish({ tooLarge: true });
        return;
      }
      chunks.push(buffer);
    };
    const onEnd = () => finish({ raw: Buffer.concat(chunks, total) });
    const onError = (error) => fail(error);
    const onAborted = () => fail(new Error('request_aborted'));

    req.on('data', onData);
    req.once('end', onEnd);
    req.once('error', onError);
    req.once('aborted', onAborted);
  });
}

async function readJsonBody(req, maxBytes) {
  // Vercel's Node request exposes body as a lazy parsed getter. For a real
  // IncomingMessage, consume the raw stream first so the limit precedes JSON
  // parsing. Plain request doubles use the parsed-body fallback in unit tests.
  if (req && typeof req.on === 'function' && typeof req.pause === 'function' &&
      typeof req.removeListener === 'function') {
    const result = await readRawRequestBody(req, maxBytes);
    if (result.invalidLength) throw new Error('invalid_content_length');
    if (result.tooLarge) throw new Error('payload_too_large');
    try { return JSON.parse(result.raw.toString('utf8')); }
    catch (_) { throw new Error('invalid_json'); }
  }

  const body = req ? req.body : undefined;
  if (bodyBytes(body) > maxBytes) throw new Error('payload_too_large');
  return body;
}
function sameOrigin(req) {
  const origin = req.headers && req.headers.origin;
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    const configured = String(process.env.ANALYTICS_ALLOWED_ORIGIN || '')
      .split(',').map(value => value.trim()).filter(Boolean);
    if (configured.includes(parsed.origin)) return true;
    const host = req.headers.host;
    const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
    return !!host && parsed.origin === proto + '://' + host;
  } catch (_) { return false; }
}
function allowedEventOrigin(req) {
  const origin = req.headers && req.headers.origin;
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    if (parsed.origin === 'https://localhost' || parsed.origin === 'capacitor://localhost') return true;
    return sameOrigin(req);
  } catch (_) { return false; }
}

/* Attribute a new PWA installation to the serving hostname only.
   Never persist referrers, query strings, IP addresses or User-Agent values. */
function sourceHost(req) {
  const headers = req && req.headers || {};
  let host = '';
  try {
    if (headers.origin) host = new URL(headers.origin).hostname;
    else if (headers.host) host = new URL('https://' + String(headers.host)).hostname;
  } catch (_) { return null; }
  host = String(host || '').toLowerCase();
  if (host.endsWith('.')) host = host.slice(0, -1);
  if (host === 'localhost') return host;
  if (!host || host.length > 253 || !host.includes('.')) return null;
  const labels = host.split('.');
  if (labels.length === 4 && labels.every(part =>
      part !== '' && Number.isInteger(Number(part)) && Number(part) >= 0 && Number(part) <= 255)) return null;
  if (labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null;
  return host;
}

function cors(req, res) {
  const origin = req.headers && req.headers.origin;
  if (!origin) return true;
  if (!allowedEventOrigin(req)) return false;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '600');
  return true;
}
function database() {
  if (!process.env.DATABASE_URL) return null;
  if (!db) {
    const { neon } = require('@neondatabase/serverless');
    db = neon(process.env.DATABASE_URL);
  }
  return db;
}
function adminPassword() {
  const value = process.env.ANALYTICS_ADMIN_PASSWORD || '';
  return value.length >= 16 ? value : '';
}
function sessionSecret() {
  const value = process.env.ANALYTICS_SESSION_SECRET || '';
  return Buffer.byteLength(value, 'utf8') >= 32 ? value : '';
}
function passwordMatches(candidate, expected) {
  if (typeof candidate !== 'string' || !expected) return false;
  const a = crypto.createHash('sha256').update(candidate).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}
function createSession(now) {
  now = now === undefined ? Date.now() : now;
  const secret = sessionSecret();
  if (!secret) throw new Error('admin_session_secret_not_configured');
  const exp = now + SESSION_TTL;
  const payload = 'v1.' + exp + '.' + crypto.randomBytes(18).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return { token: payload + '.' + sig, expiresAt: exp };
}
function validSession(token, now) {
  now = now === undefined ? Date.now() : now;
  const secret = sessionSecret();
  if (!secret || typeof token !== 'string' || token.length > 512) return false;
  const p = token.split('.');
  if (p.length !== 4 || p[0] !== 'v1') return false;
  const exp = Number(p[1]);
  if (!Number.isSafeInteger(exp) || exp <= now || exp > now + SESSION_TTL + 60000) return false;
  const expected = crypto.createHmac('sha256', secret).update(p.slice(0, 3).join('.')).digest();
  let actual;
  try { actual = Buffer.from(p[3], 'base64url'); } catch (_) { return false; }
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
function readCookie(req) {
  const cookie = String((req.headers && req.headers.cookie) || '');
  for (const entry of cookie.split(';')) {
    const i = entry.indexOf('=');
    if (i >= 0 && entry.slice(0, i).trim() === COOKIE) {
      try { return decodeURIComponent(entry.slice(i + 1).trim()); } catch (_) { return ''; }
    }
  }
  return '';
}
function hasSession(req) { return validSession(readCookie(req)); }
function setCookie(res, token) {
  res.setHeader('Set-Cookie', COOKIE + '=' + encodeURIComponent(token) + '; Path=/api/analytics; Max-Age=' +
    Math.floor(SESSION_TTL / 1000) + '; HttpOnly; Secure; SameSite=Strict');
}
function clearCookie(res) {
  res.setHeader('Set-Cookie', COOKIE + '=; Path=/api/analytics; Max-Age=0; HttpOnly; Secure; SameSite=Strict');
}
function loginBlocked(now) { return (now === undefined ? Date.now() : now) < blockedUntil; }
function loginFailed(now) {
  failures++;
  if (failures >= 5) { blockedUntil = (now === undefined ? Date.now() : now) + 900000; failures = 0; }
}
function resetLoginFailures() { failures = 0; blockedUntil = 0; }

function cronAuthorized(req) {
  const secret = process.env.CRON_SECRET || '';
  if (Buffer.byteLength(secret, 'utf8') < 32) return false;
  return passwordMatches(req && req.headers && req.headers.authorization, 'Bearer ' + secret);
}
async function cleanupExpiredEvents() {
  const sql = database();
  if (!sql) throw new Error('analytics_database_not_configured');
  const rows = await sql.query(
    "WITH pwa_deleted AS (DELETE FROM pwa_analytics_events WHERE occurred_at < NOW() - INTERVAL '12 months' RETURNING 1)," +
    " android_deleted AS (DELETE FROM android_analytics_events WHERE occurred_at < NOW() - INTERVAL '12 months' RETURNING 1)" +
    " SELECT (SELECT COUNT(*)::int FROM pwa_deleted) AS pwa, (SELECT COUNT(*)::int FROM android_deleted) AS android",
    []
  );
  return { pwa: Number(rows[0] && rows[0].pwa || 0), android: Number(rows[0] && rows[0].android || 0) };
}


async function ingest(req, res, platform) {
  const t = getTables(platform);
  if (!t) return sendJson(res, 404, { error: 'not_found' });
  if (!cors(req, res)) return sendJson(res, 403, { error: 'origin_not_allowed' });
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST, OPTIONS'); return sendJson(res, 405, { error: 'method_not_allowed' }); }
  if (!String(req.headers['content-type'] || '').toLowerCase().includes('application/json')) return sendJson(res, 415, { error: 'json_required' });
  let body;
  try { body = await readJsonBody(req, 1024); }
  catch (e) {
    if (e.message === 'payload_too_large') return sendJson(res, 413, { error: 'payload_too_large' });
    return sendJson(res, 400, { error: e.message === 'invalid_content_length' ? 'invalid_content_length' : 'invalid_json' });
  }
  let ev;
  try { ev = validateEvent(body); } catch (e) { return sendJson(res, 422, { error: e.message || 'invalid_event' }); }
  const quota = await consumeIngestionAttempt(platform);
  if (!quota.available) return sendJson(res, 503, { error: 'analytics_rate_limiter_unavailable' });
  if (!quota.allowed) {
    res.setHeader('Retry-After', String(quota.retryAfterSeconds));
    return sendJson(res, 429, { error: 'analytics_rate_limited', retryAfterSeconds: quota.retryAfterSeconds });
  }
  let sql;
  try { sql = database(); } catch (_) { return sendJson(res, 503, { error: 'analytics_database_unavailable' }); }
  if (!sql) return sendJson(res, 503, { error: 'analytics_database_not_configured' });
  try {
    const rows = await sql.query(
      'WITH inserted_event AS (' +
      ' INSERT INTO ' + t.events + ' (event_id, install_id, event_date, occurred_at)' +
      ' VALUES ($2::uuid, $1::uuid, ($3::timestamptz AT TIME ZONE \'UTC\')::date, $3::timestamptz)' +
      ' ON CONFLICT DO NOTHING RETURNING install_id, occurred_at, event_id' +
      '), upsert_install AS (' +
      ' INSERT INTO ' + t.installs + ' (install_id, first_seen_at, last_active_at, source_host)' +
      ' SELECT install_id, occurred_at, occurred_at, $4::text FROM inserted_event' +
      ' ON CONFLICT (install_id) DO UPDATE SET last_active_at = GREATEST(COALESCE(' + t.installs + '.last_active_at, EXCLUDED.last_active_at), EXCLUDED.last_active_at)' +
      ' RETURNING install_id' +
      '), pruned_events AS (' +
      ' DELETE FROM ' + t.events + " WHERE occurred_at < NOW() - INTERVAL \'12 months\' AND EXISTS (SELECT 1 FROM inserted_event) RETURNING event_id" +
      ') SELECT event_id FROM inserted_event',
      [ev.installId, ev.eventId, ev.occurredAt, platform === 'pwa' ? sourceHost(req) : null]
    );
    return sendJson(res, 200, { accepted: Array.isArray(rows) && rows.length > 0 });
  } catch (_) { return sendJson(res, 503, { error: 'analytics_storage_unavailable' }); }
}

async function platformSummary(sql, platform, page, pageSize) {
  const t = TABLES[platform];
  const m = await sql.query(
    'SELECT (SELECT COUNT(*)::int FROM ' + t.installs + ') AS total,' +
    ' (SELECT COUNT(*)::int FROM ' + t.installs + ' WHERE first_seen_at >= NOW() - INTERVAL \'24 hours\') AS new24,' +
    ' (SELECT COUNT(*)::int FROM ' + t.installs + ' WHERE first_seen_at >= NOW() - INTERVAL \'7 days\') AS new7,' +
    ' (SELECT COUNT(*)::int FROM ' + t.installs + ' WHERE first_seen_at >= NOW() - INTERVAL \'30 days\') AS new30,' +
    ' (SELECT COUNT(DISTINCT install_id)::int FROM ' + t.events + ' WHERE occurred_at >= NOW() - INTERVAL \'24 hours\') AS active24,' +
    ' (SELECT COUNT(DISTINCT install_id)::int FROM ' + t.events + ' WHERE occurred_at >= NOW() - INTERVAL \'7 days\') AS active7,' +
    ' (SELECT COUNT(DISTINCT install_id)::int FROM ' + t.events + ' WHERE occurred_at >= NOW() - INTERVAL \'30 days\') AS active30', []);
  const daily = await sql.query(
    'SELECT TO_CHAR(days.day, \'YYYY-MM-DD\') AS day, COUNT(DISTINCT events.install_id)::int AS count' +
    ' FROM GENERATE_SERIES((CURRENT_DATE - INTERVAL \'29 days\')::date, CURRENT_DATE, INTERVAL \'1 day\') days(day)' +
    ' LEFT JOIN ' + t.events + ' events ON events.event_date = days.day::date GROUP BY days.day ORDER BY days.day', []);
  const installs = await sql.query(
    'SELECT install_id::text AS install_id, first_seen_at, last_active_at FROM ' + t.installs +
    ' ORDER BY last_active_at DESC NULLS LAST, first_seen_at DESC LIMIT $1 OFFSET $2', [pageSize, (page - 1) * pageSize]);
  const v = m[0] || {};
  return {
    totalInstallations: Number(v.total || 0),
    newInstallations: { last24Hours: Number(v.new24 || 0), last7Days: Number(v.new7 || 0), last30Days: Number(v.new30 || 0) },
    activeInstallations: { last24Hours: Number(v.active24 || 0), last7Days: Number(v.active7 || 0), last30Days: Number(v.active30 || 0) },
    dailyActivity: (daily || []).map(x => ({ day: x.day, activeInstallations: Number(x.count || 0) })),
    installations: (installs || []).map(x => ({ installId: x.install_id, firstSeenAt: x.first_seen_at, lastActiveAt: x.last_active_at })),
    page, pageSize
  };
}
async function pwaSourceBreakdown(sql) {
  const rows = await sql.query(
    'SELECT COALESCE(source_host, \'unattributed\') AS source_host, COUNT(*)::int AS installations' +
    ' FROM pwa_analytics_installs GROUP BY source_host ORDER BY installations DESC, source_host ASC', []
  );
  return (rows || []).map(row => ({
    sourceHost: row.source_host,
    installations: Number(row.installations || 0)
  }));
}

async function summary(platform, page, size) {
  const sql = database();
  if (!sql) throw new Error('analytics_database_not_configured');
  if (platform === 'pwa') {
    const data = await platformSummary(sql, 'pwa', page, size);
    data.sourceBreakdown = await pwaSourceBreakdown(sql);
    return { platform, page, pageSize: size, platforms: { pwa: data } };
  }
  if (platform === 'android') return { platform, page, pageSize: size, platforms: { android: await platformSummary(sql, 'android', page, size) } };
  const result = await Promise.all([platformSummary(sql, 'pwa', page, size), platformSummary(sql, 'android', page, size)]);
  result[0].sourceBreakdown = await pwaSourceBreakdown(sql);
  return { platform: 'all', page, pageSize: size, platforms: { pwa: result[0], android: result[1] } };
}
module.exports = {
  getTables, validateEvent, sendJson, bodyBytes, readJsonBody, sameOrigin, adminPassword, sessionSecret, passwordMatches,
  createSession, validSession, hasSession, setCookie, clearCookie,
  consumeAdminLoginAttempt, clearAdminLoginAttempts, consumeIngestionAttempt,
  ingestionRateLimitKeys, INGESTION_PER_MINUTE_LIMIT, INGESTION_PER_DAY_LIMIT,
  ingest, summary, sourceHost, cronAuthorized, cleanupExpiredEvents
};
