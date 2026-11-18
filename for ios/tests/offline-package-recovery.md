# iOS PWA offline-package recovery regression tests

Run on a dedicated test iPhone/iPad with the PWA installed from Safari → Add to Home Screen. Back up student data before destructive test setup. Never clear the entire IndexedDB database during these tests: the same origin may contain student answers, bookmarks, notes, history, and progress.

## Diagnostics

Open the standalone PWA and inspect:

- `window.shbaceStorageDiagnostics()`
- `window.__SHBACE_STORAGE_DIAGNOSTICS__`
- Console entry `[Shbace storage diagnostics]`

The startup diagnosis must distinguish IndexedDB metadata missing, Cache Storage missing, and both missing. The report must include per-file verified / damaged / missing counts and persistent-storage grant status.

## Required scenarios

1. **Normal relaunch:** complete setup, close the PWA, terminate Safari/PWA, then reopen. The app must open from its saved package without the first-install Setup screen or a full package download.
2. **Lost installation metadata, intact Cache:** remove only the installer keys from the installer's `meta` / `verified` stores while preserving the Cache and all student-data stores. Reopen. The installer must hash the existing package against the current manifest, rebuild its metadata, and reuse every valid file. Expected download: zero package bytes.
3. **Lost per-file verification records:** keep the `installed` metadata and Cache, but remove selected `verified` records. Run the local repair / update check. Each cached file with a missing record must be checked by byte count and SHA-256 and re-recorded; valid files must not be downloaded.
4. **One missing cached file:** keep the IndexedDB install record, delete one known application file from the offline Cache, and reopen online. Only that missing file may be fetched; all other valid cache entries must remain.
5. **One damaged cached file:** replace one cached response with altered bytes while retaining metadata. The integrity check must identify the SHA-256 mismatch and replace only that file after a successful verified download.
6. **Interrupted first installation:** interrupt the PWA after several files have been saved, terminate it, and reopen. Valid files already in Cache must be re-hashed and reused; the installer must resume with missing / damaged files only.
7. **Both stores unavailable:** on a dedicated test profile only, remove the install Cache and installer metadata. The app may show first-install Setup and download the full package. The diagnosis must identify both stores as missing.
8. **IndexedDB connection closes:** force a connection close / version change during a read or write. The installer must reopen the connection and retry once; no uncaught `database connection is closing` transaction error should remain.
9. **Persistent storage result:** verify that the installer awaits `navigator.storage.persisted()`, requests `persist()` where needed, checks the result again, and reports granted / denied / unsupported without claiming the browser guarantees persistence.
10. **Student data preservation:** before and after every repair scenario, verify existing answers, bookmarks, notes, progress, history, and saved settings remain intact.

## Release invariants

- Cache Storage remains `shbace-medical-offline-v2`.
- Installer IndexedDB remains `shbace-medical-offline-state-v1`, version 1, with the existing `meta` and `verified` stores.
- Student-data database names and stores are not migrated, cleared, or overwritten.
- A valid cached response is never deleted only because its IndexedDB verification record is absent.
- The manifest entry count, file sizes, SHA-256 values, and paths match the release source tree.
