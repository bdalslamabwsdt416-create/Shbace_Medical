# SHBACE Medical — Layout and file ownership

This folder is the standalone Chrome PWA. Keep runtime assets inside this folder and preserve the ordered, isolated JavaScript modules.

## Entry points and startup

- `index.html` owns the HTML shell, first-paint gate, splash markup, the ordered deferred-script list, and Service Worker registration.
- `js/04-app-main.js` owns the app routing and the startup splash. The splash is shown for each app document load; it is separate from the automatic update-check schedule.
- `js/29-offline-setup.js` owns first-time offline installation, restore detection, the offline manifest, staged updates, byte-size checks, SHA-256 checks, and the manual Settings check.
- `js/32-chrome-android.js` owns Chrome-specific PWA settings and the shared safe-reload gate. A worker activation alone does not reload the app; a reload is requested after the accepted offline package commits.

## CSS ownership

- `css/bundle-core.css` is the single core stylesheet loaded in the document head. Its source order is `core.css` → `android-v13.css` → `chrome-android.css`.
- `css/bundle-late.css` is the single late stylesheet loaded after the app shell. Its source order is `late.css` → `unified-enhancements.css` → `shbace-layout-refinements.css` → `egyptian-book.css` → `clinical-case-bank.css` → `ai-generated-bank.css` → `banks-07-08-parity.css`.
- The source CSS files are preserved under `_layers/css/original/`. They are archival only and must not be linked by `index.html` or copied into the PWA output.
- The two bank-specific files still own bank-specific selectors; `banks-07-08-parity.css` supplies their shared visual language. The combined bundle preserves the original cascade order.

## JavaScript ownership

- Runtime JavaScript remains in separate files under `js/`; do not combine all modules into one bundle.
- The script order in `index.html` is authoritative. Data files and large bank modules remain deferred so the splash can paint before heavy work begins.
- `js/33-clinical-case-bank.js` owns AI Clinical Cases navigation and case-group rendering.
- `js/33-ai-generated-bank.js` owns AI Generated navigation, rendering, and its independent progress store.
- `js/42-pediatrics-collection-polish.js` owns shared bank names and icon resolution.
- `js/35-*.js` through `js/41-*.js` are active modules. Never load similarly named root-level copies.

## Data, build, and checks

- `data/` contains the PWA data package and generated offline manifest inputs.
- `scripts/check-bank.mjs` validates bank data and JavaScript syntax.
- `scripts/check-root-duplicates.mjs` prevents a root-level `.js` or `.css` file from sharing a name with a file directly inside `js/` or `css/`.
- `scripts/build-pwa.mjs` builds the deployable `www/` directory and generates the byte-size and SHA-256 manifest.
- `tests/` contains the unit tests run by `npm run test:unit`.

## Archive policy

- `_layers/css/original/` stores the CSS sources used to create the two bundles.
- `_layers/root-duplicates/` stores the five obsolete root-level JavaScript copies removed from the active root.
- These archive paths are not loaded by the app and are not part of the PWA build allow-list. The Git branch `archive/stale-20261116` also retains the complete pre-consolidation tree.
