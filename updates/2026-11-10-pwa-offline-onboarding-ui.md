# 2026-11-10 — PWA offline onboarding and responsive UI

- Patch ID: PWA-OFFLINE-UI-2026-11-10
- Target branch: `fix/pwa-offline-onboarding-ui-20261110`
- Base branch: `version-1.1`
- App version: **1.1**

## Purpose
Record the follow-on PWA offline setup and onboarding/UI corrections.

## Files introduced or changed
- `js/29-offline-setup.js` — user-started offline setup flow and local package verification.
- `sw.js` — offline service-worker behavior.
- `manifest.webmanifest` — PWA install metadata.
- `scripts/build-pwa.mjs` and `.github/workflows/pwa-bundle.yml` — build validation and bundle generation.
- `OFFLINE_SYSTEM_DOCUMENTATION.md` — offline architecture, recovery, and iOS limitations.
- `css/late.css`, `index.html`, `js/04-app-main.js`, `js/09-app-features-v6.js`, `js/19-ob-shared-bg-v1-js.js`, `js/20-drawer-order-v12.js` — responsive onboarding and UI integration.
- `package.json`, `.gitignore`, `capacitor.config.json`, Android build files and `tools/ANDROID_BUILD.md` — build support.

## Intended behavior and limitations
- User installs the website from Safari to the iPhone Home Screen, then opens the standalone app to start the one-time offline download.
- Offline files are staged and verified before setup is marked complete.
- Download resume and recovery are supported by the implementation.
- This does not guarantee iOS will retain website storage indefinitely, and it does not claim reliable background downloads or automatic periodic content updates.

## Must remain unchanged
- Original question bank and student progress.
- App version **1.1**.
- APK-only release behavior.

## Validation
The source includes build-time checks. Device testing on Safari/iOS and a fresh PWA build are still required before claiming full runtime validation.

## Commit(s)
Documentation of the existing branch state; no application source files replaced.
