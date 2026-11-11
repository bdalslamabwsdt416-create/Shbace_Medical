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
- Production build and live deployment checks: pending.
- Real iPhone Home Screen first-install test: pending.

## Commit(s)

- Source updates are committed on the target branch; final deployment commit to be recorded after the production build is verified.
