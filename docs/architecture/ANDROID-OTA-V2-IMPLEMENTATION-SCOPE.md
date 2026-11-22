# Android OTA v2 — implementation scope

**Status:** implementation specification; not a claim that these capabilities are already live.
**Scope:** Android APK only. Do not change PWA, iOS, Chrome, or student-local data stores.

## Baseline verified on 2026-11-22

The current Android feed supports verified immutable JSON/media packages, SHA-256 and byte-length validation, changed-file-only transfer, stable/beta/internal channel labels in the manifest, a previous-package pointer and rollback verification, question patches, additive question insertion into an existing local topic, remote banks/resources/flashcards, and a safe declarative UI layer.

The current feed does **not** yet implement remote deletion/hiding/moving/reordering of local questions; scheduling; device-group targeting; a remotely administered release dashboard; device receipt telemetry; signed-manifest verification; or a complete preview/publish workflow. A channel string in the manifest alone is not proof that the APK selects separate channels.

## Design rules

1. Keep all remote payloads declarative JSON and verified media. Never execute remote JavaScript, HTML, CSS, dynamic imports, or arbitrary code.
2. Preserve stable question, topic, bank, resource, deck, and card IDs. Never reuse an ID for a different educational item.
3. Do not mutate student-local answers, attempts, bookmarks, notes, reports, pins, history, timers, or flashcard progress during a content operation.
4. Use immutable content releases with monotonically increasing contentVersionCode. No in-place edits to a published package.
5. Validate the complete candidate package before publication; activate only after every file has passed length, hash, schema, and compatibility checks.
6. Retain the current and last-known-good content packages. Rollback must not roll back student progress.
7. Keep emergency disable controls as data-only policy records. They take effect on the next successful sync; do not promise instant revocation while a device is offline.
8. Treat analytics/device receipts as opt-in/minimal operational telemetry. Do not collect names, emails, student IDs, question answers, or study activity for OTA delivery metrics.

## Capability workstreams and acceptance criteria

### A. Content lifecycle and bulk operations
- Add a versioned operation format with stable operation IDs and explicit targets.
- Support publish, hide, restore, archive, and (only where safe) tombstone operations for questions and content records.
- Support move and ordering operations using stable question IDs and explicit destination system/bank/topic identifiers.
- Support batch operations with all-or-nothing validation; reject partial application and duplicate operation IDs.
- Do not physically erase source records in the first release. Use reversible tombstones/hidden state; permanent purge is an offline maintenance action only.
- Require explicit confirmation metadata for answer/option changes because stored selections are keyed to question identity.
- Acceptance: applying the same operation package twice is idempotent; unknown targets and ID collisions reject the entire package; rollback restores the previous visible content.

### B. Scheduling, channels, and targeting
- Add scheduled publication windows in UTC (publishAt, unpublishAt) and define behavior for devices with incorrect clocks.
- Add channel selection (stable, beta, internal) as a real APK setting, not just a manifest label.
- Add compatibility targeting by app version range and declared cohort/channel. Do not target by personal identity.
- A release is eligible only when channel and app compatibility match and its schedule is active.
- Acceptance: test each channel independently; verify scheduled content before, during, and after its window; stable users never receive beta/internal-only packages.

### C. Trust and integrity
- Sign the canonical manifest payload with Ed25519 (or another reviewed modern signature scheme).
- Keep the private key only in protected CI secrets; pin the public key in the APK. Define key ID and rotation/revocation strategy before enabling enforcement.
- Verify signature before trusting file paths, hashes, version, channel, or release policy. Continue verifying each file's exact size and SHA-256.
- Reject unsigned manifests after the migration window; fail closed without replacing the active package.
- Acceptance: tampered manifest, wrong key, missing signature, expired/revoked key, altered file, downgrade, and interrupted download all leave the last-known-good package active.

### D. Authoring, review, and publication tooling
- Provide a canonical JSON import/export format for banks, questions, resources, and flashcards.
- Add a preflight validator for duplicate IDs across the whole package, missing topics, invalid answer indices, empty options, broken media references, duplicate operations, and conflicting edits.
- Produce a human-readable change report and a rendered preview from the same validated candidate data.
- Separate draft from published immutable releases. Publishing requires validation and an explicit release action.
- Acceptance: invalid package cannot be published; preview matches the candidate content; export/import round-trips IDs and content without loss.

### E. Resources and storage
- Continue content-addressed/hash-based changed-file-only downloads.
- Add reference checking before resource removal; do not delete a file still referenced by a question, page, deck, or catalog record.
- Retain current and previous versions; garbage-collect only unreferenced older versions after successful activation and a safe retention window.
- Acceptance: unchanged assets are not downloaded; referenced assets cannot be removed; cleanup never removes current/previous packages.

### F. Observability and privacy
- Expose local content version, selected channel, last successful sync time, and last sync result in an admin/debug view.
- Optional device receipt endpoint may count successful package receipts using a random installation-scoped identifier with rotation and retention limits.
- Do not build per-student analytics or infer installs from page views. No ads, push notifications, or unsolicited student messaging.
- Acceptance: telemetry is disabled unless explicitly configured, contains no personal/study data, and can be audited against the privacy notice.

## Backend boundary

GitHub-hosted immutable JSON/media is sufficient for static package delivery and validation. It is not by itself a secure multi-user CMS, scheduled job runner, device cohort manager, or receipt database. Those functions require a separate authenticated publishing service and (for receipts) a minimal backend endpoint. Do not simulate these functions with public JSON flags.

## Delivery order

1. Harden validator and add automated fixtures for valid/invalid content operations.
2. Implement lifecycle operations and idempotent application in Android runtime.
3. Implement channel selection, compatibility targeting, and schedule evaluation.
4. Implement signing, CI signing, public-key pinning, and negative signature tests.
5. Add import/export, change report, preview, and controlled publishing workflow.
6. Add resource reference checks and safe garbage collection.
7. Add privacy-reviewed optional receipt telemetry only if an actual backend is approved.

Each workstream requires Android APK build, unit tests, content validation, regression tests for student data preservation, and on-device tests before claiming availability. The existing APK v1.3.10 / versionCode 19 remains the current candidate until a later verified APK is built and tested.
