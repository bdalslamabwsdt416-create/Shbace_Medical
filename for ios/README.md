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

## iPhone and iPad PWA experience

- Install Shbace Medical from Safari with Share → Add to Home Screen, then open the home-screen app.
- The first offline package download starts in the background after the splash; the app is not covered by a full-screen setup dialog. A compact progress chip reports installation, repair, update, or retry status.
- The app serves verified local files first. Missing files can use a bounded network fallback while the offline package is repaired.
- First installation and repairs download the required files in the background. Updates are staged separately, checked by byte size and SHA-256, then committed together before the app performs one safe restart.
- Automatic update checks remain on the seven-day schedule; Settings → Check for updates remains available at any time.
- The existing iOS Cache Storage name (`shbace-medical-offline-v2`), IndexedDB database (`shbace-medical-offline-state-v1`), iOS home-screen icon, onboarding screens, and student progress stores are retained.
