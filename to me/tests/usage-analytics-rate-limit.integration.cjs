'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { execFileSync } = require('node:child_process');

const previousEnv = {
  NODE_ENV: process.env.NODE_ENV,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  ANALYTICS_RATE_LIMIT_SECRET: process.env.ANALYTICS_RATE_LIMIT_SECRET
};
let server;
let baseUrl;

function redisCommand(command) {
  const args = ['--raw', '-h', '127.0.0.1', '-p', String(process.env.REDIS_PORT || '6379'), ...command.map(String)];
  const output = execFileSync('redis-cli', args, { encoding: 'utf8' }).trim();
  if (!output) return null;
  if (command[0] === 'EVAL') return output.split(/\r?\n/).map(Number);
  return Number(output);
}

test.before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'local-ci-redis-token';
  process.env.ANALYTICS_RATE_LIMIT_SECRET = 'local-ci-rate-limit-secret-at-least-32-bytes';
  redisCommand(['FLUSHDB']);
  server = http.createServer((req, res) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      if (req.headers.authorization !== 'Bearer local-ci-redis-token') {
        res.writeHead(401, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ error: 'unauthorized' }));
      }
      try {
        const command = JSON.parse(raw);
        const result = redisCommand(command);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ result }));
      } catch (error) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: String(error) }));
      }
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = 'http://127.0.0.1:' + server.address().port;
  process.env.UPSTASH_REDIS_REST_URL = baseUrl;
});

test.after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function freshAnalytics() {
  const path = require.resolve('../lib/usage-analytics');
  delete require.cache[path];
  return require('../lib/usage-analytics');
}

test('Redis Lua ingestion quota is atomic and shared across fresh serverless module instances', async () => {
  const analytics = freshAnalytics();
  const minute = Math.floor(Date.now() / 60000);
  const results = [];
  for (let i = 0; i < analytics.INGESTION_PER_MINUTE_LIMIT; i++) {
    const isolated = freshAnalytics();
    results.push(await isolated.consumeIngestionAttempt('pwa', minute * 60000 + 1000));
  }
  assert.ok(results.every(result => result.available && result.allowed));
  const blocked = await freshAnalytics().consumeIngestionAttempt('pwa', minute * 60000 + 1000);
  assert.equal(blocked.available, true);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, 'minute_limit');
  assert.ok(blocked.retryAfterSeconds > 0);

  const otherPlatform = await analytics.consumeIngestionAttempt('android', minute * 60000 + 1000);
  assert.equal(otherPlatform.available, true);
  assert.equal(otherPlatform.allowed, true);
});

test('Admin login quota is global, distributed, and independent of client IP headers', async () => {
  redisCommand(['FLUSHDB']);
  for (let i = 0; i < 5; i++) {
    const result = await freshAnalytics().consumeAdminLoginAttempt({
      headers: { 'x-real-ip': '198.51.100.' + (i + 1) }
    });
    assert.equal(result.available, true);
    assert.equal(result.allowed, true);
  }
  const blocked = await freshAnalytics().consumeAdminLoginAttempt({
    headers: { 'x-real-ip': '203.0.113.99' }
  });
  assert.equal(blocked.available, true);
  assert.equal(blocked.allowed, false);
  assert.equal(await freshAnalytics().clearAdminLoginAttempts(), true);
  const afterReset = await freshAnalytics().consumeAdminLoginAttempt({ headers: {} });
  assert.equal(afterReset.allowed, true);
});

test('PWA and Android event endpoints fail closed without Redis and return 429 at the shared quota', async () => {
  const analytics = freshAnalytics();
  const oldFetch = global.fetch;
  const oldUrl = process.env.UPSTASH_REDIS_REST_URL;
  const oldDb = process.env.DATABASE_URL;
  const response = () => ({ statusCode: 0, headers: {}, body: '', setHeader(k, v) { this.headers[k] = v; }, end(v) { this.body = v || ''; } });
  try {
    delete process.env.UPSTASH_REDIS_REST_URL;
    const unavailable = response();
    await require('../api/analytics/pwa-event')({
      method: 'POST',
      headers: { origin: 'https://localhost', host: 'localhost', 'content-type': 'application/json' },
      body: { eventId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', installId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', occurredAt: new Date().toISOString() }
    }, unavailable);
    assert.equal(unavailable.statusCode, 503);
    assert.equal(JSON.parse(unavailable.body).error, 'analytics_rate_limiter_unavailable');

    process.env.UPSTASH_REDIS_REST_URL = oldUrl || baseUrl;
    process.env.DATABASE_URL = '';
    const minute = Math.floor(Date.now() / 60000);
    const realNow = Date.now;
    Date.now = () => minute * 60000 + 1000;
    for (let i = 0; i < analytics.INGESTION_PER_MINUTE_LIMIT; i++) {
      const allowed = await freshAnalytics().consumeIngestionAttempt('pwa', minute * 60000 + 1000);
      assert.equal(allowed.allowed, true);
    }
    const limited = response();
    await require('../api/analytics/pwa-event')({
      method: 'POST',
      headers: { origin: 'https://localhost', host: 'localhost', 'content-type': 'application/json' },
      body: { eventId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', installId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', occurredAt: new Date().toISOString() }
    }, limited);
    assert.equal(limited.statusCode, 429);
    assert.equal(limited.headers['Retry-After'] > 0, true);
    Date.now = realNow;
  } finally {
    if (typeof realNow === 'function') Date.now = realNow;
    global.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = oldUrl;
    if (oldDb === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = oldDb;
  }
});
