/* Android-only offline content adapter for the Heart Auscultation iframe.
 * Large MP3/model files are read in bounded chunks from the installed private pack.
 * The source app and browser/PWA do not use this bridge.
 */
(function () {
  'use strict';
  var native = window.ShbaceNative;
  var CHUNK_BYTES = 256 * 1024;
  var ROOT = '/js/auscultation/heart/';

  function isAbort(signal) {
    return !!(signal && signal.aborted);
  }
  function abortError() {
    try { return new DOMException('The operation was aborted.', 'AbortError'); }
    catch (_) { var e = new Error('The operation was aborted.'); e.name = 'AbortError'; return e; }
  }
  function decodeBase64(value) {
    var binary = atob(value), out = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }
  function relativeAssetPath(url) {
    var parsed, path;
    try {
      parsed = new URL(String(url), document.baseURI);
      path = decodeURIComponent(parsed.pathname || '');
    } catch (_) { return ''; }
    var at = path.indexOf(ROOT);
    if (at >= 0) path = path.slice(at + ROOT.length);
    else if (path.charAt(0) === '/') return '';
    path = path.replace(/^\/+/, '').replace(/\\/g, '/');
    if (path.indexOf('\\') >= 0 || path.indexOf(':') >= 0 ||
        path.indexOf('?') >= 0 || path.indexOf('#') >= 0 || path.indexOf('%') >= 0 ||
        /[\u0000-\u001f]/.test(path)) return '';
    if (path === 'audio-catalog.json') return path;
    var modelPath = path.indexOf('assets/models/') === 0;
    var heartAudioPath = path.indexOf('audio-library/Cardiac Auscultation/') === 0;
    if (!modelPath && !heartAudioPath) return '';
    if (path.split('/').some(function (part) { return !part || part === '.' || part === '..'; })) return '';
    return path;
  }
  async function readInstalledFile(path, signal) {
    if (!native || typeof native.getAuscultationFileSize !== 'function' ||
        typeof native.readAuscultationFileBase64Chunk !== 'function') {
      throw new Error('The Android offline auscultation storage bridge is unavailable.');
    }
    if (isAbort(signal)) throw abortError();
    var size = Number(native.getAuscultationFileSize('heart', path));
    if (!Number.isSafeInteger(size) || size < 0) {
      throw new Error('Heart library file is not installed: ' + path);
    }
    if (size > 24 * 1024 * 1024) throw new Error('Heart library file exceeds the allowed size.');
    var output = new Uint8Array(size), offset = 0;
    while (offset < size) {
      if (isAbort(signal)) throw abortError();
      var wanted = Math.min(CHUNK_BYTES, size - offset);
      var encoded = native.readAuscultationFileBase64Chunk('heart', path, offset, wanted);
      if (typeof encoded !== 'string' || !encoded.length) {
        throw new Error('Could not read installed heart file: ' + path);
      }
      var chunk = decodeBase64(encoded);
      if (!chunk.length || chunk.length > wanted || offset + chunk.length > size) {
        throw new Error('Invalid chunk returned for installed heart file: ' + path);
      }
      output.set(chunk, offset);
      offset += chunk.length;
    }
    return output;
  }
  async function fetchAuscultationAsset(url, options) {
    var path = relativeAssetPath(url);
    if (!path) return fetch(url, options || {});
    var signal = options && options.signal;
    try {
      var data = await readInstalledFile(path, signal);
      var type = /\.json$/i.test(path) ? 'application/json' :
        /\.mp3$/i.test(path) ? 'audio/mpeg' : 'application/octet-stream';
      return new Response(data.buffer, { status: 200, headers: { 'Content-Type': type, 'Content-Length': String(data.byteLength) } });
    } catch (error) {
      if (error && error.name === 'AbortError') throw error;
      return new Response(String(error && error.message || error), {
        status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  }
  window.__shbAuscultationFetch = fetchAuscultationAsset;
  window.__shbAuscultationAssets = Object.freeze({
    system: 'heart',
    chunkBytes: CHUNK_BYTES,
    resolvePath: relativeAssetPath,
    fetch: fetchAuscultationAsset,
    readFile: readInstalledFile
  });
})();