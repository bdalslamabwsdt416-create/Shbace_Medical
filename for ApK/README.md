# for ApK — Android-only package

This folder contains the Android-specific remote-content components kept separate from the shared SHBACE web/PWA source.

## Layout

- `native/com/shbace/medical/RemoteContentManager.java`: Android native content downloader, integrity checker, offline store, and version switcher. The Android Gradle project compiles this source through the source-set configured in `android/app/build.gradle`.
- `android-content/`: versioned remote content feed (manifest, catalog, validation rules, media, and question/flashcard data).

## Runtime integration

The Android host integration remains at its conventional Capacitor paths under `android/`, and the Android-only web runtime is loaded from `to me/js/45-android-remote-content.js`. Those entry points are guarded for native Android; iOS, Chrome, and computer/PWA clients do not activate this updater.

The APK reads the feed from `main/for ApK/android-content/manifest.json`. Content-only commits in this folder run validation and do **not** require an APK rebuild. Changes to the Android native helper or its integration trigger the Android build workflow.

## Current feed status

The initial feed is version `1.0.2` and is intentionally an empty template: its bank, system, resource, and flashcard arrays are empty. The remote engine is integrated into the APK, but existing medical banks and their media have not yet been migrated into this feed.
