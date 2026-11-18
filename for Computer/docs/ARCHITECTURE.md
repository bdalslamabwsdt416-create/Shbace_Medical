# Architecture notes — Computer PWA

This folder is the dedicated desktop/laptop Chrome PWA delivery. Its shared application behavior is synchronized from `to me/`, while the install identity, wide-screen layout and browser preferences remain Computer-specific.

## Startup and first installation

1. `index.html` paints the Splash first (`#startupSplash`, ECG drawn by a Worker on an OffscreenCanvas).
2. The standalone `js/29-offline-setup.js` bootstrap creates `window.__SHBACE_OFFLINE_BOOT_PROMISE__`. On the first installed-app launch it waits for the Splash completion event, displays Setup, downloads the complete `offline-assets-manifest.json` package and verifies every file by byte size and SHA-256.
3. The boot loader waits for that promise before loading/assembling question-bank data or preloading/executing deferred app modules. This prevents first-install downloads from competing with the question-bank fetch and app-module preloads.
4. After the verified first install, the Setup flow releases the boot gate. Returning installations trust the committed local ready record and open without a blocking Setup screen or a full-package hash scan.
5. The Service Worker is registered after the first complete package has been committed. It serves cached local files first and fetches/caches only genuinely missing resources. The installer owns manifest/version checks and update staging.
6. Deferred app execution remains in document order: bank data and shared utilities → core app → feature scripts → Pediatrics/collections and integration scripts, including `js/44-islamic-reminders.js`.

The offline package installer applies to the installed Computer PWA. A normal browser tab is not treated as the installed offline app, and Capacitor continues to use its signed local assets.

## Computer-specific browser identity

- `window.__SHBACE_CHROME_COMPUTER__` is enabled only for Chrome on a non-mobile browser and outside Capacitor.
- `manifest.webmanifest` retains the Computer name, standalone display mode and desktop install identity.
- `css/chrome-computer.css` remains loaded after the shared consolidated styles to preserve the wide-screen Computer layout.
- `js/32-chrome-android.js` retains the shared Chrome install/fullscreen/settings bridge. For Computer, the Screen Wake Lock preference continues to use `shbace_computer_features_v1`; Android's preference key is not substituted.

## Offline storage and updates

Keep these identifiers stable for routine releases:

- Cache Storage: `shbace-computer-offline-v1.3.4`
- Staging Cache: `shbace-computer-staging-offline`
- IndexedDB: `shbace-medical-computer-offline-state-v1`
- IndexedDB stores: existing `meta` and `verified`; the `installed`, `staged`, legacy `ready` and per-file verification records are maintained by the offline engine.

The existing Computer cache and database are adopted rather than cleared or renamed. This preserves locally stored app files and all student preferences, answers, bookmarks, notes, attempts and progress on the Computer origin.

`js/29-offline-setup.js` is the single install/update engine. It uses three workers, timeouts, stall detection and bounded retries; interrupted verified files remain reusable. It stages changed files, checks their byte size and SHA-256, and commits the package safely. It checks the manifest every 48 hours or when the student manually requests an update from Settings. It does not run a full-package hash scan on every launch.

`js/32-chrome-android.js` supplies the Settings UI, Computer install/fullscreen behavior and safe-reload bridge. It must not add another automatic version poller or periodic timer.

## Application core and question banks

The shared core (`js/09-app-features-v6.js`) is a closed IIFE. State such as `QB`, `qs`, search variables and internal helpers are not global. Extension scripts use `window.__SHB_BRIDGE` for the supported shared functions and state.

The deferred execution order matters: bank data and base helpers → core app → feature scripts → collection/navigation integrations. Keep the order in `index.html`; do not bypass the startup boot gate.

Question-bank identifiers remain independent: Nelson Textbook (`nl`), Previous Questions (`py`), Egyptian Book (`eb`), Clinical Cases (`cc`), Kasr Al-Ainy (`ao`), and the original Dr. Al-Joaki bank (no bank flag). The Pediatrics Clinical Case and AI Generated banks retain their separate source data and progress stores.

## Build and validation

Run from `for Computer/`:

```bash
npm ci
npm run test:unit
npm run check:bank
npm run build:pwa
```

The build validates the dedicated Computer release identity and stable cache, checks the Computer stylesheet and manifest, syntax-checks parser-loaded and deferred scripts, and regenerates the full offline manifest with file sizes and SHA-256 hashes.

Do not change the root Android project, `for Chrome/`, `for ios/` or `to me/` when maintaining this Computer delivery.
