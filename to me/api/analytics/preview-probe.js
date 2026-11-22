'use strict';
const crypto = require('node:crypto');
const { neon } = require('@neondatabase/serverless');

function reply(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(payload));
}
function equalSecret(value, expected) {
  if (typeof value !== 'string' || typeof expected !== 'string' || !expected) return false;
  const a = crypto.createHash('sha256').update(value).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}
function eventPayload(installId, eventId) {
  return { eventId, installId, occurredAt: new Date().toISOString() };
}

module.exports = async function previewAnalyticsProbe(req, res) {
  const url = new URL(req.url, 'https://' + (req.headers.host || 'localhost'));
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return reply(res, 405, { error: 'method_not_allowed' });
  }
  if (!equalSecret(url.searchParams.get('token') || '', process.env.ANALYTICS_PREVIEW_PROBE_TOKEN || '')) {
    return reply(res, 404, { error: 'not_found' });
  }

  const host = req.headers.host;
  const base = 'https://' + host;
  const configuredOrigins = String(process.env.ANALYTICS_ALLOWED_ORIGIN || '').split(',').map(x => x.trim()).filter(Boolean);
  const pwaOrigin = configuredOrigins.find(x => x.includes('computer')) || configuredOrigins[0] || '';

  const stages = {};
  const installIds = { pwa: crypto.randomUUID(), android: crypto.randomUUID() };
  let sessionCookie = '';
  let sql;

  async function call(path, method, body, headers, shareToken) {
    const options = { method, headers: headers || {} };
    if (body !== undefined) options.body = body;
    const separator = path.includes('?') ? '&' : '?';
    const target = base + path + (shareToken ? separator + '_vercel_share=' + encodeURIComponent(shareToken) : '');
    const response = await fetch(target, options);
    const raw = await response.text();
    let payload;
    try { payload = JSON.parse(raw); } catch (_) { payload = { raw: raw.slice(0, 180) }; }
    return { status: response.status, payload, headers: response.headers };
  }
  function check(condition, stage, info) {
    if (!condition) { const error = new Error(stage); error.info = info || null; throw error; }
  }

  try {
    check(process.env.DATABASE_URL && process.env.ANALYTICS_ADMIN_PASSWORD &&
      process.env.ANALYTICS_SESSION_SECRET && process.env.CRON_SECRET, 'preview_secrets_missing');
    check(pwaOrigin.startsWith('https://'), 'preview_origin_missing');

    const pwaEvent = eventPayload(installIds.pwa, crypto.randomUUID());
    const pwa = await call('/api/analytics/pwa-event', 'POST', JSON.stringify(pwaEvent), {
      'Content-Type': 'application/json', Origin: pwaOrigin
    }, process.env.ANALYTICS_TEST_SHARE_PWA);
    check(pwa.status === 200 && pwa.payload.accepted === true, 'pwa_post_failed', { status: pwa.status, payload: pwa.payload, allowOrigin: pwa.headers.get('access-control-allow-origin'), pwaOrigin });
    check(pwa.headers.get('access-control-allow-origin') === pwaOrigin, 'pwa_cors_failed');
    stages.pwaPost = 'passed';

    const replay = await call('/api/analytics/pwa-event', 'POST', JSON.stringify(pwaEvent), {
      'Content-Type': 'application/json', Origin: pwaOrigin
    }, process.env.ANALYTICS_TEST_SHARE_PWA);
    check(replay.status === 200 && replay.payload.accepted === false, 'pwa_idempotency_failed');
    stages.pwaReplay = 'passed';

    const sameDay = await call('/api/analytics/pwa-event', 'POST',
      JSON.stringify(eventPayload(installIds.pwa, crypto.randomUUID())), {
        'Content-Type': 'application/json', Origin: pwaOrigin
      }, process.env.ANALYTICS_TEST_SHARE_PWA);
    check(sameDay.status === 200 && sameDay.payload.accepted === false, 'pwa_daily_uniqueness_failed');
    stages.pwaDailyUniqueness = 'passed';

    const android = await call('/api/analytics/android-event', 'POST',
      JSON.stringify(eventPayload(installIds.android, crypto.randomUUID())), {
        'Content-Type': 'application/json', Origin: 'capacitor://localhost'
      }, process.env.ANALYTICS_TEST_SHARE_ANDROID);
    check(android.status === 200 && android.payload.accepted === true, 'android_post_failed');
    stages.androidPost = 'passed';

    const oversized = await call('/api/analytics/pwa-event', 'POST', 'x'.repeat(1025), {
      'Content-Type': 'application/json', Origin: pwaOrigin
    }, process.env.ANALYTICS_TEST_SHARE_PWA);
    check(oversized.status === 413, 'raw_body_limit_failed');
    stages.rawBodyLimit = 'passed';

    const login = await call('/api/analytics/admin-login', 'POST',
      JSON.stringify({ password: process.env.ANALYTICS_ADMIN_PASSWORD }), {
        'Content-Type': 'application/json', Origin: pwaOrigin
      });
    check(login.status === 200 && login.payload.authenticated === true, 'admin_login_failed');
    const setCookie = login.headers.get('set-cookie') || '';
    sessionCookie = setCookie.split(';')[0];
    check(sessionCookie.includes('='), 'admin_cookie_missing');
    check(/HttpOnly/i.test(setCookie) && /Secure/i.test(setCookie) && /SameSite=Strict/i.test(setCookie),
      'admin_cookie_attributes_failed');
    stages.adminLogin = 'passed';

    const summary = await call('/api/analytics/admin-summary?platform=all&page=1', 'GET', undefined, {
      Cookie: sessionCookie
    }, process.env.ANALYTICS_TEST_SHARE_SUMMARY);
    check(summary.status === 200 && summary.payload.platforms &&
      summary.payload.platforms.pwa && summary.payload.platforms.android, 'admin_summary_failed');
    check(summary.payload.platforms.pwa.totalInstallations >= 1 &&
      summary.payload.platforms.android.totalInstallations >= 1, 'admin_counts_failed');
    stages.adminSummary = 'passed';

    const logout = await call('/api/analytics/admin-logout', 'POST', undefined, {
      Origin: pwaOrigin, Cookie: sessionCookie
    }, process.env.ANALYTICS_TEST_SHARE_LOGOUT);
    check(logout.status === 200 && logout.payload.authenticated === false, 'admin_logout_failed');
    stages.adminLogout = 'passed';
    sessionCookie = '';

    const cleanup = await call('/api/analytics/cleanup', 'GET', undefined, {
      Authorization: 'Bearer ' + process.env.CRON_SECRET
    }, process.env.ANALYTICS_TEST_SHARE_CLEANUP);
    check(cleanup.status === 200 && cleanup.payload.cleaned === true, 'cron_cleanup_failed');
    stages.cronCleanup = 'passed';

    sql = neon(process.env.DATABASE_URL);
    await sql.query('DELETE FROM pwa_analytics_events WHERE install_id = $1::uuid', [installIds.pwa]);
    await sql.query('DELETE FROM pwa_analytics_installs WHERE install_id = $1::uuid', [installIds.pwa]);
    await sql.query('DELETE FROM android_analytics_events WHERE install_id = $1::uuid', [installIds.android]);
    await sql.query('DELETE FROM android_analytics_installs WHERE install_id = $1::uuid', [installIds.android]);
    const leftovers = await sql.query(
      'SELECT (SELECT COUNT(*)::int FROM pwa_analytics_installs WHERE install_id = $1::uuid) AS pwa, ' +
      '(SELECT COUNT(*)::int FROM android_analytics_installs WHERE install_id = $2::uuid) AS android',
      [installIds.pwa, installIds.android]
    );
    check(Number(leftovers[0].pwa) === 0 && Number(leftovers[0].android) === 0, 'probe_cleanup_failed');
    stages.testRecordsRemoved = 'passed';
    return reply(res, 200, { ok: true, stages });
  } catch (error) {
    try {
      if (!sql && process.env.DATABASE_URL) sql = neon(process.env.DATABASE_URL);
      if (sql) {
        await sql.query('DELETE FROM pwa_analytics_events WHERE install_id = $1::uuid', [installIds.pwa]);
        await sql.query('DELETE FROM pwa_analytics_installs WHERE install_id = $1::uuid', [installIds.pwa]);
        await sql.query('DELETE FROM android_analytics_events WHERE install_id = $1::uuid', [installIds.android]);
        await sql.query('DELETE FROM android_analytics_installs WHERE install_id = $1::uuid', [installIds.android]);
      }
    } catch (_) {}
    if (sessionCookie) {
      try {
        await call('/api/analytics/admin-logout', 'POST', undefined, { Origin: pwaOrigin, Cookie: sessionCookie }, process.env.ANALYTICS_TEST_SHARE_LOGOUT);
      } catch (_) {}
    }
    return reply(res, 502, { ok: false, failedStage: error.message || 'preview_probe_failed', diagnostic: error.info || null, stages });
  }
};
