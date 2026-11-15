# Architecture notes (to me/ PWA)

Short map of how the app is put together, so the next change does not need a full read of the 420 KB core script.

## Start-up
1. `index.html` paints the splash first (`#startupSplash`, ECG drawn by a Worker on an OffscreenCanvas).
2. The boot loader (`shb-boot-v1`) fetches the question bank JSON in parallel, then runs every `<script type="text/shb-deferred">` **one after another in document order**.
3. Order matters: bank data files (Nelson, All Once = Kasr Al-Ainy, Clinical Cases, Egyptian Book) → `js/09-app-features-v6.js` (core) → `10…34` features → `35…41` collections layer.

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
- `pwa-version.json` is the version source of truth; `package.json`, `sw.js` (`CACHE_NAME`) and `js/29-offline-setup.js` must carry the same number.
- `npm run build:pwa` regenerates the offline manifest (file sizes + SHA-256); installed copies download only the files whose hash changed.
- `vercel.json` serves `sw.js`, the manifest and the version files with `Cache-Control: no-cache` so updates are seen immediately.

## Checks
`npm run test:unit` (node:test), `npm run check:bank` (ids, answer keys, syntax of every script), `npm run build:pwa`. The `PWA checks` workflow runs all three on every push to a non-main branch and on pull requests.

## Additional independent Pediatrics banks
- Bank 07, Clinical Case: data/clinicalCaseBank.json, **system → topic → questions** (a topic opens straight to its questions; every case's shared history is shown once before that case's questions).
- Bank 08, AI Generated: the 16 JSON files in data/ai-generated/, system → topic → questions.
- Both use separate local answer stores.
- One design for every bank: Banks 07 and 08 render the **same markup and classes as the Dr. Al-Joaki bank** (`.card.sc.spc.ped-system-card` for systems, `.card.sc.tpc` for topics, Back button first, then kicker, title and sub-line). The large icons come from `window.__SHB_BANK_ICONS__.system(name)` / `.topic(systemName, topicName)`, defined in `js/42-pediatrics-collection-polish.js`; they return the same `sysIcon(...,'lg')` / `.tno.ti` markup the core uses, so the core CSS sizes them identically. Change icon size once in the core CSS and every bank follows.
