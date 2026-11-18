# Architecture notes — Chrome Android PWA

This folder is the Android-Chrome delivery synchronized with the current shared app source in `to me/`. Keep the platform guard, release identity and the protected Chrome Android storage identifiers specific to this folder.

## Start-up

1. `index.html` paints the Splash first (`#startupSplash`, ECG drawn by a Worker on an OffscreenCanvas).
2. The immediate `js/29-offline-setup.js` bootstrap creates `window.__SHBACE_OFFLINE_BOOT_PROMISE__`. On a first installed-app launch it waits for the Splash completion event, displays Setup, downloads the full `offline-assets-manifest.json` inventory and validates every file by byte size and SHA-256.
3. The boot loader waits for that promise before fetching/assembling question-bank JSON or executing deferred application modules. This prevents first-install downloads from competing with question-bank loading and app-module preloads.
4. After a verified first install, the boot gate is released by the Setup flow. Existing installations trust their committed local ready record, release the gate immediately and do not run a full-package hash scan during startup.
5. The Service Worker is registered after the initial package has been installed. It serves the local package first and fetches/caches only genuinely missing resources.
6. Deferred execution order remains: bank data files (Nelson, All Once = Kasr Al-Ainy, Clinical Cases, Egyptian Book) → `js/09-app-features-v6.js` (core) → `10…34` features → `35…44` collections and integration layers.

The Chrome PWA flag is enabled only for Android Chrome and outside Capacitor. Native APK builds keep their own signed local web assets.

## The closed core (`js/09-app-features-v6.js`)

The file is one IIFE. State such as `QB`, `qs`, the search variables (`gq`, `gBank`, `gSpec`, `gTag`, `gSrc`, `gTopic`, `gSys`, `gSort`, `gLim`) and helpers such as `nz` live inside it and are **not visible** to other scripts. Scripts 13, 35 and 41 reach it only through `window.__SHB_BRIDGE` (`qs, SYS, QB, sysIcon, isPinned, answeredCount, TOPIC_ICON_ASSET, REC, SPEC_NAME, inTopic, topicIcon, topicCards`). To expose something new, add it to the bridge block.

## Layering by wrapping

Later scripts replace global view functions with a wrapper that calls the previous one (`const _old=fn; fn=function(){ … _old.apply(this,arguments) … }`):
- `35-pediatrics-collections.js`: `subjectsView`, `specialtiesView`, `topicsView`, `openSpec`, `openTopic`, `openQ`, bridge `inTopic`, `topicIcon`, `topicCards`.
- `41-collections-integration.js`: `navBack`, system display names, and `searchView` (folds the secondary filters into one “Filters” panel).
- `44-islamic-reminders.js` adds in-app reminder behavior without introducing a second offline-update scheduler.

When two scripts wrap the same function, the one loaded last runs outermost.

## Question banks

Each question carries one flag that decides its bank (`bankOf` in the core, checked in this priority order):

| flag | bank |
|------|------|
| `nl` | Nelson Textbook |
| `py` | Previous Questions |
| `eb` | Egyptian Book |
| `cc` | Clinical Cases |
| `ao` | Kasr Al-Ainy (the data folder and ids still say “all-once”) |
| none | Dr. Al-Joaki |

## Search

One normaliser, `nz` (lower-case, strip Arabic diacritics/tatweel, unify أ/إ/آ→ا, ى→ي, ة→ه), is shared by global Search, Saved, Wrong, Notes, Pinned & Recent and Smart Review. `tests/search-normalize.test.mjs` checks it against the real source.

## Offline storage and releases

- `pwa-version.json` is the release source of truth; `package.json` and the root entry in `package-lock.json` must match it.
- Keep the Chrome Android Cache Storage name `shbace-chrome-offline-v1.3.4` and IndexedDB database `shbace-medical-offline-state-v1` stable. The new installer adopts existing records and verified files; do not rotate the cache for routine releases.
- `npm run build:pwa` inventories every copied output file into `offline-assets-manifest.json`, including size, SHA-256 and group.
- `js/29-offline-setup.js` is the single install/update engine. It checks every 48 hours or manually, stages changed files, verifies them, and commits safely. `js/32-chrome-android.js` supplies the Android Chrome Settings UI and safe-reload bridge; it must not add a duplicate polling timer.
- The Service Worker and updater must share the same cache name. Manifest, version and worker requests retain their no-cache behavior so scheduled/manual checks can see the current release.

## Checks

Run `npm run test:unit`, `npm run check:bank` and `npm run build:pwa` from this directory. The startup tests cover the first-install gate, local-first navigation, stable cache identity, 48-hour updater ownership and safe update behavior.

## Independent Pediatrics banks

- Bank 07, Clinical Case: `data/clinicalCaseBank.json`, **system → topic → questions** (a topic opens directly to its questions; each case's shared history is shown once before its questions).
- Bank 08, AI Generated: the 16 JSON files in `data/ai-generated/`, **system → topic → questions**.
- Both keep separate local answer stores and share the main app's question rendering and controls.
