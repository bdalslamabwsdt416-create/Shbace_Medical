'use strict';
const a = require('../../lib/usage-analytics');
module.exports = function adminLogin(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return a.sendJson(res,405,{error:'method_not_allowed'}); }
  if (!a.sameOrigin(req)) return a.sendJson(res,403,{error:'origin_not_allowed'});
  if (!String(req.headers['content-type'] || '').toLowerCase().includes('application/json')) return a.sendJson(res,415,{error:'json_required'});
  if (a.bodyBytes(req.body)>512) return a.sendJson(res,413,{error:'payload_too_large'});
  const expected=a.adminPassword(), secret=a.sessionSecret();
  if (!expected || !secret) return a.sendJson(res,503,{error:'admin_auth_not_configured'});
  if (a.loginBlocked()) return a.sendJson(res,429,{error:'login_temporarily_blocked'});
  const password=req.body && !Array.isArray(req.body) && typeof req.body.password==='string' ? req.body.password : '';
  if (!a.passwordMatches(password,expected)) { a.loginFailed(); return a.sendJson(res,401,{error:'invalid_credentials'}); }
  a.resetLoginFailures();
  try { const session=a.createSession(); a.setCookie(res,session.token); return a.sendJson(res,200,{authenticated:true,expiresAt:new Date(session.expiresAt).toISOString()}); }
  catch (_) { return a.sendJson(res,503,{error:'admin_auth_unavailable'}); }
};
