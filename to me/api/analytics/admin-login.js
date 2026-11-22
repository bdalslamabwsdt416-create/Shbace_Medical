'use strict';
const a = require('../../lib/usage-analytics');
module.exports = async function adminLogin(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return a.sendJson(res, 405, { error: 'method_not_allowed' }); }
  if (!a.sameOrigin(req)) return a.sendJson(res, 403, { error: 'origin_not_allowed' });
  if (!String(req.headers['content-type'] || '').toLowerCase().includes('application/json')) return a.sendJson(res, 415, { error: 'json_required' });
  let body;
  try { body = await a.readJsonBody(req, 512); }
  catch (e) {
    if (e.message === 'payload_too_large') return a.sendJson(res, 413, { error: 'payload_too_large' });
    return a.sendJson(res, 400, { error: e.message === 'invalid_content_length' ? 'invalid_content_length' : 'invalid_json' });
  }
  const expected = a.adminPassword(), secret = a.sessionSecret();
  if (!expected || !secret) return a.sendJson(res, 503, { error: 'admin_auth_not_configured' });
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).length !== 1 || typeof body.password !== 'string' ||
      body.password.length > 256) return a.sendJson(res, 400, { error: 'invalid_login_payload' });
  const limit = await a.consumeAdminLoginAttempt(req);
  if (!limit.available) return a.sendJson(res, 503, { error: 'admin_rate_limiter_unavailable' });
  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfterSeconds));
    return a.sendJson(res, 429, { error: 'login_temporarily_blocked', retryAfterSeconds: limit.retryAfterSeconds });
  }
  if (!a.passwordMatches(req.body.password, expected)) return a.sendJson(res, 401, { error: 'invalid_credentials' });
  if (!await a.clearAdminLoginAttempts(req)) return a.sendJson(res, 503, { error: 'admin_rate_limiter_unavailable' });
  try {
    const session = a.createSession();
    a.setCookie(res, session.token);
    return a.sendJson(res, 200, { authenticated: true, expiresAt: new Date(session.expiresAt).toISOString() });
  } catch (_) { return a.sendJson(res, 503, { error: 'admin_auth_unavailable' }); }
};
