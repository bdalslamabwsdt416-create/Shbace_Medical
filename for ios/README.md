# Shbace Medical

Shbace Medical is a medical-learning application with a question bank, topic-based practice, explanations, progress tools, and dedicated Android/PWA delivery paths.

## Repository layout

- `index.html`, `css/`, `js/`: shared web-app runtime. Their root-relative paths are intentional.
- `assets/img/`: one canonical image directory for all runtime image URLs (`/assets/img/…`).
- `data/`: original and reviewed question-bank JSON files. The original bank is preserved separately; audit exports are in `data/audit/`.
- `android/`: native Android/Capacitor project. It stays at the repository root for compatibility with the existing Gradle and Capacitor workflow.
- `branding/`: source and store-branding artwork.
- `tools/`: source/build validation utilities.
- `tests/permissions/`: repository permission test notes.
- `docs/updates/`: dated change notes.
- `build/reports/`: generated build reports.

## Base and delivery versions

This branch is a reorganized working copy based on `main`. The original `version-1.1` branch remains untouched. Existing APK/PWA build and release branches are retained separately; this reorganization does not merge, rewrite, or replace those delivery branches.

## Safe-change rules

1. Keep `data/qbData.json` as the immutable original question bank.
2. Put review edits in `data/qbData_reviewed.json` and keep review logs separate.
3. Keep Android-native files in `android/`; do not mix them with PWA-only files.
4. Do not rename runtime assets without updating every reference in HTML, CSS, and JavaScript.
5. Remove an asset only after confirming it is identical to another file and that the canonical copy remains at its expected path.

## Offline storage integrity and recovery

- Cache Storage is verified against the current offline asset manifest by byte count and SHA-256. The verification record in IndexedDB is metadata, not proof that a cached file is bad when that record is missing.
- If installation metadata is missing, the installer rechecks saved Cache Storage files and rebuilds its installation records from valid local files before downloading anything.
- Repairs fetch only files that are actually missing or fail integrity verification. A valid cached response is not deleted merely because an IndexedDB verification record was lost.
- The installer requests persistent browser storage, waits for the result, and exposes the current storage diagnosis through `window.shbaceStorageDiagnostics()` and `window.__SHBACE_STORAGE_DIAGNOSTICS__`.
- Regression scenarios are documented in `tests/offline-package-recovery.md`.

## iPhone and iPad PWA experience

- Install Shbace Medical from Safari with Share → Add to Home Screen, then open the home-screen app.
- During the first installation, the installer prepares the manifest and local storage while the ECG splash is visible. The full-screen Setup screen appears immediately after the splash and owns the complete package download and integrity verification.
- App modules, onboarding scripts, and question-bank data remain deferred until first-install verification succeeds, so they do not compete with Setup for network bandwidth or startup resources.
- After the first installation, the app opens from the saved local package. Repairs and updates run in the background with a compact progress chip; updates are staged, checked by byte size and SHA-256, then committed together before one safe restart.
- Automatic update checks run every 48 hours; Settings → Check for updates can trigger a manual check at any time.
- The existing iOS Cache Storage name (`shbace-medical-offline-v2`), IndexedDB database (`shbace-medical-offline-state-v1`), iOS home-screen icon, onboarding screens, and student progress stores are retained.
