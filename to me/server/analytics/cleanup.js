'use strict';
const a = require('../../lib/usage-analytics');

module.exports = async function analyticsCleanup(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return a.sendJson(res, 405, { error: 'method_not_allowed' });
  }
  if (!a.cronAuthorized(req)) return a.sendJson(res, 401, { error: 'cron_auth_required' });
  try {
    const deleted = await a.cleanupExpiredEvents();
    return a.sendJson(res, 200, { cleaned: true, deleted });
  } catch (error) {
    return a.sendJson(res, 503, {
      error: error && error.message === 'analytics_database_not_configured'
        ? 'analytics_database_not_configured'
        : 'analytics_cleanup_unavailable'
    });
  }
};
