# 2026-11-11 — Pre-splash iOS resource setup

- Patch ID: IOS-1.4.5-PRE-SPLASH-RESOURCES
- Target branch(es): `ios/v1.4.5-pre-splash-resources-20261111`
- Base version: 1.4.4
- Source commit: `d2ba9f3a2a371a7ac779cfc364e9880c186efa84`
- App version: 1.4.5

## Purpose

Move the verified one-time offline resource download to the first screen of an installed iOS PWA, before the startup splash and application boot.

## Files affected

- `for ios/index.html`
- `for ios/js/29-offline-setup.js`
- `for ios/sw.js`
- `for ios/pwa-version.json`
- `for ios/scripts/restore-ios-packed.js`

## Exact changes

- Detect standalone Home Screen launches before first paint and hold the splash/app boot behind an offline-setup gate.
- Load the existing verified installer before the splash markup.
- After the resource package is downloaded and integrity-verified, require the user to tap Done before showing the splash.
- Skip the gate automatically when the current offline package is already present and verified.
- Bypass stale service-worker cache entries when fetching the current manifest and resource files.
- Regenerate the offline manifest identity from the exact deployed file inventory and hashes.
- Bump the iOS PWA release to 1.4.5.

## Must remain unchanged

- Question bank content, answer history, bookmarks, notes, and other local study data.
- Existing splash artwork, ECG animation, onboarding, and application navigation.
- Android APK and the non-iOS PWA release branches.

## Validation / test results

- Git branch diff reviewed against the 1.4.4 source baseline.
- Vercel production build passed; build log confirms 236 offline assets were verified.
- Live production checks returned HTTP 200 for the app shell, `pwa-version.json`, service worker, installer script, and offline asset manifest.
- Confirmed live HTML places the offline installer before `#startupSplash`, uses the `shbcheck` cache-bypass query, and holds app boot behind the gate.
- Confirmed live release metadata is 1.4.5 and the offline manifest contains 236 assets.
- Real iPhone Home Screen first-install interaction test: not performed from this environment; requires a physical iPhone/iPad.

## Commit(s)

- Final source commit: `d02f04c01a76ee3079ff394fd6863b63fce9758e`
- Production deployment: `dpl_DcdNjr6B15L452KZ4zPF9FT1212Q` (READY)
- Production domain: `https://shbace-medical-ios.vercel.app/`
