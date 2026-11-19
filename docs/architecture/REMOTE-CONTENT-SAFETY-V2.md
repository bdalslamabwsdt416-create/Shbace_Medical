# Android Remote Content Safety v2

## Scope

This change hardens the Android remote learning-content package only. It does not execute remote JavaScript, HTML, scripts, or other code. Remote configuration remains declarative JSON data.

## Manifest policy

The manifest keeps the compatible `shbace-android-content-v1` schema and adds:

- `contentVersionCode`: positive, monotonically increasing integer independent of the APK version.
- `minAppVersionCode`: lowest Android APK versionCode allowed to install the package.
- `channel`: one of `stable`, `beta`, or `development`.

The current package is content version `1.0.3`, contentVersionCode `3`, minimum app versionCode `18`, on the stable channel. The APK remains versionName `1.3.9`, versionCode `18`.

A candidate package with a lower contentVersionCode is rejected. A different package version cannot reuse the installed contentVersionCode. Re-publishing changed files under the same content version is rejected by the existing same-version digest comparison.

## Last-known-good and rollback

Before switching current-manifest.json, the updater atomically saves the prior manifest as previous-manifest.json. Its version directory is retained by the two-version retention policy.

Rollback is exposed through the native bridge method `restorePreviousRemoteContent()`. Before changing the active manifest, the updater verifies every previous file's declared byte count and SHA-256 digest. The rollback operation only switches the active content manifest; it does not alter student progress, quiz answers, attempts, notes, bookmarks, Smart Review schedules, or other local study data.

The native state response exposes `lastKnownGoodVersion` and `canRollback`.

## Validation and release workflow

The content validator requires the new manifest metadata and verifies the catalog, file sizes, and SHA-256 hashes. The content validation workflow now runs on pull requests targeting main as well as its existing push triggers.

## Security boundary and remaining prerequisite

Per-file SHA-256 checks detect corruption relative to the manifest, but they do not authenticate the manifest itself. HTTPS and the repository's access controls remain the current source trust boundary.

Cryptographic manifest signatures are intentionally not claimed as active in this change. Enabling fail-closed signature verification requires a real private signing key stored only in GitHub Actions secrets and a corresponding public key pinned in the Android APK. The private key must never be committed to the repository. Until that key provisioning and verification path are implemented and tested, the manifest is not cryptographically signed.

## Delivery limitation

Changes to RemoteContentManager.java and ShbaceNative.java are Android native code. They are included in repository/CI builds but are not present in an already-installed APK until a future authorized APK build is installed. This work does not publish or replace the frozen 1.3.9 / 18 release.
