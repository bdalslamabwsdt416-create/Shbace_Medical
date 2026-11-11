'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');
const manifestPath = path.join(root, 'offline-assets-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const packed = {
  'js/30-ios-v5.js': ['v5-01.b64', 'v5-02.b64', 'v5-03.b64', 'v5-04.b64'],
  'js/31-ios-v6.js': ['v6-01.b64', 'v6-02.b64', 'v6-03.b64'],
  'js/32-ios-v7.js': ['v7-01.b64', 'v7-02.b64']
};

const expected = {
  'js/30-ios-v5.js': { bytes: 31301, sha256: '12f7876ebdcfa8f6dd6b1f1e2b87e82a1d00335d919b24704dac0c238ac56a87' },
  'js/31-ios-v6.js': { bytes: 14188, sha256: '1c0669c83d403b641a9fc300056201df230deca4918a5f1993c819c21ad865f5' },
  'js/32-ios-v7.js': { bytes: 10780, sha256: '18bc123e3728234fa303a2293657e87baa74f37d509fed79d354fb58d9fd10ff' }
};

function safePath(relative) {
  if (typeof relative !== 'string' || relative.startsWith('/') || relative.split(/[\\/]/).includes('..')) {
    throw new Error('Unsafe asset path in offline manifest: ' + relative);
  }
  return path.join(out, relative);
}

function readAsset(relative) {
  if (packed[relative]) {
    const base64 = packed[relative].map(function (name) {
      return fs.readFileSync(path.join(root, 'packed', name), 'utf8').trim();
    }).join('');
    return zlib.gunzipSync(Buffer.from(base64, 'base64'));
  }
  return fs.readFileSync(path.join(root, relative));
}

function verify(relative, bytes, sha256) {
  const record = manifest.files.find(function (item) { return item.path === relative; });
  if (!record) throw new Error('Missing offline manifest record: ' + relative);
  if (expected[relative] && (bytes.length !== expected[relative].bytes || sha256 !== expected[relative].sha256)) {
    throw new Error('Packed iOS bundle failed source integrity check: ' + relative);
  }
  // Rebuild the shipped offline manifest from the exact files being deployed.
  record.bytes = bytes.length;
  record.sha256 = sha256;
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

for (const item of manifest.files) {
  const bytes = readAsset(item.path);
  const digest = crypto.createHash('sha256').update(bytes).digest('hex');
  verify(item.path, bytes, digest);
  if (item.path.endsWith('.js')) new vm.Script(bytes.toString('utf8'), { filename: item.path });
  const destination = safePath(item.path);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, bytes);
}

for (const name of ['index.html', 'manifest.webmanifest', 'pwa-version.json', 'sw.js']) {
  const source = path.join(root, name);
  if (!fs.existsSync(source)) throw new Error('Missing PWA shell file: ' + name);
  fs.copyFileSync(source, path.join(out, name));
}

manifest.totalBytes = manifest.files.reduce(function (sum, item) { return sum + item.bytes; }, 0);
// Keep the offline package version tied to the exact deployed file inventory and hashes.
manifest.version = crypto.createHash('sha256')
  .update(manifest.files.slice().sort(function (a, b) { return a.path.localeCompare(b.path); })
    .map(function (item) { return item.path + ':' + item.sha256; }).join('\n'))
  .digest('hex');
manifest.generatedAt = new Date().toISOString();
fs.writeFileSync(path.join(out, 'offline-assets-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

console.log('Shbace Medical iOS PWA build complete: ' + manifest.files.length + ' verified offline assets.');
