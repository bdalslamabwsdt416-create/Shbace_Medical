'use strict';
const { ingest } = require('../../lib/usage-analytics');
module.exports = function androidEvent(req, res) { return ingest(req, res, 'android'); };

// Disable Vercel's automatic body parser so the handler can cap raw bytes before JSON parsing.
module.exports.config = { api: { bodyParser: false } };
