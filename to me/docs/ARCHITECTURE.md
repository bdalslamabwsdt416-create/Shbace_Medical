# Architecture notes (to me/ PWA)

Short map of how the app is put together, so the next change does not need a full read of the 420 KB core script.

## Start-up
1. `index.html` paints the splash first (`#startupSplash`, ECG drawn by a Worker on an OffscreenCanvas).
2. The standalone Setup bootstrap (`js/29-offline-setup.js`) creates `window.__SHBACE_OFFLINE_BOOT_PROMISE__`. On first install it displays the one-time Setup screen, downloads the complete `offline-assets-manifest.json` inventory, checks every file by byte size and SHA-256, commits the installed record, and waits for the student's **Open Shbace Medical** action.
3. Only after that promise resolves does `shb-boot-v1` fetch/assemble question-bank JSON and preload/execute deferred app modules. Question-bank JSON is read from the verified package cache first; the legacy data cache remains a secondary local copy. This prevents the question-bank fetch and app-module preloads from competing with first installation.
4. On an existing installation, the Setup bootstrap trusts the committed local ready record and releases the boot gate without a blocking setup screen or full-package hash scan. The app opens from local files; one manifest comparison runs in the background every 48 hours, or immediately when Settings → Check for updates is requested.
5. Deferred execution order remains: bank data files (Nelson, All Once = Kasr Al-Ainy, Clinical Cases, Egyptian Book) → `js/09-app-features-v6.js` (core) → `10…34` features → `35…41` collections layer.

## The closed core (`js/09-app-features-v6.js`)
The file is one IIFE. State such as `QB`, `qs`, the search variables (`gq`, `gBank`, `gSpec`, `gTag`, `gSrc`, `gTopic`, `gSys`, `gSort`, `gLim`) and helpers such as `nz` live inside it and are **not visible** to other scripts. Scripts 13, 35 and 41 reach it only through `window.__SHB_BRIDGE` (`qs, SYS, QB, sysIcon, isPinned, answeredCount, TOPIC_ICON_ASSET, REC, SPEC_NAME, inTopic, topicIcon, topicCards`). To expose something new, add it to the bridge block.

## Layering by wrapping
Later scripts replace global view functions with a wrapper that calls the previous one (`const _old=fn; fn=function(){ … _old.apply(this,arguments) … }`):
- `35-pediatrics-collections.js`: `subjectsView`, `specialtiesView`, `topicsView`, `openSpec`, `openTopic`, `openQ`, bridge `inTopic`, `topicIcon`, `topicCards`.
- `41-collections-integration.js`: `navBack`, system display names, and `searchView` (folds the secondary filters into one "Filters" panel).
When two scripts wrap the same function, the one loaded last runs outermost.

## Question banks
Each question carries one flag that decides its bank (`bankOf` in the core, checked in this priority order):

| flag | bank |
|------|------|
| `nl` | Nelson Textbook |
| `py` | Previous Questions |
| `eb` | Egyptian Book |
| `cc` | Clinical Cases |
| `ao` | Kasr Al-Ainy (the data folder and ids still say "all-once") |
| none | Dr. Al-Joaki |

## Search
One normaliser, `nz` (lower-case, strip Arabic diacritics/tatweel, unify أ/إ/آ→ا, ى→ي, ة→ه), is meant to be used by the global Search, Saved, Wrong, Notes, Pinned & Recent and Smart Review. `tests/search-normalize.test.mjs` checks it against the real source.

## Offline / releases
- `pwa-version.json` is the app release version source of truth; `package.json` must match it. The package CacheStorage name and IndexedDB database/stores are intentionally stable across releases to preserve offline files and all To Me student data.
- `npm run build:pwa` inventories every copied output file (not just scripts) into `offline-assets-manifest.json`, with file size, SHA-256 and a group. The manifest itself is stored separately to avoid self-reference.
- `js/29-offline-setup.js` is the single installer/update engine: `install` for first setup, `update` into staging, and targeted `repair` for files found missing. It owns the 48-hour/manual schedule; `js/32-chrome-android.js` keeps only the Settings UI and safe-reload bridge, not another polling timer.
- `vercel.json` serves `sw.js`, the manifest and version files with `Cache-Control: no-cache` so scheduled/manual checks can compare the latest manifest.

## Checks
`npm run test:unit` (node:test), `npm run check:bank` (ids, answer keys, syntax of every script), `npm run build:pwa`. The `PWA checks` workflow runs all three on every push to a non-main branch and on pull requests.

## Additional independent Pediatrics banks
- Bank 07, Clinical Case: data/clinicalCaseBank.json, **system → topic → questions** (a topic opens straight to its questions; every case's shared history is shown once before that case's questions).
- Bank 08, AI Generated: the 16 JSON files in data/ai-generated/, system → topic → questions.
- Both use separate local answer stores.
- One design for every bank: Banks 07 and 08 render the **same markup and classes as the Dr. Al-Joaki bank** (`.card.sc.spc.ped-system-card` for systems, `.card.sc.tpc` for topics, Back button first, then kicker, title and sub-line). The large icons come from `window.__SHB_BANK_ICONS__.system(name)` / `.topic(systemName, topicName)`, defined in `js/42-pediatrics-collection-polish.js`; they return the same `sysIcon(...,'lg')` / `.tno.ti` markup the core uses, so the core CSS sizes them identically. Change icon size once in the core CSS and every bank follows.
