'use strict';
const { ingest } = require('../../lib/usage-analytics');
module.exports = function androidEvent(req, res) { return ingest(req, res, 'android'); };
