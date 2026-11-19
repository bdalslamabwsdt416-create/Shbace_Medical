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
assert(Number.isInteger(manifest.contentVersionCode) && manifest.contentVersionCode >= 1 &&
  manifest.contentVersionCode <= 2147483647, 'contentVersionCode must be a positive 32-bit integer.');
assert(Number.isInteger(manifest.minAppVersionCode) && manifest.minAppVersionCode >= 1 &&
  manifest.minAppVersionCode <= 2147483647, 'minAppVersionCode must be a positive 32-bit integer.');
assert(['stable', 'beta', 'internal'].includes(manifest.channel), 'Unsupported content channel.');
if (manifest.releaseNotes != null) assert(typeof manifest.releaseNotes === 'string' &&
  manifest.releaseNotes.length <= 500, 'releaseNotes must be text up to 500 characters.');
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


const ui = catalog.ui;
if (ui != null) {
  assert(ui && typeof ui === 'object' && !Array.isArray(ui), 'catalog.ui must be an object.');
  const pageIds = new Set();
  const builtinPageIds = new Set(['subjects', 'grade', 'specialties', 'topics', 'questions', 'quiz',
    'quizrun', 'quizresult', 'quizhistory', 'review', 'stats', 'search', 'settings', 'about',
    'dedication', 'changelog', 'feedback', 'rate', 'pinned', 'saved', 'wrong', 'reported',
    'notifs', 'timer', 'weak', 'menu']);
  const builtinBanks = new Set(['all', 'aj', 'previous', 'nelson', 'kasr', 'clinical', 'egyptian']);
  assert(ui.pages == null || Array.isArray(ui.pages), 'catalog.ui.pages must be an array.');
  assert(ui.templates == null || Array.isArray(ui.templates), 'catalog.ui.templates must be an array.');
  const pages = Array.isArray(ui.pages) ? ui.pages : [];
  const templates = Array.isArray(ui.templates) ? ui.templates : [];
  assert(pages.length <= 40, 'Remote UI may define at most 40 pages.');
  assert(templates.length <= 20, 'Remote UI may define at most 20 reusable templates.');
  const knownResources = new Set(resourceIds);
  const knownBanks = new Set(bankIds);
  const knownDecks = new Set(deckIds);
  const remoteUiBuiltinPageIds = new Set(['subjects', 'specialties', 'topics', 'questions',
    'quiz', 'quizrun', 'quizresult', 'quizhistory', 'review', 'stats', 'search', 'settings',
    'about', 'changelog', 'feedback', 'rate', 'pinned', 'saved', 'wrong', 'reported',
    'notifs', 'timer']);

  function validateUiBlocks(blocks, label, options = {}) {
    const depth = Number.isInteger(options.depth) ? options.depth : 0;
    const budget = options.budget || { count:0 };
    const allowSlots = options.allowSlots === true;
    assert(depth <= 4, label + ' exceeds the maximum nested layout depth of four.');
    assert(Array.isArray(blocks) && blocks.length <= 60, label + ' must contain at most 60 blocks.');

    function validateBlock(block, pathLabel, currentDepth) {
      assert(currentDepth <= 4, pathLabel + ' exceeds the maximum nested layout depth of four.');
      assert(block && typeof block === 'object' && !Array.isArray(block), 'Invalid UI block in ' + pathLabel);
      assert(++budget.count <= 120, label + ' exceeds the maximum total component count of 120.');
      const type = String(block.type || '');
      const nested = (children, childLabel) => validateUiBlocks(children, childLabel, {
        depth: currentDepth + 1, budget, allowSlots
      });
      if (['stack', 'grid', 'section'].includes(type)) {
        const children = type === 'section' ? block.blocks :
          (Array.isArray(block.children) ? block.children : block.blocks);
        assert(Array.isArray(children) && children.length <= 30,
          'UI ' + type + ' needs at most 30 child blocks in ' + pathLabel);
        if (type === 'grid') assert(Number.isInteger(block.columns) && block.columns >= 1 && block.columns <= 3,
          'UI grid columns must be from 1 to 3 in ' + pathLabel);
        if (type === 'section') {
          assert(['stack', 'row', 'grid'].includes(String(block.layout || 'stack')),
            'Invalid UI section layout in ' + pathLabel);
          if (block.layout === 'grid' && block.columns != null) assert(
            Number.isInteger(block.columns) && block.columns >= 1 && block.columns <= 3,
            'UI section grid columns must be from 1 to 3 in ' + pathLabel);
        }
        if (block.gap != null) assert(Number.isInteger(block.gap) && block.gap >= 0 && block.gap <= 32,
          'UI layout gap must be from 0 to 32 in ' + pathLabel);
        children.forEach((child, index) => validateBlock(child, pathLabel + '.children[' + index + ']', currentDepth + 1));
        return;
      }
      if (type === 'tabs') {
        const tabs = Array.isArray(block.tabs) ? block.tabs : block.items;
        assert(Array.isArray(tabs) && tabs.length >= 2 && tabs.length <= 6,
          'UI tabs must contain 2 to 6 tabs in ' + pathLabel);
        const ids = new Set();
        for (const [index, tab] of tabs.entries()) {
          const tabLabel = tab && (typeof tab.label === 'string' ? tab.label : tab.title);
          assert(tab && validId(tab.id) && !ids.has(tab.id) &&
            typeof tabLabel === 'string' && tabLabel.trim() && tabLabel.length <= 48 &&
            Array.isArray(tab.blocks) && tab.blocks.length <= 30,
            'Invalid or duplicate tab in ' + pathLabel);
          ids.add(tab.id);
          tab.blocks.forEach((child, childIndex) =>
            validateBlock(child, pathLabel + '.tabs[' + index + '].blocks[' + childIndex + ']', currentDepth + 1));
        }
        if (block.defaultTab != null) assert(ids.has(String(block.defaultTab)),
          'UI tabs defaultTab must reference an existing tab in ' + pathLabel);
        return;
      }
      if (type === 'accordion') {
        assert(Array.isArray(block.items) && block.items.length >= 1 && block.items.length <= 12,
          'UI accordion must contain 1 to 12 items in ' + pathLabel);
        const ids = new Set();
        for (const [index, item] of block.items.entries()) {
          const title = item && (typeof item.title === 'string' ? item.title : item.label);
          assert(item && typeof title === 'string' && title.trim() && title.length <= 80 &&
            Array.isArray(item.blocks) && item.blocks.length <= 30,
            'Invalid accordion item in ' + pathLabel);
          if (item.id != null) {
            assert(validId(item.id) && !ids.has(item.id), 'Invalid or duplicate accordion item ID in ' + pathLabel);
            ids.add(item.id);
          }
          if (item.open != null) assert(typeof item.open === 'boolean', 'Accordion open must be boolean in ' + pathLabel);
          item.blocks.forEach((child, childIndex) =>
            validateBlock(child, pathLabel + '.items[' + index + '].blocks[' + childIndex + ']', currentDepth + 1));
        }
        return;
      }
      if (type === 'when') {
        assert(['always', 'hasBanks', 'hasResources', 'hasFlashcardDecks', 'hasLearningContent']
          .includes(String(block.condition || '')), 'Unsupported safe condition in ' + pathLabel);
        if (block.not != null) assert(typeof block.not === 'boolean', 'UI condition not must be boolean in ' + pathLabel);
        nested(block.blocks, pathLabel + '.when.blocks');
        return;
      }
      if (type === 'slot') {
        assert(allowSlots && /^[a-z][a-z0-9_-]{0,31}$/.test(String(block.name || '')),
          'UI slot is permitted only in a reusable template and must have a valid name in ' + pathLabel);
        return;
      }
      assert(['heading', 'text', 'notice', 'divider', 'image', 'resourceList',
        'bankList', 'flashcardDeckList', 'link', 'button', 'card', 'list', 'metric', 'spacer'].includes(type),
        'Unsupported UI block type in ' + pathLabel + ': ' + type);
      if (type === 'heading' || type === 'text' || type === 'notice') {
        assert(typeof block.text === 'string' && block.text.length <= 3000,
          'UI ' + type + ' block text must be up to 3000 characters in ' + pathLabel);
      }
      if (type === 'notice') {
        assert(['info', 'success', 'warning', 'neutral'].includes(String(block.tone || 'info')),
          'Unsupported UI notice tone in ' + pathLabel);
        if (block.title != null) assert(typeof block.title === 'string' && block.title.length <= 160,
          'UI notice title must be up to 160 characters in ' + pathLabel);
      }
      if (type === 'image') {
        assert(typeof block.file === 'string', 'UI image block needs a file path in ' + pathLabel);
        assetRef(block.file, listedPaths, 'Remote UI image ' + pathLabel);
        if (block.alt != null) assert(typeof block.alt === 'string' && block.alt.length <= 240,
          'UI image alt must be up to 240 characters in ' + pathLabel);
      }
      if (type === 'card') {
        assert((block.title == null || (typeof block.title === 'string' && block.title.length <= 160)) &&
          (block.text == null || (typeof block.text === 'string' && block.text.length <= 3000)),
          'Invalid UI card block in ' + pathLabel);
        if (block.blocks != null) nested(block.blocks, pathLabel + '.card.blocks');
      }
      if (type === 'list') {
        assert(Array.isArray(block.items) && block.items.length <= 30 &&
          block.items.every(item => typeof item === 'string' && item.length <= 300),
          'Invalid UI list block in ' + pathLabel);
      }
      if (type === 'metric') {
        assert((typeof block.label === 'string' || typeof block.label === 'number') &&
          (typeof block.value === 'string' || typeof block.value === 'number'), 'Invalid UI metric block in ' + pathLabel);
      }
      if (type === 'spacer') assert(Number.isInteger(block.size) && block.size >= 4 && block.size <= 64,
        'Invalid UI spacer size in ' + pathLabel);
      if (type === 'link') assert(typeof block.label === 'string' && block.label.trim() &&
        block.label.length <= 120 && typeof block.url === 'string' && /^https:\/\//i.test(block.url),
        'UI link must have a label and HTTPS URL in ' + pathLabel);
      if (type === 'resourceList' || type === 'bankList' || type === 'flashcardDeckList') {
        assert(Array.isArray(block.ids) && block.ids.length <= 120,
          'UI list block needs an ID array in ' + pathLabel);
        const allowed = type === 'resourceList' ? knownResources :
          (type === 'bankList' ? knownBanks : knownDecks);
        for (const id of block.ids) assert(allowed.has(String(id)),
          'Unknown item "' + id + '" in ' + type + ' block in ' + pathLabel);
      }
      if (type === 'button') {
        assert(typeof block.label === 'string' && block.label.trim() &&
          block.label.length <= 120 && validId(block.target), 'Invalid UI button in ' + pathLabel);
        const action = String(block.action || '');
        const allowed = action === 'page' ? pageIds :
          (action === 'builtin' ? remoteUiBuiltinPageIds :
          (action === 'resource' ? knownResources :
          (action === 'bank' ? knownBanks : (action === 'deck' ? knownDecks : null))));
        assert(allowed && allowed.has(String(block.target)),
          'UI button has an unknown action or target in ' + pathLabel);
      }
    }

    blocks.forEach((block, index) => validateBlock(block, label + '[' + index + ']', depth));
    return budget;
  }

  for (const page of pages) {
    assert(page && validId(page.id) && typeof page.title === 'string' && page.title.trim() &&
      page.title.length <= 120, 'Invalid remote UI page.');
    assert(!pageIds.has(page.id), 'Duplicate remote UI page ID: ' + page.id);
    pageIds.add(page.id);
    if (page.subtitle != null) assert(typeof page.subtitle === 'string' && page.subtitle.length <= 160,
      'Remote page subtitle must be text up to 160 characters.');
  }

  function collectTemplateSlots(blocks, found, depth = 0) {
    assert(depth <= 4, 'Template slot collection exceeds maximum depth.');
    for (const block of blocks) {
      if (block.type === 'slot') found.add(String(block.name));
      if (Array.isArray(block.blocks)) collectTemplateSlots(block.blocks, found, depth + 1);
      if (Array.isArray(block.children)) collectTemplateSlots(block.children, found, depth + 1);
      const tabItems = Array.isArray(block.tabs) ? block.tabs :
        (block.type === 'tabs' && Array.isArray(block.items) ? block.items : []);
      for (const item of tabItems) if (item && Array.isArray(item.blocks))
        collectTemplateSlots(item.blocks, found, depth + 1);
      if (block.type === 'accordion' && Array.isArray(block.items)) {
        for (const item of block.items) if (item && Array.isArray(item.blocks))
          collectTemplateSlots(item.blocks, found, depth + 1);
      }
    }
  }

  const templateById = new Map();
  for (const template of templates) {
    assert(template && validId(template.id) && !templateById.has(template.id) &&
      Array.isArray(template.blocks), 'Invalid or duplicate remote UI template.');
    validateUiBlocks(template.blocks, 'template ' + template.id, { allowSlots:true });
    const slots = new Set();
    collectTemplateSlots(template.blocks, slots);
    templateById.set(template.id, { source:template, slots });
  }

  function countExpandedBlocks(blocks, slots, depth, count) {
    assert(depth <= 4, 'Expanded remote page exceeds maximum nesting depth.');
    for (const block of blocks) {
      assert(++count.value <= 120, 'Expanded remote page exceeds 120 components.');
      if (block.type === 'slot') {
        const content = slots && Array.isArray(slots[block.name]) ? slots[block.name] : [];
        countExpandedBlocks(content, null, depth + 1, count);
        continue;
      }
      const nestedGroups = [];
      if (Array.isArray(block.blocks)) nestedGroups.push(block.blocks);
      if (Array.isArray(block.children)) nestedGroups.push(block.children);
      const tabItems = Array.isArray(block.tabs) ? block.tabs :
        (block.type === 'tabs' && Array.isArray(block.items) ? block.items : []);
      for (const item of tabItems) if (item && Array.isArray(item.blocks)) nestedGroups.push(item.blocks);
      if (block.type === 'accordion' && Array.isArray(block.items))
        for (const item of block.items) if (item && Array.isArray(item.blocks)) nestedGroups.push(item.blocks);
      for (const nested of nestedGroups) countExpandedBlocks(nested, slots, depth + 1, count);
    }
  }

  for (const page of pages) {
    if (page.templateId == null) {
      validateUiBlocks(page.blocks, 'page ' + page.id);
      continue;
    }
    const template = templateById.get(String(page.templateId));
    assert(template, 'Page references an unknown reusable template: ' + page.templateId);
    assert(page.slots && typeof page.slots === 'object' && !Array.isArray(page.slots),
      'Template page slots must be an object: ' + page.id);
    const slotNames = Object.keys(page.slots);
    const slotBudget = { count:0 };
    for (const name of slotNames) {
      assert(template.slots.has(name), 'Page provides an unknown template slot: ' + name);
      validateUiBlocks(page.slots[name], 'page ' + page.id + ' slot ' + name, { budget:slotBudget });
    }
    countExpandedBlocks(template.source.blocks, page.slots, 0, { value:0 });
  }
  if (ui.homeBlocks != null) validateUiBlocks(ui.homeBlocks, 'homeBlocks');

  if (ui.workflows != null) {
    assert(Array.isArray(ui.workflows) && ui.workflows.length <= 30,
      'catalog.ui.workflows must contain at most 30 rules.');
    const workflowIds = new Set();
    const workflowTriggers = {
      'navigation:route-changed': new Set(['from', 'to', 'mode']),
      'navigation:rendered': new Set(['route', 'mode'])
    };
    for (const rule of ui.workflows) {
      assert(rule && validId(rule.id) && !workflowIds.has(rule.id),
        'Invalid or duplicate workflow rule ID.');
      workflowIds.add(rule.id);
      assert(Object.prototype.hasOwnProperty.call(workflowTriggers, String(rule.trigger || '')),
        'Unsupported workflow trigger in rule ' + rule.id);
      if (rule.enabled != null) assert(typeof rule.enabled === 'boolean',
        'Workflow enabled flag must be boolean in rule ' + rule.id);
      if (rule.priority != null) assert(Number.isInteger(rule.priority) && rule.priority >= -100 && rule.priority <= 100,
        'Workflow priority must be an integer from -100 to 100 in rule ' + rule.id);
      if (rule.cooldownMs != null) assert(Number.isInteger(rule.cooldownMs) &&
        rule.cooldownMs >= 0 && rule.cooldownMs <= 60000,
        'Workflow cooldown must be from 0 to 60000 ms in rule ' + rule.id);
      const conditions = rule.conditions == null ? [] : rule.conditions;
      assert(Array.isArray(conditions) && conditions.length <= 5,
        'Workflow rules may contain at most five conditions in rule ' + rule.id);
      for (const condition of conditions) {
        assert(condition && workflowTriggers[rule.trigger].has(String(condition.field || '')),
          'Unsupported workflow condition field in rule ' + rule.id);
        assert(['equals', 'notEquals', 'oneOf'].includes(String(condition.op || '')),
          'Unsupported workflow condition operator in rule ' + rule.id);
        if (condition.op === 'oneOf') {
          assert(Array.isArray(condition.value) && condition.value.length >= 1 && condition.value.length <= 8 &&
            condition.value.every(value => typeof value === 'string' && value.length <= 120),
            'Workflow oneOf values must contain 1 to 8 short strings in rule ' + rule.id);
        } else {
          assert(typeof condition.value === 'string' && condition.value.length <= 120,
            'Workflow condition value must be a string up to 120 characters in rule ' + rule.id);
        }
      }
      assert(Array.isArray(rule.actions) && rule.actions.length >= 1 && rule.actions.length <= 3,
        'Workflow rule must contain 1 to 3 actions in rule ' + rule.id);
      for (const action of rule.actions) {
        assert(action && typeof action === 'object' && !Array.isArray(action),
          'Invalid workflow action in rule ' + rule.id);
        const type = String(action.type || '');
        if (type === 'navigate') {
          assert(validId(action.target) && builtinPageIds.has(String(action.target)),
            'Workflow navigate action has an unsupported built-in route in rule ' + rule.id);
        } else if (type === 'openPage') {
          assert(validId(action.target) && pageIds.has(String(action.target)),
            'Workflow openPage action has an unknown remote page in rule ' + rule.id);
        } else if (type === 'showMessage') {
          assert(typeof action.message === 'string' && action.message.trim() && action.message.length <= 220,
            'Workflow showMessage action must contain up to 220 characters in rule ' + rule.id);
        } else {
          assert(false, 'Unsupported workflow action in rule ' + rule.id + ': ' + type);
        }
      }
    }
  }


  if (ui.sidebar != null) {
    const sidebar = ui.sidebar;
    assert(sidebar && typeof sidebar === 'object' && !Array.isArray(sidebar),
      'catalog.ui.sidebar must be an object.');
    assert(sidebar.groups == null || (Array.isArray(sidebar.groups) && sidebar.groups.length <= 20),
      'Remote sidebar may contain at most 20 groups.');
    const itemIds = new Set();
    for (const group of (sidebar.groups || [])) {
      assert(group && typeof group.title === 'string' && group.title.trim() &&
        Array.isArray(group.items) && group.items.length <= 30, 'Invalid remote sidebar group.');
      for (const item of group.items) {
        const remotePage = item && validId(item.pageId) && pageIds.has(item.pageId);
        const builtinPages = new Set(['subjects', 'specialties', 'topics', 'questions', 'quiz',
          'quizrun', 'quizresult', 'quizhistory', 'review', 'stats', 'search', 'settings',
          'about', 'changelog', 'feedback', 'rate', 'pinned', 'saved', 'wrong', 'reported',
          'notifs', 'timer']);
        const builtinPage = item && validId(item.targetPage) && builtinPages.has(item.targetPage);
        assert(item && validId(item.id) && !itemIds.has(item.id) &&
          (remotePage || builtinPage) && typeof item.label === 'string' && item.label.trim(),
          'Invalid or duplicate remote sidebar item.');
        itemIds.add(item.id);
        if (item.icon != null) assert(typeof item.icon === 'string' && item.icon.length <= 16,
          'Remote sidebar icon must be a short text or emoji.');
        if (item.enabled != null) assert(typeof item.enabled === 'boolean',
          'Remote sidebar enabled must be boolean.');
        if (item.order != null) assert(Number.isFinite(Number(item.order)),
          'Remote sidebar order must be numeric.');
      }
    }
    for (const key of ['hiddenItems', 'groupOrder']) {
      if (sidebar[key] != null) assert(Array.isArray(sidebar[key]) &&
        sidebar[key].every(value => typeof value === 'string'), 'Invalid sidebar ' + key + '.');
    }
    if (sidebar.itemGroups != null) {
      assert(sidebar.itemGroups && typeof sidebar.itemGroups === 'object' && !Array.isArray(sidebar.itemGroups),
        'Sidebar itemGroups must be an object.');
      for (const [route, group] of Object.entries(sidebar.itemGroups)) {
        assert((builtinPageIds.has(route) || pageIds.has(route)) && typeof group === 'string' && group.trim() && group.length <= 64,
          'Invalid sidebar itemGroups entry: ' + route);
      }
    }
    for (const key of ['renames', 'groupRenames']) {
      if (sidebar[key] != null) {
        assert(sidebar[key] && typeof sidebar[key] === 'object' && !Array.isArray(sidebar[key]),
          'Sidebar ' + key + ' must be an object.');
        for (const value of Object.values(sidebar[key])) assert(typeof value === 'string' && value.trim(),
          'Sidebar ' + key + ' values must be non-empty text.');
      }
    }
  }

  if (ui.announcements != null) {
    assert(Array.isArray(ui.announcements) && ui.announcements.length <= 10,
      'Remote UI may contain at most 10 announcements.');
    const announcementIds = new Set();
    for (const item of ui.announcements) {
      assert(item && validId(item.id) && !announcementIds.has(item.id) &&
        typeof item.title === 'string' && item.title.trim() &&
        typeof item.text === 'string' && item.text.trim(),
        'Invalid or duplicate remote announcement.');
      announcementIds.add(item.id);
      if (item.dismissible != null) assert(typeof item.dismissible === 'boolean',
        'Announcement dismissible must be boolean.');
    }
  }
  if (ui.appearance != null) {
    assert(ui.appearance && typeof ui.appearance === 'object' && !Array.isArray(ui.appearance),
      'Remote UI appearance must be an object.');
    const hex = /^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/;
    for (const key of ['accentColor', 'accentSoft', 'backgroundColor', 'surfaceColor',
      'cardColor', 'textColor', 'mutedColor', 'borderColor']) {
      if (ui.appearance[key] != null) assert(typeof ui.appearance[key] === 'string' && hex.test(ui.appearance[key]),
        'Invalid remote UI color: ' + key);
    }
    if (ui.appearance.fontScale != null) assert(Number.isFinite(Number(ui.appearance.fontScale)) &&
      Number(ui.appearance.fontScale) >= 0.85 && Number(ui.appearance.fontScale) <= 1.2,
      'appearance.fontScale must be from 0.85 to 1.2.');
    if (ui.appearance.cardRadius != null) assert(Number.isInteger(ui.appearance.cardRadius) &&
      ui.appearance.cardRadius >= 6 && ui.appearance.cardRadius <= 32,
      'appearance.cardRadius must be an integer from 6 to 32.');
    if (ui.appearance.density != null) assert(['compact', 'comfortable'].includes(ui.appearance.density),
      'appearance.density must be compact or comfortable.');
  }

  function validUiAction(action, target, label) {
    const accepted = action === 'page' ? pageIds :
      (action === 'builtin' ? builtinPageIds :
      (action === 'resource' ? knownResources :
      (action === 'bank' ? knownBanks : (action === 'deck' ? knownDecks : null))));
    assert(accepted && accepted.has(String(target)), 'Unknown action target in ' + label);
  }
  if (ui.header != null) {
    const header = ui.header;
    assert(header && typeof header === 'object' && !Array.isArray(header), 'catalog.ui.header must be an object.');
    for (const key of ['enabled', 'showMenu', 'showThemeToggle', 'showNotifications', 'showSettings']) {
      if (header[key] != null) assert(typeof header[key] === 'boolean', 'header.' + key + ' must be boolean.');
    }
    for (const key of ['brand', 'subtitle', 'icon']) {
      if (header[key] != null) assert(typeof header[key] === 'string' && header[key].length <= 80,
        'header.' + key + ' must be text up to 80 characters.');
    }
    if (header.logoFile != null) assetRef(header.logoFile, listedPaths, 'header.logoFile');
    if (header.actions != null) {
      assert(Array.isArray(header.actions) && header.actions.length <= 5, 'header.actions may contain at most five items.');
      for (const item of header.actions) {
        assert(item && typeof item === 'object' && typeof item.label === 'string' && item.label.trim(),
          'Invalid header action.');
        const action = String(item.action || '');
        if (action === 'theme' || action === 'drawer') continue;
        assert(['page', 'builtin', 'resource', 'bank', 'deck'].includes(action),
          'Unsupported header action: ' + action);
        validUiAction(action, item.target, 'header action');
        if (item.icon != null) assert(typeof item.icon === 'string' && item.icon.length <= 16,
          'Header action icon must be short text or emoji.');
      }
    }
  }
  if (ui.bottomNavigation != null) {
    const nav = ui.bottomNavigation;
    assert(nav && typeof nav === 'object' && !Array.isArray(nav), 'catalog.ui.bottomNavigation must be an object.');
    if (nav.enabled != null) assert(typeof nav.enabled === 'boolean', 'bottomNavigation.enabled must be boolean.');
    if (nav.position != null) assert(['bottom', 'top', 'hidden'].includes(nav.position),
      'bottomNavigation.position must be bottom, top or hidden.');
    assert(Array.isArray(nav.items) && nav.items.length <= 6, 'bottomNavigation.items must contain at most six entries.');
    const navIds = new Set();
    for (const item of nav.items) {
      assert(item && validId(item.id) && !navIds.has(item.id) &&
        typeof item.label === 'string' && item.label.trim() && item.label.length <= 32,
        'Invalid or duplicate bottom navigation item.');
      navIds.add(item.id);
      if (item.icon != null) assert(typeof item.icon === 'string' && item.icon.length <= 16,
        'Bottom navigation icon must be short text or emoji.');
      if (item.order != null) assert(Number.isFinite(Number(item.order)), 'Bottom navigation order must be numeric.');
      if (item.enabled != null) assert(typeof item.enabled === 'boolean', 'Bottom navigation item enabled must be boolean.');
      if (item.targetPage != null) validUiAction('builtin', item.targetPage, 'bottom navigation item ' + item.id);
      else if (item.pageId != null) validUiAction('page', item.pageId, 'bottom navigation item ' + item.id);
      else validUiAction(String(item.action || ''), item.target, 'bottom navigation item ' + item.id);
    }
  }
  if (ui.screens != null) {
    assert(ui.screens && typeof ui.screens === 'object' && !Array.isArray(ui.screens),
      'catalog.ui.screens must be an object keyed by page ID.');
    for (const [route, screen] of Object.entries(ui.screens)) {
      assert(builtinPageIds.has(route) || pageIds.has(route), 'Unknown screen in catalog.ui.screens: ' + route);
      assert(screen && typeof screen === 'object' && !Array.isArray(screen), 'Invalid screen config: ' + route);
      if (screen.visible != null) assert(typeof screen.visible === 'boolean', 'screens.' + route + '.visible must be boolean.');
      for (const key of ['title', 'subtitle']) {
        if (screen[key] != null) assert(typeof screen[key] === 'string' && screen[key].length <= 120,
          'screens.' + route + '.' + key + ' must be text up to 120 characters.');
      }
      if (screen.backgroundColor != null) assert(typeof screen.backgroundColor === 'string' && hex.test(screen.backgroundColor),
        'Invalid screen background color: ' + route);
      if (screen.prepend != null) validateUiBlocks(screen.prepend, 'screens.' + route + '.prepend');
      if (screen.append != null) validateUiBlocks(screen.append, 'screens.' + route + '.append');
    }
  }
  if (ui.globalBlocks != null) {
    assert(ui.globalBlocks && typeof ui.globalBlocks === 'object' && !Array.isArray(ui.globalBlocks),
      'catalog.ui.globalBlocks must be an object.');
    if (ui.globalBlocks.before != null) validateUiBlocks(ui.globalBlocks.before, 'globalBlocks.before');
    if (ui.globalBlocks.after != null) validateUiBlocks(ui.globalBlocks.after, 'globalBlocks.after');
  }
  if (ui.features != null) {
    assert(ui.features && typeof ui.features === 'object' && !Array.isArray(ui.features),
      'catalog.ui.features must be an object.');
    const allowedFeatures = new Set(['quiz', 'smartReview', 'statistics', 'questionBank', 'flashcards', 'resources']);
    for (const [name, config] of Object.entries(ui.features)) {
      assert(allowedFeatures.has(name) && config && typeof config === 'object' && !Array.isArray(config),
        'Unsupported or invalid remote feature config: ' + name);
      if (config.visible != null) assert(typeof config.visible === 'boolean', name + '.visible must be boolean.');
      if (config.policy != null) assert(['defaults', 'enforce'].includes(config.policy), name + '.policy must be defaults or enforce.');
      if (name === 'quiz') {
        const d = config.defaults == null ? config : config.defaults;
        assert(d && typeof d === 'object' && !Array.isArray(d), 'Quiz defaults must be an object.');
        const enums = { scope:['all','sel','custom'], filt:['any','new','wrong','saved'],
          mode:['practice','timed'], fb:['instant','end'], order:['random','bank'] };
        for (const [key, values] of Object.entries(enums)) if (d[key] != null) {
          assert(values.includes(d[key]), 'Invalid Quiz default ' + key + '.');
        }
        if (d.count != null) assert(Number.isInteger(d.count) && d.count >= 1 && d.count <= 500, 'Quiz default count must be from 1 to 500.');
        if (d.mins != null) assert(Number.isInteger(d.mins) && d.mins >= 0 && d.mins <= 600, 'Quiz default mins must be from 0 to 600.');
        if (d.banks != null) assert(Array.isArray(d.banks) && d.banks.length <= 7 &&
          d.banks.every(bank => builtinBanks.has(String(bank)) && bank !== 'all'), 'Quiz default banks contains an unsupported bank.');
        for (const key of ['specs', 'topics']) if (d[key] != null) {
          assert(Array.isArray(d[key]) && d[key].length <= 200 &&
            d[key].every(value => typeof value === 'string' || typeof value === 'number'),
            'Quiz default ' + key + ' must be a short array.');
        }
      }
      if (name === 'smartReview') {
        if (config.dailyGoal != null) assert(Number.isInteger(config.dailyGoal) &&
          config.dailyGoal >= 1 && config.dailyGoal <= 200, 'Smart Review dailyGoal must be from 1 to 200.');
        if (config.defaultBank != null) assert(typeof config.defaultBank === 'string' &&
          builtinBanks.has(config.defaultBank), 'Smart Review defaultBank is unsupported.');
      }
    }
  }
}

console.log('Android remote content validation passed.');
console.log('Manifest version: ' + manifest.version);
console.log('Verified files: ' + listed.size + ' (' + totalBytes + ' bytes)');
console.log('Banks: ' + catalog.banks.length + ' · Questions: ' + totalQuestions);
console.log('Flashcard decks: ' + deckIds.size + ' · Cards: ' + totalFlashcards);
console.log('Offline resources: ' + (catalog.resources || []).length);
