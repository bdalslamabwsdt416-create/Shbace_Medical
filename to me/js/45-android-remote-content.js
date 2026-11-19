/* SHBACE Medical · Android Remote Content Engine v1
 *
 * Android APK only. The native bridge downloads signed-by-transport (HTTPS) content packages,
 * checks each file against the manifest SHA-256, and keeps versioned copies in private storage.
 * This module registers declarative JSON MCQ banks with the existing question engine. It never
 * executes JavaScript downloaded from the content server.
 */
(function () {
  'use strict';

  var MANIFEST_URL = 'https://raw.githubusercontent.com/bdalslamabwsdt416-create/Shbace_Medical/main/for%20ApK/android-content/manifest.json';
  var CHECK_KEY = 'shbace_android_content_check_at_v1';
  var CHECK_EVERY = 48 * 60 * 60 * 1000;
  var CHECK_RETRY = 2 * 60 * 60 * 1000;
  var BANK_KEY = 'remote-content';
  var B = window.__SHB_BRIDGE;
  var N = window.ShbaceNative;

  function isNativeAndroid() {
    try {
      return !!(window.Capacitor &&
        typeof window.Capacitor.getPlatform === 'function' &&
        window.Capacitor.getPlatform() === 'android' &&
        typeof window.Capacitor.isNativePlatform === 'function' &&
        window.Capacitor.isNativePlatform() && N &&
        typeof N.getRemoteContentManifest === 'function' &&
        typeof N.startRemoteContentSync === 'function');
    } catch (e) { return false; }
  }
  if (!isNativeAndroid()) return;
  if (window.__SHBACE_ANDROID_REMOTE_CONTENT_V1__) return;
  window.__SHBACE_ANDROID_REMOTE_CONTENT_V1__ = true;
  if (!B || !B.registerExternalBank || !Array.isArray(B.QB)) {
    console.warn('SHBACE remote content: question engine is not ready.');
    return;
  }

  var catalog = null;
  var installedManifest = null;
  var loadedVersion = '';
  var banks = Object.create(null);
  var resources = [];
  var flashcardDecks = [];
  var currentDeckId = '';
  var currentCardIndex = 0;
  var currentCardFlipped = false;
  var currentBankId = '';
  var currentSystemId = '';
  var syncStarted = false;
  var assetCache = Object.create(null);
  var coreSpecialtiesView = window.specialtiesView;
  var coreTopicsView = window.topicsView;
  var coreRender = window.renderAppDemo;
  var coreBack = window.navBack;

  function safeJson(value) {
    try { return JSON.parse(value); } catch (e) { return null; }
  }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function slug(value) {
    var s = String(value || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
    return s.slice(0, 48) || 'item';
  }
  function localText(path) {
    try { return N.readRemoteContentText(String(path || '')) || ''; } catch (e) { return ''; }
  }
  function mimeFor(path) {
    var p = String(path || '').toLowerCase();
    if (/\.png$/.test(p)) return 'image/png';
    if (/\.jpe?g$/.test(p)) return 'image/jpeg';
    if (/\.gif$/.test(p)) return 'image/gif';
    if (/\.svg$/.test(p)) return 'image/svg+xml';
    if (/\.webp$/.test(p)) return 'image/webp';
    if (/\.pdf$/.test(p)) return 'application/pdf';
    if (/\.mp3$/.test(p)) return 'audio/mpeg';
    if (/\.m4a$/.test(p)) return 'audio/mp4';
    if (/\.mp4$/.test(p)) return 'video/mp4';
    return 'application/octet-stream';
  }
  function assetData(path) {
    if (!path || typeof path !== 'string') return '';
    if (assetCache[path] !== undefined) return assetCache[path];
    var base64 = '';
    try { base64 = N.readRemoteContentBase64(path) || ''; } catch (e) {}
    assetCache[path] = base64 ? 'data:' + mimeFor(path) + ';base64,' + base64 : '';
    return assetCache[path];
  }
  function assetMarkup(path, fallback, cls) {
    var src = assetData(path);
    if (src) return '<img class="' + (cls || 'shb-remote-img') + '" src="' + src + '" alt="" loading="lazy">';
    return '<span class="' + (cls || 'shb-remote-fallback') + '">' + esc(fallback || '✚') + '</span>';
  }

  function stableHash(value) {
    var text = String(value == null ? '' : value), hash = 2166136261;
    for (var i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return hash >>> 0;
  }
  function stableTopicId(bankId, systemId, topicId) {
    var key = String(bankId) + '|' + String(systemId) + '|' + String(topicId);
    return 1000000000 + (stableHash(key) % 900000000);
  }

  function normalizeQuestion(raw, bank, system, topic) {
    if (!raw || typeof raw !== 'object') throw new Error('Remote question record is not an object.');
    var options = Array.isArray(raw.options) ? raw.options.map(function (option) {
      return typeof option === 'string' ? option : String(option && option.text || '');
    }) : [];
    var answer = Number(raw.correctIndex);
    if (!raw || options.length < 2 || !Number.isInteger(answer) || answer < 0 || answer >= options.length) {
      throw new Error('Invalid remote question or answer key: ' + String(raw && raw.id || 'unknown'));
    }
    var rawId = String(raw.id || '').trim();
    if (!rawId || rawId.length > 160) throw new Error('Remote question has a missing or oversized ID.');
    var questionId = 'rc-' + slug(bank.id).slice(0, 18) + '-' + stableHash(bank.id).toString(36) + '-' +
      slug(rawId).slice(0, 20) + '-' + stableHash(rawId).toString(36);
    var result = {
      id: questionId,
      spec: system.spec,
      topic: 0,
      q: String(raw.stem || raw.question || '').trim(),
      o: options,
      k: answer,
      kx: false,
      tag: String(raw.tag || raw.type || 'Knowledge'),
      kind: String(raw.kind || raw.type || ''),
      ex: String(raw.explanation || raw.ex || ''),
      more: String(raw.extendedExplanation || raw.more || ''),
      src: String(raw.source || raw.src || bank.label || 'SHBACE Remote Content'),
      py: false, nl: false, ao: false, cc: false, eb: false, rq: [], rc: [],
      remoteBankId: bank.id
    };
    if (!result.q) throw new Error('Remote question has an empty stem: ' + questionId);
    if (raw.caseText) result.aiCaseVignette = String(raw.caseText);
    if (raw.image) result.remoteImage = String(raw.image);
    if (raw.reference) result.remoteReference = String(raw.reference);
    return result;
  }

  function applyContentOverrides(data) {
    var files = Array.isArray(data.overrideFiles) ? data.overrideFiles : [];
    var expected = Object.create(null);
    var bankImageChanges = [];

    if (files.length > 80) throw new Error('Too many remote override files.');
    function updateSystem(item) {
      if (!item || !String(item.id || '').trim()) throw new Error('Invalid system override.');
      var id = String(item.id);
      var system = B.REAL && B.REAL.spec && B.REAL.spec[id];
      if (!system) throw new Error('Remote override targets an unknown system: ' + id);
      if (item.name != null && String(item.name).trim()) {
        B.SPEC_NAME[id] = String(item.name).trim();
        system.label = String(item.name).trim();
        (B.SYS || []).forEach(function (row) {
          if (row && row[0] === id) row[1] = String(item.name).trim();
        });
      }
      if (item.icon) {
        var row = (B.SYS || []).find(function (entry) { return entry && entry[0] === id; });
        if (row && row[2] && typeof IMG !== 'undefined') {
          var icon = assetData(String(item.icon));
          if (icon) IMG[row[2]] = icon;
        }
      }
    }
    function updateTopic(item) {
      if (!item || !String(item.systemId || '').trim() || !Number.isInteger(Number(item.topicId))) {
        throw new Error('Invalid topic override.');
      }
      var spec = String(item.systemId), id = Number(item.topicId);
      var system = B.REAL && B.REAL.spec && B.REAL.spec[spec];
      var topic = system && Array.isArray(system.topics) &&
        system.topics.find(function (entry) { return entry && Number(entry[0]) === id; });
      if (!topic) throw new Error('Remote override targets an unknown topic: ' + spec + '/' + id);
      var oldName = String(topic[1] || '');
      if (item.name != null && String(item.name).trim()) {
        topic[1] = String(item.name).trim();
        B.TOPIC_NAME[id] = String(item.name).trim();
      }
      if (item.icon) {
        var icon = assetData(String(item.icon));
        if (icon) {
          B.TOPIC_ICON_ASSET[spec + '|' + String(topic[1])] = icon;
          if (oldName && oldName !== topic[1]) B.TOPIC_ICON_ASSET[spec + '|' + oldName] = icon;
        }
      }
    }
    function updateQuestion(item) {
      if (!item || !String(item.id || '').trim() || !item.fields || typeof item.fields !== 'object') {
        throw new Error('Invalid existing-question override.');
      }
      var id = String(item.id);
      if (expected[id]) throw new Error('Duplicate question override: ' + id);
      expected[id] = true;
      var question = B.QB.find(function (entry) { return entry && String(entry.id) === id; });
      if (!question) throw new Error('Remote override targets a missing question ID: ' + id);
      var fields = item.fields;
      var allowed = {
        stem: 'q', explanation: 'ex', extendedExplanation: 'more',
        tag: 'tag', kind: 'kind', source: 'src'
      };
      Object.keys(allowed).forEach(function (key) {
        if (fields[key] != null) question[allowed[key]] = String(fields[key]);
      });
      if (fields.options != null) {
        if (!Array.isArray(fields.options) || fields.options.length < 2 ||
            fields.options.some(function (option) { return typeof option !== 'string'; })) {
          throw new Error('Invalid replacement options for question ' + id);
        }
        question.o = fields.options.slice();
        if (question.ol) question.ol = fields.options.map(function (_, index) { return String.fromCharCode(65 + index); });
      }
      if (fields.correctIndex != null) {
        var answer = Number(fields.correctIndex);
        if (!Number.isInteger(answer) || answer < 0 || answer >= question.o.length) {
          throw new Error('Invalid replacement answer index for question ' + id);
        }
        question.k = answer;
        question.kx = false;
      }
      if (fields.caseText != null) question.aiCaseVignette = String(fields.caseText);
      if (fields.image != null) question.remoteImage = String(fields.image);
      if (fields.reference != null) question.remoteReference = String(fields.reference);
      if (fields.needsReview != null) question.f = !!fields.needsReview;
    }
    function updateCollection(item) {
      if (!item || !/^(aj|previous|nelson|kasr|clinical|egyptian)$/.test(String(item.id || ''))) {
        throw new Error('Invalid existing collection override.');
      }
      bankImageChanges.push(item);
    }

    files.forEach(function (path) {
      if (typeof path !== 'string' || expected[path]) throw new Error('Invalid or duplicate override file path.');
      expected[path] = true;
      var source = safeJson(localText(path));
      if (!source || source.schema !== 'shbace-remote-overrides-v1') {
        throw new Error('Remote overrides file is invalid: ' + path);
      }
      ['systems', 'topics', 'questionPatches', 'collections'].forEach(function (key) {
        if (source[key] != null && !Array.isArray(source[key])) throw new Error('Invalid override list: ' + key);
      });
      (source.systems || []).forEach(updateSystem);
      (source.topics || []).forEach(updateTopic);
      (source.questionPatches || []).forEach(updateQuestion);
      (source.collections || []).forEach(updateCollection);
    });
    window.__SHB_REMOTE_COLLECTION_OVERRIDES__ = bankImageChanges;
  }

  function injectCollectionOverrides() {
    var overrides = window.__SHB_REMOTE_COLLECTION_OVERRIDES__ || [];
    var root = document.querySelector('.ped-collections-grid');
    if (!root) return;
    var selectors = {
      aj: '.ped-collection-aj',
      previous: '.ped-collection-previous',
      nelson: '.ped-collection-nelson',
      kasr: '.ped-collection-allonce:not(.ped-collection-clinicalcase):not(.ped-collection-bank08)',
      clinical: '.ped-collection-clinicalcase:not(.ped-collection-bank07)',
      egyptian: '.ped-collection-egyptian'
    };
    overrides.forEach(function (item) {
      var card = root.querySelector(selectors[item.id] || '');
      if (!card) return;
      if (item.title) {
        var title = card.querySelector('.ped-collection-copy b');
        if (title) title.textContent = String(item.title);
      }
      if (item.description) {
        var description = card.querySelector('.ped-collection-copy small');
        if (description) description.textContent = String(item.description);
      }
      if (item.eyebrow) {
        var eyebrow = card.querySelector('.ped-collection-copy .eyebrow');
        if (eyebrow) eyebrow.textContent = String(item.eyebrow);
      }
      if (item.cover) {
        var avatar = card.querySelector('.ped-collection-avatar');
        var source = assetData(String(item.cover));
        if (avatar && source) {
          avatar.innerHTML = '';
          var image = document.createElement('img');
          image.src = source;
          image.alt = '';
          image.loading = 'lazy';
          avatar.appendChild(image);
        }
      }
    });
  }

  function buildRemoteBanks(data) {
    if (!data || data.schema !== 'shbace-remote-content-catalog-v1' ||
        !Array.isArray(data.systems) || !Array.isArray(data.banks)) {
      throw new Error('Remote content catalog schema is invalid.');
    }
    if (data.banks.length > 40 || data.systems.length > 120) {
      throw new Error('Remote content catalog contains too many entries.');
    }
    if (Array.isArray(data.resources) && data.resources.length > 120) {
      throw new Error('Remote content catalog contains too many learning resources.');
    }

    var systemById = Object.create(null);
    data.systems.forEach(function (system) {
      if (!system || !/^[a-zA-Z0-9_-]{1,48}$/.test(String(system.id || '')) ||
          !String(system.name || '').trim() || !Array.isArray(system.topics)) {
        throw new Error('Invalid system entry in remote content catalog.');
      }
      if (systemById[system.id]) throw new Error('Duplicate remote system ID: ' + system.id);
      var topicIds = Object.create(null);
      system.topics.forEach(function (topic) {
        if (!topic || !/^[a-zA-Z0-9_-]{1,48}$/.test(String(topic.id || '')) ||
            !String(topic.name || '').trim() || topicIds[topic.id]) {
          throw new Error('Invalid or duplicate topic in system ' + system.id);
        }
        topicIds[topic.id] = true;
      });
      systemById[system.id] = system;
    });

    var allGroups = [];
    var registry = Object.create(null);
    var usedQuestionIds = Object.create(null);
    var seenBanks = Object.create(null);

    data.banks.forEach(function (bank) {
      if (!bank || !/^[a-zA-Z0-9_-]{1,48}$/.test(String(bank.id || '')) ||
          !String(bank.label || '').trim() || !String(bank.contentFile || '').trim() || seenBanks[bank.id]) {
        throw new Error('Invalid remote bank entry in catalog.');
      }
      seenBanks[bank.id] = true;
      var source = safeJson(localText(bank.contentFile));
      if (!source || !Array.isArray(source.questions) ||
          (source.schema !== 'shbace-remote-questions-v1' &&
           source.schema !== 'shbace-remote-mcq-bank-v1')) {
        throw new Error('Could not load remote question file: ' + bank.contentFile);
      }
      if (bank.totalQuestions != null && Number(bank.totalQuestions) !== source.questions.length) {
        throw new Error('Question count mismatch in remote bank: ' + bank.id);
      }

      var allowedSystems = Array.isArray(bank.systemIds) && bank.systemIds.length
        ? bank.systemIds.map(String) : Object.keys(systemById);
      var groupsForBank = [];
      var coveredQuestions = 0;
      allowedSystems.forEach(function (systemId) {
        var system = systemById[systemId];
        if (!system) throw new Error('Unknown system "' + systemId + '" in bank ' + bank.id);
        var systemQuestions = source.questions.filter(function (q) { return String(q.systemId || '') === systemId; });
        if (!systemQuestions.length) return;

        var spec = 'remote_' + slug(bank.id) + '_' + slug(system.id);
        if (!B.SYS.some(function (row) { return row && row[0] === spec; })) {
          B.SYS.push([spec, String(system.name), null, 1]);
        }
        var systemRecord = {
          id: system.id,
          name: String(system.name),
          spec: spec,
          icon: system.icon || '',
          topics: [],
          groups: [],
          count: 0
        };

        (system.topics || []).forEach(function (topic) {
          if (!topic || !/^[a-zA-Z0-9_-]{1,48}$/.test(String(topic.id || '')) ||
              !String(topic.name || '').trim()) return;
          var topicQuestions = systemQuestions.filter(function (q) {
            return String(q.topicId || '') === String(topic.id);
          });
          if (!topicQuestions.length) return;
          var normalized = topicQuestions.map(function (q) {
            var item = normalizeQuestion(q, bank, systemRecord, topic);
            if (usedQuestionIds[item.id]) throw new Error('Duplicate remote question ID: ' + item.id);
            usedQuestionIds[item.id] = true;
            return item;
          });
          var group = {
            spec: spec,
            systemName: String(system.name),
            systemLabel: String(system.name),
            topicName: String(topic.name),
            bankLabel: String(bank.label),
            questions: normalized,
            remoteBankId: bank.id,
            remoteSystemId: system.id,
            remoteTopicId: topic.id,
            stableTopicId: stableTopicId(bank.id, system.id, topic.id),
            topicIcon: topic.icon || ''
          };
          groupsForBank.push(group);
          coveredQuestions += normalized.length;
          allGroups.push(group);
          systemRecord.groups.push(group);
          systemRecord.topics.push(topic);
          systemRecord.count += normalized.length;
          systemRecord.questions = (systemRecord.questions || []).concat(normalized);
        });
        if (systemRecord.groups.length) {
          systemRecord.count = systemRecord.questions.length;
          registry[bank.id] = registry[bank.id] || { bank: bank, systems: [] };
          registry[bank.id].systems.push(systemRecord);
        }
      });
      if (coveredQuestions !== source.questions.length) {
        throw new Error('Some questions are not mapped to a catalog system/topic in bank ' + bank.id + '.');
      }
      if (registry[bank.id]) {
        registry[bank.id].groups = groupsForBank;
        registry[bank.id].count = coveredQuestions;
      } else if (source.questions.length) {
        throw new Error('No visible system/topic groups were created for bank ' + bank.id + '.');
      }
    });

    if (allGroups.length) {
      var registration = B.registerExternalBank(BANK_KEY, 'Remote Content', allGroups);
      Object.keys(registry).forEach(function (id) {
        registry[id].groups.forEach(function (group) {
          group.topicId = Number(group.topicId);
        });
        registry[id].validation = { passed: true, registeredQuestions: registration.added };
      });
    }
    return registry;
  }

  function buildResources(data) {
    var items = Array.isArray(data.resources) ? data.resources : [];
    var seen = Object.create(null);
    return items.map(function (item) {
      if (!item || !/^[a-zA-Z0-9_-]{1,48}$/.test(String(item.id || '')) ||
          seen[item.id] || !String(item.title || '').trim() ||
          !/^(pdf|audio|video|file|image)$/i.test(String(item.type || '')) ||
          !String(item.file || '').trim()) {
        throw new Error('Invalid resource record in remote content catalog.');
      }
      seen[item.id] = true;
      return {
        id: String(item.id),
        title: String(item.title),
        description: String(item.description || ''),
        type: String(item.type).toLowerCase(),
        file: String(item.file),
        cover: String(item.cover || ''),
        systemId: String(item.systemId || ''),
        topicId: String(item.topicId || ''),
        source: String(item.source || '')
      };
    });
  }

  var FLASHCARD_STATE_KEY = 'shbace_remote_flashcards_v1';

  function buildFlashcardDecks(data) {
    var items = Array.isArray(data.flashcardDecks) ? data.flashcardDecks : [];
    if (items.length > 80) throw new Error('Remote catalog contains too many flashcard decks.');
    var seenDecks = Object.create(null);
    return items.map(function (deck) {
      if (!deck || !/^[a-zA-Z0-9_-]{1,48}$/.test(String(deck.id || '')) ||
          seenDecks[deck.id] || !String(deck.title || '').trim() ||
          !String(deck.contentFile || '').trim()) {
        throw new Error('Invalid remote flashcard deck metadata.');
      }
      seenDecks[deck.id] = true;
      var source = safeJson(localText(deck.contentFile));
      if (!source || source.schema !== 'shbace-remote-flashcards-v1' ||
          !Array.isArray(source.cards) || source.cards.length === 0 || source.cards.length > 5000) {
        throw new Error('Flashcard data is missing or invalid: ' + deck.contentFile);
      }
      var cardIds = Object.create(null);
      var cards = source.cards.map(function (card) {
        if (!card || !String(card.id || '').trim() || cardIds[card.id] ||
            !String(card.front || '').trim() || !String(card.back || '').trim()) {
          throw new Error('Invalid or duplicate flashcard in deck ' + deck.id);
        }
        cardIds[card.id] = true;
        return {
          id: String(card.id),
          front: String(card.front),
          back: String(card.back),
          frontImage: String(card.frontImage || ''),
          backImage: String(card.backImage || ''),
          topic: String(card.topic || '')
        };
      });
      return {
        id: String(deck.id),
        title: String(deck.title),
        description: String(deck.description || ''),
        cover: String(deck.cover || ''),
        cards: cards,
        count: cards.length
      };
    });
  }

  function flashcardProgress() {
    var value = safeJson(localStorage.getItem(FLASHCARD_STATE_KEY)) || {};
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }
  function flashcardKey(deckId, cardId) { return String(deckId) + '|' + String(cardId); }
  function flashcardKnownCount(deck) {
    var progress = flashcardProgress(), total = 0;
    deck.cards.forEach(function (card) {
      if (progress[flashcardKey(deck.id, card.id)] &&
          progress[flashcardKey(deck.id, card.id)].status === 'known') total++;
    });
    return total;
  }
  function openFlashcardDeck(id) {
    var deck = flashcardDecks.find(function (item) { return item.id === id; });
    if (!deck) return;
    currentDeckId = id;
    currentCardIndex = 0;
    currentCardFlipped = false;
    appPage = 'shbRemoteFlashcards';
    renderAppDemo();
  }
  window.shbRemoteOpenFlashcardDeck = openFlashcardDeck;
  window.shbRemoteFlipFlashcard = function () {
    currentCardFlipped = !currentCardFlipped;
    renderAppDemo();
  };
  window.shbRemoteStepFlashcard = function (delta) {
    var deck = flashcardDecks.find(function (item) { return item.id === currentDeckId; });
    if (!deck) return;
    currentCardIndex = Math.max(0, Math.min(deck.cards.length - 1, currentCardIndex + Number(delta || 0)));
    currentCardFlipped = false;
    renderAppDemo();
  };
  window.shbRemoteRateFlashcard = function (status) {
    var deck = flashcardDecks.find(function (item) { return item.id === currentDeckId; });
    var card = deck && deck.cards[currentCardIndex];
    if (!card || (status !== 'known' && status !== 'again')) return;
    var progress = flashcardProgress();
    progress[flashcardKey(deck.id, card.id)] = { status: status, updatedAt: Date.now() };
    try { localStorage.setItem(FLASHCARD_STATE_KEY, JSON.stringify(progress)); } catch (e) {}
    window.shbRemoteStepFlashcard(1);
  };

  function flashcardDeckView() {
    var deck = flashcardDecks.find(function (item) { return item.id === currentDeckId; });
    if (!deck) {
      currentDeckId = '';
      appPage = 'subjects';
      return '';
    }
    var card = deck.cards[currentCardIndex];
    var progress = flashcardProgress();
    var saved = progress[flashcardKey(deck.id, card.id)] || {};
    var totalKnown = flashcardKnownCount(deck);
    var visibleText = currentCardFlipped ? card.back : card.front;
    var visibleImage = currentCardFlipped ? card.backImage : card.frontImage;
    var image = visibleImage ? assetData(visibleImage) : '';
    var allDone = totalKnown === deck.count;
    return '<div class="app-head"><div class="app-head-title">Flashcards</div></div>' +
      '<div class="rs shb-remote-flashcards"><button type="button" class="btn sm" onclick="navBack()">← All collections</button>' +
      '<div class="ped-collection-kicker">OFFLINE FLASHCARD DECK</div><h1>' + esc(deck.title) + '</h1>' +
      '<p class="sub">' + esc(deck.description) + '</p>' +
      '<div class="qprog"><span>' + totalKnown + ' / ' + deck.count + ' mastered</span><b>' +
      Math.round(totalKnown * 100 / Math.max(1, deck.count)) + '%</b></div>' +
      '<div class="qbar"><i style="width:' + (totalKnown * 100 / Math.max(1, deck.count)) + '%"></i></div>' +
      '<article class="card shb-remote-flashcard"><div class="eyebrow">CARD ' + (currentCardIndex + 1) + ' OF ' +
      deck.count + (currentCardFlipped ? ' · ANSWER' : ' · QUESTION') + '</div>' +
      (image ? '<img src="' + image + '" alt="" style="display:block;max-width:100%;max-height:300px;object-fit:contain;margin:10px auto;border-radius:12px">' : '') +
      '<div class="shb-remote-flashcard-text" style="white-space:pre-wrap;font-size:1.15rem;line-height:1.65;padding:24px 8px;text-align:center">' +
      esc(visibleText) + '</div>' +
      (saved.status === 'known' ? '<span class="badge">Previously marked as known</span>' : '') +
      '<button type="button" class="btn primary block" onclick="shbRemoteFlipFlashcard()">' +
      (currentCardFlipped ? 'Show question' : 'Reveal answer') + '</button></article>' +
      '<div style="display:flex;gap:8px"><button type="button" class="btn" style="flex:1" onclick="shbRemoteStepFlashcard(-1)" ' +
      (currentCardIndex === 0 ? 'disabled' : '') + '>← Previous</button><button type="button" class="btn" style="flex:1" onclick="shbRemoteStepFlashcard(1)" ' +
      (currentCardIndex >= deck.count - 1 ? 'disabled' : '') + '>Next →</button></div>' +
      (currentCardFlipped ? '<div style="display:flex;gap:8px;margin-top:10px"><button type="button" class="btn" style="flex:1" onclick="shbRemoteRateFlashcard(\'again\')">Review again</button>' +
      '<button type="button" class="btn primary" style="flex:1" onclick="shbRemoteRateFlashcard(\'known\')">I know this</button></div>' : '') +
      (allDone ? '<p class="sub">You have marked every card in this deck as known. You can still review them again.</p>' : '') +
      '</div>';
  }

  if (typeof window.__shbRegisterPage === 'function') {
    window.__shbRegisterPage('shbRemoteFlashcards', flashcardDeckView, 'subjects');
  }

  function injectFlashcardDeckCards() {
    var grid = document.querySelector('.ped-collections-grid');
    if (!grid || !flashcardDecks.length) return;
    flashcardDecks.forEach(function (deck) {
      if (grid.querySelector('[data-shb-remote-deck="' + deck.id + '"]')) return;
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'ped-collection-card ped-collection-remote-flashcards';
      button.setAttribute('data-shb-remote-deck', deck.id);
      button.innerHTML = '<span class="ped-collection-avatar ped-avatar-icon">' +
        (deck.cover ? assetMarkup(deck.cover, '▤', 'shb-remote-cover') :
          '<span class="shb-remote-resource-type">▤</span>') +
        '</span><span class="ped-collection-copy"><span class="eyebrow">FLASHCARD DECK</span><b>' +
        esc(deck.title) + '</b><small>' + esc(deck.description || 'Review and remember key medical concepts.') +
        '</small><span class="ped-collection-count">' + deck.count + ' cards · ' +
        flashcardKnownCount(deck).toLocaleString() + ' mastered</span></span><span class="ped-collection-arrow">›</span>';
      button.addEventListener('click', function () { openFlashcardDeck(deck.id); });
      grid.appendChild(button);
    });
  }

  function openRemoteResource(id) {
    var item = resources.find(function (resource) { return resource.id === id; });
    if (!item) return false;
    try {
      var opened = N.openRemoteContentFile(item.file) === true;
      if (!opened) toast('This resource is not installed yet. Check for content updates.');
      return opened;
    } catch (e) {
      toast('Could not open this learning resource.');
      return false;
    }
  }
  window.shbRemoteOpenResource = openRemoteResource;

  function injectResourceCards() {
    var grid = document.querySelector('.ped-collections-grid');
    if (!grid || !resources.length) return;
    var symbols = { pdf: 'PDF', audio: '♫', video: '▶', file: 'FILE', image: 'IMG' };
    resources.forEach(function (resource) {
      if (grid.querySelector('[data-shb-remote-resource="' + resource.id + '"]')) return;
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'ped-collection-card ped-collection-remote-resource';
      button.setAttribute('data-shb-remote-resource', resource.id);
      button.innerHTML = '<span class="ped-collection-avatar ped-avatar-icon">' +
        (resource.cover ? assetMarkup(resource.cover, symbols[resource.type] || 'FILE', 'shb-remote-cover') :
          '<span class="shb-remote-resource-type">' + esc(symbols[resource.type] || 'FILE') + '</span>') +
        '</span><span class="ped-collection-copy"><span class="eyebrow">OFFLINE LEARNING RESOURCE · ' +
        esc(resource.type.toUpperCase()) + '</span><b>' + esc(resource.title) + '</b><small>' +
        esc(resource.description || resource.source || 'Saved on this device for offline access.') +
        '</small></span><span class="ped-collection-arrow">↗</span>';
      button.addEventListener('click', function () { openRemoteResource(resource.id); });
      grid.appendChild(button);
    });
  }

  function injectQuestionMedia() {
    var cards = document.querySelectorAll('.qcard[data-id]');
    Array.prototype.forEach.call(cards, function (card) {
      var id = card.getAttribute('data-id');
      var question = B.QB.find(function (item) { return item && item.id === id; });
      if (!question || !question.remoteImage || card.querySelector('.shb-remote-question-image')) return;
      var path = String(question.remoteImage);
      var source = assetData(path);
      var stem = card.querySelector('.qstem');
      if (!stem) return;
      if (source) {
        var image = document.createElement('img');
        image.className = 'shb-remote-question-image';
        image.src = source;
        image.alt = 'Question illustration';
        image.loading = 'lazy';
        image.style.cssText = 'display:block;width:100%;max-width:560px;max-height:420px;object-fit:contain;margin:10px auto 14px;border-radius:14px';
        card.insertBefore(image, stem);
      } else {
        var open = document.createElement('button');
        open.type = 'button';
        open.className = 'btn block shb-remote-question-file';
        open.textContent = 'Open attached question image';
        open.addEventListener('click', function () {
          if (!N.openRemoteContentFile(path)) toast('Question image is not installed.');
        });
        card.insertBefore(open, stem);
      }
    });
  }

  function allTopicIds(bank) {
    return (bank && bank.groups || []).map(function (group) { return group.topicId; });
  }
  function activeBank() { return currentBankId && banks[currentBankId] ? banks[currentBankId] : null; }
  function openRemoteBank(id) {
    var item = banks[id];
    if (!item) return;
    currentBankId = id;
    currentSystemId = '';
    B.setActiveBank(BANK_KEY, allTopicIds(item));
    window.__SHB_REMOTE_CONTENT_ACTIVE__ = true;
    appPage = 'specialties';
    window.renderAppDemo();
  }
  function openRemoteSystem(id) {
    var item = activeBank();
    var system = item && item.systems.find(function (s) { return s.id === id; });
    if (!system) return;
    currentSystemId = id;
    B.setActiveBank(BANK_KEY, system.groups.map(function (g) { return g.topicId; }));
    B.qs.spec = system.spec;
    B.qs.topic = 0;
    B.qs.filter = 'all';
    B.qs.tag = 'all';
    B.qs.view = 'all';
    B.qs.idx = 0;
    appPage = 'topics';
    window.renderAppDemo();
  }
  window.shbRemoteOpenBank = openRemoteBank;
  window.shbRemoteOpenSystem = openRemoteSystem;

  function remoteBankView() {
    var item = activeBank();
    if (!item) return typeof coreSpecialtiesView === 'function' ? coreSpecialtiesView() : '';
    var systems = item.systems.map(function (system) {
      return '<button type="button" class="card sc spc ped-system-card shb-remote-system" onclick="shbRemoteOpenSystem(\'' +
        esc(system.id) + '\')">' + assetMarkup(system.icon, '✚') +
        '<span class="spc-tx"><h3>' + esc(system.name) + '</h3><span class="meta">' +
        system.count.toLocaleString() + ' questions · ' + system.groups.length + ' topics</span></span><span class="chev">›</span></button>';
    }).join('');
    var total = item.count.toLocaleString();
    var back = '<button type="button" class="btn sm" onclick="navBack()">← Back to collections</button>';
    return '<div class="app-head"><div class="app-head-title">' + esc(item.bank.label) + '</div></div>' +
      '<div class="rs ped-systems-page shb-remote-page">' + back +
      '<div class="ped-collection-kicker">SHBACE MEDICAL · REMOTE CONTENT</div><h1>' + esc(item.bank.label) +
      '</h1><p class="sub">' + item.systems.length + ' systems · ' + total + ' questions</p>' +
      (item.bank.description ? '<p class="sub">' + esc(item.bank.description) + '</p>' : '') +
      '<div class="ped-systems-grid">' + systems + '</div></div>';
  }

  function remoteTopicsView() {
    var item = activeBank();
    var system = item && item.systems.find(function (s) { return s.id === currentSystemId; });
    if (!system) return remoteBankView();
    var tiles = system.groups.map(function (group) {
      var done = B.answeredCount(group.questions);
      var pct = group.questions.length ? Math.round(done * 100 / group.questions.length) : 0;
      return '<button type="button" class="card sc tpc shb-remote-topic" onclick="openTopic(\'' +
        esc(group.spec) + '\',' + Number(group.topicId) + ')">' +
        assetMarkup(group.topicIcon, '✚', 'tno ti') + '<span class="tpc-tx"><h3>' +
        esc(group.topicName) + '</h3><span class="meta">' + group.questions.length +
        ' questions · ' + done + ' answered</span><span class="bar"><span style="width:' + pct +
        '%"></span></span></span><span class="chev">›</span></button>';
    }).join('');
    return '<div class="app-head"><div class="app-head-title">' + esc(item.bank.label) + '</div></div>' +
      '<div class="rs ped-bank-topics shb-remote-page"><button type="button" class="btn sm" onclick="navBack()">← Systems</button>' +
      '<div class="ped-collection-kicker">' + esc(system.name.toUpperCase()) + '</div><h1>' + esc(system.name) +
      '</h1><p class="sub">' + system.groups.length + ' topics · ' + system.count.toLocaleString() +
      ' questions</p><div class="ped-systems-grid">' + tiles + '</div></div>';
  }

  function injectBankCards() {
    var grid = document.querySelector('.ped-collections-grid');
    if (!grid || !catalog) return;
    Object.keys(banks).forEach(function (id) {
      if (grid.querySelector('[data-shb-remote-bank="' + id + '"]')) return;
      var item = banks[id], bank = item.bank;
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'ped-collection-card ped-collection-remote';
      button.setAttribute('data-shb-remote-bank', id);
      button.innerHTML = '<span class="ped-collection-avatar ped-avatar-icon">' +
        assetMarkup(bank.cover, bank.icon || '✚', 'shb-remote-cover') +
        '</span><span class="ped-collection-copy"><span class="eyebrow">REMOTE QUESTION BANK</span><b>' +
        esc(bank.label) + '</b><small>' + esc(bank.description || 'Additional medical learning content.') +
        '</small><span class="ped-collection-count">' + item.count.toLocaleString() + ' questions</span></span>' +
        '<span class="ped-collection-arrow">›</span>';
      button.addEventListener('click', function () { openRemoteBank(id); });
      grid.appendChild(button);
    });
  }

  function injectSettingsCard() {
    if (appPage !== 'settings') return;
    var root = document.querySelector('.rs');
    if (!root || root.querySelector('.shb-remote-settings')) return;
    var state = safeJson(N.getRemoteContentState()) || {};
    var panel = document.createElement('section');
    panel.className = 'card setcard shb-remote-settings';
    panel.innerHTML = '<div class="eyebrow">ANDROID CONTENT UPDATES</div><h3>Learning content</h3>' +
      '<p class="meta" data-shb-remote-status>Installed version: ' + esc(state.version || 'Not installed') +
      ' · ' + Number(state.fileCount || 0) + ' files</p>' +
      '<button type="button" class="btn primary block" data-shb-remote-check>Check for content updates</button>' +
      '<p class="meta">Only changed content files are downloaded. Your answers and study progress remain on this device.</p>';
    var button = panel.querySelector('[data-shb-remote-check]');
    button.addEventListener('click', function () { startSync(true); });
    root.insertBefore(panel, root.firstChild);
  }

  function syncDue() {
    try {
      var last = Number(localStorage.getItem(CHECK_KEY)) || 0;
      return !last || Date.now() - last >= CHECK_EVERY;
    } catch (e) { return true; }
  }
  function updateSettingsStatus(message) {
    var node = document.querySelector('[data-shb-remote-status]');
    if (node) node.textContent = message;
  }
  function toast(message) {
    try { if (typeof window.toast === 'function') window.toast(message); } catch (e) {}
    try { if (typeof window.shbToast === 'function') window.shbToast(message); } catch (e) {}
  }
  function startSync(manual) {
    if (syncStarted || !navigator.onLine) {
      if (manual && !navigator.onLine) toast('Connect to the internet to check for new content.');
      return false;
    }
    syncStarted = true;
    updateSettingsStatus('Checking the remote content package…');
    var accepted = false;
    try { accepted = N.startRemoteContentSync(MANIFEST_URL) === true; } catch (e) {}
    if (!accepted) {
      syncStarted = false;
      updateSettingsStatus('A content check is already running or could not be started.');
      if (manual) toast('Could not start the content update check.');
    }
    return accepted;
  }

  window.__shbRemoteContentSyncComplete = function (raw) {
    syncStarted = false;
    var result = safeJson(raw) || { ok: false, error: 'Invalid update response.' };
    if (!result.ok) {
      try { localStorage.setItem(CHECK_KEY, String(Date.now() - CHECK_EVERY + CHECK_RETRY)); } catch (e) {}
      updateSettingsStatus('Update check failed: ' + String(result.error || 'Unknown error'));
      if (appPage === 'settings') renderSettingsStatus();
      return;
    }
    try { localStorage.setItem(CHECK_KEY, String(Date.now())); } catch (e) {}
    updateSettingsStatus('Content version: ' + String(result.version || 'unknown') +
      ' · ' + Number(result.updated || 0) + ' files changed');
    if (result.status === 'updated' && result.version && result.version !== loadedVersion) {
      updateSettingsStatus('New content verified. Reopening with the updated material…');
      setTimeout(function () { location.reload(); }, 500);
      return;
    }
    if (appPage === 'settings') renderSettingsStatus();
    if (result.status === 'up-to-date') toast('Your learning content is up to date.');
    else if (Number(result.updated || 0) > 0) toast('New learning content has been installed.');
  };

  function renderSettingsStatus() {
    var panel = document.querySelector('.shb-remote-settings');
    if (!panel) return;
    var state = safeJson(N.getRemoteContentState()) || {};
    var node = panel.querySelector('[data-shb-remote-status]');
    if (node) node.textContent = 'Installed version: ' + String(state.version || 'Not installed') +
      ' · ' + Number(state.fileCount || 0) + ' files';
  }

  function loadInstalledCatalog() {
    installedManifest = safeJson(N.getRemoteContentManifest());
    if (!installedManifest || !installedManifest.version) return;
    loadedVersion = String(installedManifest.version);
    var catalogPath = String(installedManifest.catalogPath || 'catalog.json');
    var raw = localText(catalogPath);
    if (!raw) return;
    catalog = safeJson(raw);
    if (!catalog) throw new Error('The installed remote catalog is not valid JSON.');
    applyContentOverrides(catalog);
    resources = buildResources(catalog);
    flashcardDecks = buildFlashcardDecks(catalog);
    banks = buildRemoteBanks(catalog);
  }

  try {
    loadInstalledCatalog();
  } catch (error) {
    console.error('SHBACE remote content could not be loaded:', error);
    catalog = null;
    banks = Object.create(null);
  }

  window.specialtiesView = function () {
    if (currentBankId) return remoteBankView();
    return typeof coreSpecialtiesView === 'function' ? coreSpecialtiesView.apply(this, arguments) : '';
  };
  window.topicsView = function () {
    if (currentBankId) return remoteTopicsView();
    return typeof coreTopicsView === 'function' ? coreTopicsView.apply(this, arguments) : '';
  };
  window.navBack = function () {
    if (currentDeckId && appPage === 'shbRemoteFlashcards') {
      currentDeckId = '';
      appPage = 'subjects';
      window.renderAppDemo();
      return;
    }
    if (currentBankId && appPage === 'topics') {
      currentSystemId = '';
      B.setActiveBank(BANK_KEY, allTopicIds(activeBank()));
      appPage = 'specialties';
      window.renderAppDemo();
      return;
    }
    if (currentBankId && appPage === 'specialties') {
      currentBankId = '';
      currentSystemId = '';
      B.setActiveBank('all');
      window.__SHB_REMOTE_CONTENT_ACTIVE__ = false;
      appPage = 'subjects';
      window.renderAppDemo();
      return;
    }
    if (typeof coreBack === 'function') return coreBack.apply(this, arguments);
  };
  window.renderAppDemo = function () {
    if (appPage !== 'shbRemoteFlashcards' && currentDeckId) currentDeckId = '';
    var result = coreRender.apply(this, arguments);
    try {
      injectCollectionOverrides();
      injectBankCards();
      injectResourceCards();
      injectFlashcardDeckCards();
      injectQuestionMedia();
      injectSettingsCard();
    } catch (e) { console.warn('Remote content UI injection failed', e); }
    return result;
  };

  // The app remains fully usable offline. A due check runs after the installed catalog was loaded.
  if (syncDue()) {
    setTimeout(function () { startSync(false); }, 2500);
  }
  window.addEventListener('online', function () {
    if (syncDue()) setTimeout(function () { startSync(false); }, 1500);
  });
  window.shbaceCheckRemoteContent = function () { return startSync(true); };
  window.__shbRemoteContentInfo = function () {
    return {
      version: loadedVersion,
      banks: Object.keys(banks).length,
      questions: Object.keys(banks).reduce(function (n, id) { return n + banks[id].count; }, 0)
    };
  };

  // Read-only bridge for the APK-only declarative remote UI layer. No remote code is executed.
  window.__SHBACE_REMOTE_CONTENT_API__ = {
    getCatalog: function () { return catalog; },
    getBanks: function () { return Object.keys(banks).map(function (id) {
      return { id: id, bank: banks[id].bank, count: banks[id].count };
    }); },
    getResources: function () { return resources.slice(); },
    getFlashcardDecks: function () { return flashcardDecks.slice(); },
    openBank: openRemoteBank,
    openResource: openRemoteResource,
    openDeck: openFlashcardDeck,
    assetData: assetData
  };
})();
