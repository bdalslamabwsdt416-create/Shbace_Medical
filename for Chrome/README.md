# Shbace Medical — Chrome Android PWA

This folder is the dedicated Google Chrome on Android delivery. Its application UI, question-bank content and shared features are synchronized from the latest `to me/` source, while the delivery remains Android-Chrome-only.

## First launch and start-up

1. The cinematic Splash and ECG render first.
2. The offline installer starts during Splash and waits for the Splash completion event before showing Setup.
3. On a first installed-app launch, Setup downloads the complete offline package: app modules, styles, onboarding resources, question-bank data, images and other required assets. Each file is checked by byte size and SHA-256.
4. The app boot loader waits for the verified package before loading question-bank data or executing the deferred app modules. The verified first-install flow then opens the app.
5. Returning installations use the committed local package and open without a blocking Setup screen or a full-package hash scan.

A normal browser tab is not treated as an installed offline app. The Chrome bridge and app-specific install controls are enabled only on Android Chrome, and Capacitor builds continue to use their signed local assets.

## Updates

- One updater owns scheduled and manual checks. It checks the manifest every 48 hours, or when the student chooses **Settings → App updates → Check for updates**.
- It compares manifest hashes and downloads only missing or changed files. Three workers download in parallel; network timeouts, stall detection and retries keep interrupted work recoverable.
- Update files are staged and verified before they are committed to the live package. Applying an update uses the app's safe-reload bridge so an active question-bank session is not interrupted.
- A successful local install opens directly. No setup screen, version poll or full-package hash scan runs on every launch.

## Protected Chrome Android storage

Do not rotate these identifiers during an ordinary release:

- Cache Storage: `shbace-chrome-offline-v1.3.4`
- IndexedDB: `shbace-medical-offline-state-v1`
- IndexedDB stores/records: existing `meta`, `verified`, `installed`, `staged` and legacy `ready` data are read or migrated by the offline engine.

The stable package cache lets the new installer adopt existing verified files and fetch only the files that changed. Existing localStorage preferences, answers, bookmarks, notes, quiz attempts and student progress remain on the same origin. The update process must not clear or recreate student-data stores.

## Release and build

- Current release: `1.3.10-chrome.2` (`1.3.10.2 · Chrome Android`).
- `pwa-version.json` is the release source of truth; `package.json` must match it.
- The Service Worker cache name must match `js/29-offline-setup.js` and remain stable.
- Run the following commands from this folder:

```bash
npm ci
npm run test:unit
npm run check:bank
npm run build:pwa
```

The build creates the static PWA in `www/` and generates `offline-assets-manifest.json` from the verified app files.

This folder is the Chrome Android web delivery only. Do not change the iOS, signed Android APK or the separate `to me/` source while maintaining this delivery.
