'use strict';
const { ingest } = require('../../lib/usage-analytics');
module.exports = function pwaEvent(req, res) { return ingest(req, res, 'pwa'); };
