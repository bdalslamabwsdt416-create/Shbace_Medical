# 2026-11-10 — Android APK build pipeline

- Patch ID: APK-BUILD-2026-11-10
- Target branch: `apk-v1.1-copy-20261110`
- Base branch: `version-1.1`
- App version: **1.1** (package metadata: 1.1.0)

## Purpose

Record the Android-specific packaging and CI setup without mixing it into the PWA release.

## Files introduced or changed

- `.github/workflows/android-debug-apk.yml` — GitHub Actions workflow for Android debug APK builds.
- `capacitor.config.json` — Capacitor app identity, web output directory, Android scheme, and native plugin configuration.
- `package.json` — Capacitor dependencies and Android debug build script.
- `android/app/src/main/res/values/strings.xml` — Android application display strings.
- `js/04-app-main.js` and its staged counterpart `www/js/04-app-main.js` — app startup adjustment.

## Exact behavior

- Uses JDK 21, Android SDK platform 36/build tools 36.0.0, Gradle setup, and Node.js 22.
- Installs Capacitor dependencies, syncs web assets into Android, and runs `:app:assembleDebug`.
- Uploads the generated debug APK as a GitHub Actions artifact named `Shbace-Medical-APK-v1.1`.
- Uses Capacitor app ID `com.shbace.medical` and app name `Shbace Medical`.

## Validation note

The workflow currently runs `node --check js/29-reviewed-bank-controls.js`. Confirm that this file exists on this APK branch before relying on the workflow; if the APK branch intentionally excludes reviewed-bank controls, remove that one check in a separate, explicitly documented workflow-fix patch.

## Must remain unchanged

- PWA-only offline installer and PWA packaging configuration.
- Original question bank.
- App version **1.1**.

## Commit(s)

This file documents the branch's existing APK setup; it does not replace the source files.
