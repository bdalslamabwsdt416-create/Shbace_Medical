# SHBACE MEDICAL — OFFLINE SYSTEM DOCUMENTATION

## 1. Purpose and operating model

The PWA adds a user-started, one-time offline installation. The website can still be opened in Safari to install it through Share → Add to Home Screen. The bulk download is shown only after the app is opened from its Home Screen icon in standalone mode.

The installed app downloads the complete staged PWA package described by offline-assets-manifest.json. The inventory is generated from the actual www output directory, so it includes all staged HTML, CSS, JavaScript, JSON, web-manifest, Service Worker, question-bank, image and other copied files. It does not depend on the user visiting each screen or topic.

The setup is not called complete until all files are downloaded, checked, written to Cache Storage, read again, and SHA-256 verified.

## 2. Build-time inventory

Run the PWA build from the repository root:

    npm run build:pwa

The build script stages the current app into www, checks required inputs, validates the web manifest and question-bank JSON, copies local asset directories, verifies static image references and deferred scripts, then recursively lists the complete output.

For each staged file, the generated offline-assets-manifest.json records:
- Relative output path
- Byte size
- SHA-256 digest
- Resource group (application, images, data or other)

The version identifier is a SHA-256 digest of the sorted paths and their file hashes. The generated manifest is self-checked for count, total size and version consistency. The manifest does not include itself in its own file list.

Optional source directories named fonts, audio, media, videos and documents are copied when present. Current image folders img, img1 and img2 are collected into www/assets/img.

The build also runs a static scan for common absolute external asset, CSS, fetch and Worker URLs. This is a useful audit, not a complete proof: dynamically constructed URLs and runtime-only API calls still need a browser network inspection.

## 3. Storage architecture

### Cache Storage

Cache Storage cache name: shbace-medical-offline-v2.

It stores the actual static application resources, the generated manifest, and a small ready marker. The Service Worker installs a minimal app shell first so that the setup interface can start.

### IndexedDB

Database name: shbace-medical-offline-state-v1.

Object stores:
- meta — setup progress and final verified-package record
- verified — per-file path, package version, size, SHA-256 digest and verification timestamp

A file is recorded as verified only after its response succeeds, its byte size matches the generated inventory, its SHA-256 digest matches, Cache Storage accepts the write, and the IndexedDB verification record is saved.

### Existing student data

The offline installer does not rename, clear or migrate the existing study-data keys. Question answers, bookmarks, notes, reports, Smart Review and settings remain in the app's existing local storage systems. Local Storage is not used for the question bank or large asset files.

## 4. First-time installation

1. Open the production website in Safari on iPhone.
2. Use Share → Add to Home Screen.
3. Open Shbace Medical from the new Home Screen icon.
4. The setup screen checks whether the installed standalone context is available.
5. The setup screen loads the generated offline manifest and checks existing local files.
6. Tap Start one-time download. Keep the app open and connected to the internet.
7. Two download workers process files in parallel. Each file is checked for HTTP success, byte count and SHA-256, then written to Cache Storage and recorded in IndexedDB.
8. The setup checks all stored files again, including reading them back and verifying their SHA-256 digests.
9. Only after every file passes does the setup write the ready record and ready marker, and display 100% completion.

The percentage is based on verified file count. The byte total comes from the build inventory. Failed HTTP responses, mismatched sizes, failed hashes, failed cache writes and storage quota errors are not counted as completed downloads.

## 5. Resume and manual recovery

The download is resumable. When setup is reopened, each candidate file is checked in Cache Storage and re-hashed. Files that are present and valid are skipped; missing or invalid files are downloaded again. Each file gets up to three attempts.

If the download stops, already completed files are retained. The app does not clear the whole cache, erase the question bank, or reset student progress. The user can reconnect and tap Retry.

If a later application build has a different manifest version, the local package is not silently updated. The setup reports that a restore is needed and waits for the user to start it while online.

If files are missing after a previously completed installation, the ready state is not trusted. The setup screen is shown and the user is offered a manual restore. No automatic content refresh or background synchronization is created by this implementation.

## 6. Service Worker behaviour

The Service Worker uses cache-first for same-origin GET requests.

Before the full package is verified, it may use the network and store successful same-origin responses as a convenience. After the ready marker exists, same-origin app resources must come from the local cache. If a required same-origin resource is missing, the Service Worker returns an explicit 503 offline-resource error rather than silently trying the network.

External-origin requests are not intercepted by this same-origin worker. A feature that genuinely depends on a remote API or third-party service is not made offline merely by caching static files; it must be documented and tested separately.

The existing scheduled daily system-notification code uses the Capacitor Local Notifications plugin. In a plain browser/PWA context that native plugin is unavailable and that scheduler intentionally does nothing. The in-app notification centre opened by the header bell remains an app-local screen; background OS notifications in the PWA are not claimed by this implementation. Enabling web push or scheduled browser notifications would require a separate browser-specific design and may add platform or server requirements.

The page reuses an existing Service Worker registration and only registers one when no registration exists. The app does not add periodic update polling, background sync, periodic sync, or timed content-update jobs. Browser-managed Service Worker lifecycle checks remain under iOS/Safari control and cannot be disabled by application code.

## 7. Storage durability and iOS constraints

The setup requests persistent storage using navigator.storage.persist() when supported and reports the result. It also checks navigator.storage.estimate() when the browser exposes it.

A granted persistent-storage request is not a guarantee that iOS will retain all website data indefinitely. Safari/iOS controls storage eviction and may clear website data under device, policy or user conditions. Keep JSON backups of student progress.

The app does not claim that iOS background downloads are supported. The user must keep the installed PWA open and connected during the first download. Closing or suspending the app may pause or interrupt the session; reopen and resume the setup.

## 8. Question Bank and interface changes

- The Question Bank layout selector remains inside the Question Bank view, where Single and All are already available.
- The duplicate Question Bank layout selector was removed from Settings.
- Notifications were removed from the drawer to avoid duplication. The header bell remains the single in-app entry point to the notification centre.
- The grade selected in the preceding onboarding step is read-only on the final completion screen.
- The completion screen uses normal text flow and allows vertical scrolling on compact screens, instead of forcing text to overlap the artwork.

## 9. Latest validated PWA build

The GitHub Actions PWA bundle job completed successfully for application commit 25f1724f6442fc1ef14bf70bc66bd5943ecb4f18. The build output reported:

- 221 inventoried offline resources.
- 14,534,855 total bytes (13.86 MiB) before ZIP compression.
- 186 copied local images, with 186 image references verified.
- 29 deferred JavaScript files verified.
- Question-bank JSON size: 1.35 MiB.
- Static external runtime-reference scan: 0 matches for the scanner's configured patterns.
- Offline manifest version: 52b1fa628b329bf9dbaede531cfd0ecea3a28691308469b4e2fe2622a6c6b88a.

The build generated and uploaded the Shbace-Medical-PWA.zip artifact. The zero-match external-reference result is limited to the build script's static patterns; it is not proof that dynamically constructed requests or remote service features are fully offline.

## 10. Verification checklist

The PWA build script performs static checks for required inputs, manifest validity, question-bank JSON validity, staged deferred scripts, referenced local images, and the generated offline inventory. Its external URL scan is a heuristic and must be supplemented by runtime inspection.

These tests still require an actual installed PWA on an iPhone, including the target iPhone 13:

- Install from Safari using Share → Add to Home Screen and launch the icon in standalone mode.
- Confirm the setup screen fits the viewport and scrolls correctly.
- Complete the initial package download and note the generated file count and total bytes.
- Interrupt the download, close and reopen the app, and confirm valid completed files are skipped.
- Complete verification, enable Airplane Mode, force-close the PWA and relaunch it.
- Open several subjects and topics that were not opened before the download.
- Exercise question rendering, answers, explanations, search, filters, quizzes and results.
- Open image-heavy screens and verify images, backgrounds, icons and fonts.
- Change theme and settings, save study progress, close the PWA and reopen it.
- Test missing-file recovery, insufficient storage and denied persistent-storage behaviour.
- Inspect runtime network requests while offline and record any remaining external-origin calls.

Do not report an iPhone test as passed until the test has actually been run on a physical iPhone.
