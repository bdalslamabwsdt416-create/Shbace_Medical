# 2026-11-10 — PWA offline installation and release pipeline

- Patch ID: PWA-OFFLINE-2026-11-10
- Target branch: `release/pwa-v1.1-20261110`
- Related working branch: `pwa-v1.1-copy-20261110`
- Base branch: `version-1.1`
- App version: **1.1** (PWA metadata: 1.1.0)

## Purpose

Record the PWA-specific one-time offline installation, package inventory, and release workflow. These changes must not be copied into the APK branch as PWA behavior.

## Files introduced or changed

- `js/29-offline-setup.js` — first-run offline download, resume, cache verification, and setup UI.
- `sw.js` — same-origin offline cache behavior and ready-state handling.
- `manifest.webmanifest` — installable PWA metadata.
- `pwa-version.json` — PWA release metadata, kept at 1.1.0.
- `scripts/build-pwa.mjs` — stages the web app, validates inputs/assets/scripts, and generates a SHA-256 offline asset inventory.
- `package.json` — PWA build command and required build dependencies.
- `.github/workflows/pwa-bundle.yml` — builds and uploads a versioned PWA ZIP artifact.
- `OFFLINE_SYSTEM_DOCUMENTATION.md` — installation, storage, recovery, and platform limitations.
- `css/late.css`, `index.html`, and selected shared UI scripts — responsive onboarding and PWA setup integration.
- `.gitignore` — build output exclusions.

## Intended user experience

- User adds the website to the iPhone Home Screen through Safari.
- The full offline package download is initiated by the user from the installed standalone app.
- Files are inventoried at build time and checked by byte size and SHA-256.
- Download progress can resume; already valid files are not downloaded again.
- The app does not claim background iOS downloads, automatic content refresh, or guaranteed permanent iOS storage.

## Build and artifact

- Build command: `npm run build:pwa`
- ZIP artifact: `Shbace-Medical-PWA-v1.1.zip`
- Workflow artifact retention: 90 days.
- The documented successful build reported 221 offline resources and 14,534,855 bytes; this is historical build evidence, not a claim that a fresh build has been run during this documentation update.

## Must remain unchanged

- Android-only build behavior and APK-specific configuration.
- Original question bank and student progress storage.
- App version **1.1**.

## Validation / limitations

The build script performs static checks for required files, JSON, web manifest, image references, deferred scripts, and common external URL patterns. These checks do not prove every dynamic request or third-party feature works offline. First-time installation requires the app to remain open and connected; iOS may suspend downloads or evict website data.

## Commit(s)

This file documents the PWA branch's existing implementation; it does not replace the source files.
