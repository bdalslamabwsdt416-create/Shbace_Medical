# Android Remote Content Trust and Rollback — v1

**Scope:** Android APK remote learning-content package only. This does not change the APK version or any student data store.

## Version policy

Each immutable content package now carries:

- `contentVersionCode`: a positive, monotonically increasing integer independent of Android's APK `versionCode`.
- `minAppVersionCode`: the minimum APK version code allowed to install the package.
- `channel`: currently `stable`.
- `releaseNotes`: human-readable package notes.

A candidate with a lower content version code is rejected. Reusing a content version code for a different version name is rejected. A new content version code cannot reuse the installed version name. A candidate whose minimum APK version exceeds the installed APK version is rejected. The legacy installed manifest (without a content version code) is treated as version code zero and can move forward once to the new scheme.

SHA-256 and exact byte-length checks still apply to every package file. The catalog must remain data-only; no remote JavaScript, HTML, CSS, dynamic imports, eval, or other executable configuration is accepted.

## Last-known-good and rollback

The native content manager stores:

- `current-manifest.json`: active package pointer.
- `previous-manifest.json`: pointer to the last-known-good package.
- `versions/<version>/`: verified content files.

During an upgrade, the currently active manifest is atomically saved as the last-known-good pointer before the new current pointer is switched. The updater retains the current and previous package folders. Rollback runs off the UI thread, verifies every stored file against its declared size and SHA-256, checks APK compatibility, then atomically activates the previous manifest. Rollback does not touch question answers, attempts, notes, bookmarks, pins, flashcards, timers, or other learning progress.

The legacy APK binary does not contain these new Java rollback and anti-downgrade routines. Those native protections become available on devices only after a future APK build containing this source is installed. This work keeps the published APK at `1.3.9 / 18` and does not replace the existing release asset.

## Signature status and limitation

The current manifest is **not cryptographically signed**. HTTPS authenticates the GitHub transport endpoint, and per-file SHA-256 verifies files against the downloaded manifest; neither proves that the manifest itself was authorized by SHBACE. A compromised repository or publishing credential could replace both a manifest and its listed hashes.

Signed-manifest enforcement is deliberately not enabled without a real private signing key stored in a protected GitHub Actions secret and a corresponding pinned public key embedded in a future APK. Never place the private key in the repository. Until key provisioning and signature verification are implemented and tested, describe the package as HTTPS-delivered and hash-verified, not signed.

## Frozen app baseline

- Package: `com.shbace.medical`
- APK `versionName`: `1.3.9`
- APK `versionCode`: `18`
- No change to the stable `android-v1.3.9` release or its APK/checksum is permitted during this work.
