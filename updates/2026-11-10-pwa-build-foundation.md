# 2026-11-10 — PWA build and staging foundation

- Patch ID: PWA-BUILD-FOUNDATION-2026-11-10
- Target branch: `task1-onboarding-pwa-build-2026-11-10`
- Base branch: `version-1.1`
- App version: **1.1**

## Purpose
Record the PWA build/staging foundation separately from the later offline first-run installer.

## Files introduced or changed
- `.github/workflows/pwa-bundle.yml` — PWA build and ZIP artifact workflow.
- `scripts/build-pwa.mjs` — stages web assets and validates the PWA package.
- `manifest.webmanifest` — installable web-app metadata.
- `sw.js` — service-worker integration.
- `package.json` — build script/dependencies.
- `index.html`, `js/04-app-main.js`, `js/19-ob-shared-bg-v1-js.js` — PWA entry-point and shared UI integration.
- `capacitor.config.json`, Android Gradle and build workflow files — native packaging support retained on this working branch.
- `tools/ANDROID_BUILD.md`, `.gitignore` — build notes and generated-file exclusions.

## Scope boundary
This branch is the PWA build/staging foundation. Do not treat it as proof that the later complete one-time offline download and integrity-verification UI is present; that work is documented in the separate offline-installer patch.

## Must remain unchanged
- Original question bank and student progress.
- App version **1.1**.
- APK-only configuration must not be replaced by PWA-specific runtime behavior.

## Validation
The PWA build workflow and script define package checks. A fresh build/test must be run to claim current validation.

## Commit(s)
Documentation of the existing branch state; no application source files replaced.
