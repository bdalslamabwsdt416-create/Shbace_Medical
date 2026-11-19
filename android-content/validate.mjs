import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname || path.dirname(new URL(import.meta.url).pathname));
const manifestPath = path.join(root, 'manifest.json');
const catalog = await readJson(path.join(root, 'catalog.json'));
const manifest = await readJson(manifestPath);

function fail(message) {
  console.error('Android content validation failed: ' + message);
  process.exitCode = 1;
  throw new Error(message);
}
async function readJson(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { throw new Error('Cannot read JSON file ' + file + ': ' + error.message); }
}
function assert(condition, message) {
  if (!condition) fail(message);
}
function validId(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,48}$/.test(value); }
function validPath(value) {
  if (typeof value !== 'string' || !value || value.length > 240 ||
      value.startsWith('/') || value.startsWith('\\\\') ||
      value.includes('\\\\') || value.includes('//') ||
      !/^[A-Za-z0-9._/-]+$/.test(value)) return false;
  return value.split('/').every(part => part && part !== '.' && part !== '..');
}
function assetRef(value, listed, label) {
  if (!value) return;
  assert(typeof value === 'string', label + ' must be a string path or symbol.');
  if (/[/.](?:webp|png|jpe?g|svg|gif|pdf|mp4|mp3|m4a|json)$/i.test(value) || value.includes('/')) {
    assert(listed.has(value), label + ' is not listed in manifest: ' + value);
  }
}

assert(manifest && manifest.schema === 'shbace-android-content-v1', 'Unsupported manifest schema.');
assert(typeof manifest.version === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(manifest.version), 'Invalid manifest version.');
assert(catalog && catalog.schema === 'shbace-remote-content-catalog-v1', 'Unsupported catalog schema.');
assert(catalog.version === manifest.version, 'Catalog version must match manifest version.');
assert(Array.isArray(manifest.files) && manifest.files.length <= 500, 'Manifest must contain at most 500 files.');

const listed = new Map();
let totalBytes = 0;
for (const item of manifest.files) {
  assert(item && validPath(item.path), 'Invalid manifest content path.');
  assert(!listed.has(item.path), 'Duplicate manifest path: ' + item.path);
  assert(Number.isInteger(item.bytes) && item.bytes >= 0 && item.bytes <= 80 * 1024 * 1024,
    'Invalid or oversized file length: ' + item.path);
  assert(typeof item.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(item.sha256),
    'Invalid SHA-256 for: ' + item.path);
  const filePath = path.resolve(root, item.path);
  assert(filePath.startsWith(root + path.sep), 'Path escaped the content folder: ' + item.path);
  const bytes = await readFile(filePath).catch(error => fail('Missing file ' + item.path + ': ' + error.message));
  assert(bytes.byteLength === item.bytes, 'Byte count mismatch for: ' + item.path);
  const digest = createHash('sha256').update(bytes).digest('hex');
  assert(digest === item.sha256.toLowerCase(), 'SHA-256 mismatch for: ' + item.path);
  listed.set(item.path, item);
  totalBytes += bytes.byteLength;
  assert(totalBytes <= 512 * 1024 * 1024, 'Content package exceeds 512 MiB.');
}
assert(manifest.catalogPath && listed.has(manifest.catalogPath), 'Catalog path is not listed in manifest.');
const listedPaths = new Set(listed.keys());
assert(Array.isArray(catalog.systems) && catalog.systems.length <= 120, 'Invalid systems list.');
assert(Array.isArray(catalog.banks) && catalog.banks.length <= 40, 'Invalid banks list.');
assert(catalog.resources == null || (Array.isArray(catalog.resources) && catalog.resources.length <= 120),
  'Invalid resources list.');
assert(catalog.flashcardDecks == null || (Array.isArray(catalog.flashcardDecks) && catalog.flashcardDecks.length <= 80),
  'Invalid flashcard decks list.');
assert(catalog.overrideFiles == null || (Array.isArray(catalog.overrideFiles) && catalog.overrideFiles.length <= 80),
  'Invalid content override file list.');

const systems = new Map();
for (const system of catalog.systems) {
  assert(system && validId(system.id) && typeof system.name === 'string' && system.name.trim(),
    'Invalid medical system record.');
  assert(!systems.has(system.id), 'Duplicate system ID: ' + system.id);
  assert(Array.isArray(system.topics), 'System topics must be an array: ' + system.id);
  const topics = new Map();
  for (const topic of system.topics) {
    assert(topic && validId(topic.id) && typeof topic.name === 'string' && topic.name.trim(),
      'Invalid topic in system ' + system.id);
    assert(!topics.has(topic.id), 'Duplicate topic ID in ' + system.id + ': ' + topic.id);
    topics.set(topic.id, topic);
    assetRef(topic.icon, listedPaths, 'Topic icon ' + system.id + '/' + topic.id);
  }
  assetRef(system.icon, listedPaths, 'System icon ' + system.id);
  systems.set(system.id, { ...system, topicMap: topics });
}

const bankIds = new Set();
let totalQuestions = 0;
for (const bank of catalog.banks) {
  assert(bank && validId(bank.id) && typeof bank.label === 'string' && bank.label.trim(),
    'Invalid bank metadata.');
  assert(!bankIds.has(bank.id), 'Duplicate bank ID: ' + bank.id);
  bankIds.add(bank.id);
  assert(validPath(bank.contentFile) && listed.has(bank.contentFile),
    'Bank file not listed in manifest: ' + bank.contentFile);
  assetRef(bank.cover, listedPaths, 'Bank cover ' + bank.id);
  const source = await readJson(path.join(root, bank.contentFile));
  assert(source && ['shbace-remote-questions-v1', 'shbace-remote-mcq-bank-v1'].includes(source.schema),
    'Invalid question file schema: ' + bank.contentFile);
  assert(Array.isArray(source.questions), 'Question file has no questions array: ' + bank.contentFile);
  if (bank.totalQuestions != null) assert(bank.totalQuestions === source.questions.length,
    'Declared question count differs for bank ' + bank.id);
  assert(source.questions.length > 0, 'Question bank is empty: ' + bank.id);
  if (bank.systemIds != null) {
    assert(Array.isArray(bank.systemIds), 'Bank systemIds must be an array: ' + bank.id);
    for (const id of bank.systemIds) assert(systems.has(String(id)), 'Unknown system in bank ' + bank.id + ': ' + id);
  }
  const usedIds = new Set();
  for (const q of source.questions) {
    assert(q && typeof q.id === 'string' && q.id.trim() && q.id.length <= 160,
      'Question has missing or oversized ID in ' + bank.id);
    assert(!usedIds.has(q.id), 'Duplicate question ID in ' + bank.id + ': ' + q.id);
    usedIds.add(q.id);
    assert(systems.has(String(q.systemId || '')), 'Unknown system for question ' + q.id);
    const system = systems.get(String(q.systemId));
    assert(system.topicMap.has(String(q.topicId || '')), 'Unknown topic for question ' + q.id);
    assert(typeof q.stem === 'string' && q.stem.trim(), 'Missing question stem: ' + q.id);
    assert(Array.isArray(q.options) && q.options.length >= 2, 'Invalid options: ' + q.id);
    assert(Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < q.options.length,
      'Invalid answer index: ' + q.id);
    assetRef(q.image, listedPaths, 'Question image ' + q.id);
  }
  totalQuestions += source.questions.length;
}

const resourceIds = new Set();
for (const resource of (catalog.resources || [])) {
  assert(resource && validId(resource.id) && typeof resource.title === 'string' && resource.title.trim(),
    'Invalid learning resource.');
  assert(!resourceIds.has(resource.id), 'Duplicate resource ID: ' + resource.id);
  resourceIds.add(resource.id);
  assert(['pdf', 'audio', 'video', 'file', 'image'].includes(String(resource.type || '').toLowerCase()),
    'Unsupported resource type: ' + resource.id);
  assert(validPath(resource.file) && listed.has(resource.file), 'Resource file not listed in manifest: ' + resource.id);
  assetRef(resource.cover, listedPaths, 'Resource cover ' + resource.id);
}

const deckIds = new Set();
let totalFlashcards = 0;
for (const deck of (catalog.flashcardDecks || [])) {
  assert(deck && validId(deck.id) && typeof deck.title === 'string' && deck.title.trim(),
    'Invalid flashcard deck.');
  assert(!deckIds.has(deck.id), 'Duplicate flashcard deck ID: ' + deck.id);
  deckIds.add(deck.id);
  assert(validPath(deck.contentFile) && listed.has(deck.contentFile),
    'Flashcard file not listed in manifest: ' + deck.contentFile);
  assetRef(deck.cover, listedPaths, 'Flashcard cover ' + deck.id);
  const source = await readJson(path.join(root, deck.contentFile));
  assert(source && source.schema === 'shbace-remote-flashcards-v1' &&
    Array.isArray(source.cards) && source.cards.length > 0 && source.cards.length <= 5000,
    'Invalid flashcard file schema or card list: ' + deck.contentFile);
  const cardIds = new Set();
  for (const card of source.cards) {
    assert(card && typeof card.id === 'string' && card.id.trim(), 'Flashcard has no ID in ' + deck.id);
    assert(!cardIds.has(card.id), 'Duplicate flashcard ID in ' + deck.id + ': ' + card.id);
    cardIds.add(card.id);
    assert(typeof card.front === 'string' && card.front.trim(), 'Flashcard front is empty: ' + card.id);
    assert(typeof card.back === 'string' && card.back.trim(), 'Flashcard back is empty: ' + card.id);
    assetRef(card.frontImage, listedPaths, 'Flashcard front image ' + card.id);
    assetRef(card.backImage, listedPaths, 'Flashcard back image ' + card.id);
  }
  totalFlashcards += source.cards.length;
}
const overridePaths = new Set();
for (const overridePath of (catalog.overrideFiles || [])) {
  assert(validPath(overridePath) && listed.has(overridePath), 'Override file not listed in manifest: ' + overridePath);
  assert(!overridePaths.has(overridePath), 'Duplicate override file path: ' + overridePath);
  overridePaths.add(overridePath);
  const source = await readJson(path.join(root, overridePath));
  assert(source && source.schema === 'shbace-remote-overrides-v1', 'Invalid override file schema: ' + overridePath);
  for (const key of ['systems', 'topics', 'questionPatches', 'collections']) {
    assert(source[key] == null || Array.isArray(source[key]), 'Invalid override array ' + key + ' in ' + overridePath);
  }
  const seenQuestionIds = new Set();
  for (const patch of (source.questionPatches || [])) {
    assert(patch && typeof patch.id === 'string' && patch.id.trim() && patch.id.length <= 160 &&
      patch.fields && typeof patch.fields === 'object' && !Array.isArray(patch.fields),
      'Invalid existing-question patch in ' + overridePath);
    assert(!seenQuestionIds.has(patch.id), 'Duplicate question patch ID: ' + patch.id);
    seenQuestionIds.add(patch.id);
    const fields = patch.fields;
    if (fields.stem != null) assert(typeof fields.stem === 'string' && fields.stem.trim(), 'Empty replacement stem: ' + patch.id);
    if (fields.options != null) assert(Array.isArray(fields.options) && fields.options.length >= 2 &&
      fields.options.every(option => typeof option === 'string'), 'Invalid replacement options: ' + patch.id);
    if (fields.correctIndex != null) assert(Number.isInteger(fields.correctIndex) && fields.correctIndex >= 0 &&
      Array.isArray(fields.options) && fields.correctIndex < fields.options.length, 'Invalid replacement answer index: ' + patch.id);
    if (fields.image != null) assetRef(fields.image, listedPaths, 'Question override image ' + patch.id);
  }
  const seenSystems = new Set();
  for (const system of (source.systems || [])) {
    assert(system && typeof system.id === 'string' && system.id.trim(), 'Invalid system metadata override.');
    assert(!seenSystems.has(system.id), 'Duplicate system metadata override: ' + system.id);
    seenSystems.add(system.id);
    assetRef(system.icon, listedPaths, 'System override icon ' + system.id);
  }
  const seenTopics = new Set();
  for (const topic of (source.topics || [])) {
    assert(topic && typeof topic.systemId === 'string' && topic.systemId.trim() &&
      Number.isInteger(Number(topic.topicId)), 'Invalid topic metadata override.');
    const key = topic.systemId + '|' + topic.topicId;
    assert(!seenTopics.has(key), 'Duplicate topic metadata override: ' + key);
    seenTopics.add(key);
    assetRef(topic.icon, listedPaths, 'Topic override icon ' + key);
  }
  const seenCollections = new Set();
  for (const collection of (source.collections || [])) {
    assert(collection && ['aj', 'previous', 'nelson', 'kasr', 'clinical', 'egyptian'].includes(collection.id),
      'Invalid existing collection metadata override.');
    assert(!seenCollections.has(collection.id), 'Duplicate collection override: ' + collection.id);
    seenCollections.add(collection.id);
    assetRef(collection.cover, listedPaths, 'Collection cover ' + collection.id);
  }
}

console.log('Android remote content validation passed.');
console.log('Manifest version: ' + manifest.version);
console.log('Verified files: ' + listed.size + ' (' + totalBytes + ' bytes)');
console.log('Banks: ' + catalog.banks.length + ' · Questions: ' + totalQuestions);
console.log('Flashcard decks: ' + deckIds.size + ' · Cards: ' + totalFlashcards);
console.log('Offline resources: ' + (catalog.resources || []).length);
