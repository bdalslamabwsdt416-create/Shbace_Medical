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
- During the first installation, the installer prepares the manifest and local storage while the ECG splash is visible. The full-screen Setup screen appears immediately after the splash and owns the complete package download and integrity verification.
- App modules, onboarding scripts, and question-bank data remain deferred until first-install verification succeeds, so they do not compete with Setup for network bandwidth or startup resources.
- After the first installation, the app opens from the saved local package. Repairs and updates run in the background with a compact progress chip; updates are staged, checked by byte size and SHA-256, then committed together before one safe restart.
- Automatic update checks run every 48 hours; Settings → Check for updates can trigger a manual check at any time.
- The existing iOS Cache Storage name (`shbace-medical-offline-v2`), IndexedDB database (`shbace-medical-offline-state-v1`), iOS home-screen icon, onboarding screens, and student progress stores are retained.


## Basic Usage Analytics
The iOS PWA build includes the canonical Basic Usage Analytics client from `../to me/js/54-usage-analytics.js` at build time. Keep the source shared; do not copy a second maintained implementation into this folder. Its installation UUID and bounded offline queue use dedicated LocalStorage keys, separate from the app's IndexedDB study data and offline updater state. The Service Worker does not intercept analytics POST requests.

A separately hosted iOS PWA needs the build-time `SHBACE_ANALYTICS_API_BASE_URL` variable set to the approved HTTPS API origin in its hosting project; the build injects it before the analytics runtime executes, and its exact origin must be included in the API deployment's `ANALYTICS_ALLOWED_ORIGIN` allowlist. Until that route and allowlist are configured, events remain queued. Storage is origin-scoped. A Home Screen web app launched in standalone mode is separate from a Safari tab and is exempt from Safari tab's seven-day script-writable storage deletion rule, but WebKit can still evict best-effort origin data under storage pressure and users can clear it. Analytics and student stores have separate namespaces, not separate OS eviction boundaries; origin eviction can remove both. Do not depend on Background Sync or background JavaScript on iOS; retries occur when the app returns online or to the foreground. On iOS 26/iPadOS 26, verify the user's Home Screen 'Open as Web App' choice. No actual iPhone/iPad device test is implied by the automated tests.
