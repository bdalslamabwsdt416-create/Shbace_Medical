# Consolidation report — 2026-11-16

## Scope and branch safety

- Repository: `bdalslamabwsdt416-create/Shbace_Medical`
- Work branch: `consolidate-last-layer`
- Original-state branch: `archive/stale-20261116`
- Base: `main`
- No changes are made directly to `main`; no merge is performed by this task.

## Implemented in the work branch

| Area | Change |
|---|---|
| Splash | Removed the seven-day/local-session suppression gates. The splash now runs on each app document load. |
| Update checks | Kept the seven-day automatic cadence and the manual Settings check. The interval is independent of splash display. |
| Update install | Kept staged download, per-file byte validation, SHA-256 validation, final verification, and atomic commit. After acceptance and commit, one shared reload request applies the package. |
| Service Worker | Removed the separate immediate `controllerchange` reload paths. First installation remains reload-free; worker activation alone does not restart the page. |
| APP_SHELL | Kept the existing nine shell entries; they do not include question-bank datasets. The core stylesheet path now points to `bundle-core.css`. |
| CSS | Added `bundle-core.css` and `bundle-late.css` in their original cascade order. Source sheets are archived under `_layers/css/original/`. No declarations were discarded during consolidation. |
| AI Clinical Cases | Restored the system → topic → case → questions path. A selected case now filters to its own questions, the Back action returns to the case list, and the case/vignette/questions render as one visual group. |
| AI Generated | Connected the bank's page, list, options, and question-card classes to the shared styling already used by the Pediatrics banks. |
| Duplicate root files | Archived and removed five stale root-level copies (35, 38, 39, 40, 41). Their active `js/` copies remain untouched. `09-app-features-v6.js` was not present at the root, so it was left in `js/`. |
| Guardrails | Added `LAYOUT.md`, a root-duplicate checker, and a unit test for that checker. |

## CSS source order

- Core: `core.css` → `android-v13.css` → `chrome-android.css`.
- Late: `late.css` → `unified-enhancements.css` → `shbace-layout-refinements.css` → `egyptian-book.css` → `clinical-case-bank.css` → `ai-generated-bank.css` → `banks-07-08-parity.css`.

The bundles retain the original declarations and URL context. This is a cascade-preserving consolidation, not a risky selector/declaration purge.

## JavaScript override handling

The startup reload path was consolidated so Service Worker activation and version metadata do not independently force a restart. The offline installer now requests the reload only after a user-approved update has passed size and SHA-256 checks and the staged files have been committed. The script modules remain separate. Other legacy global wrappers were not deleted solely on name matches; doing so without a complete runtime test could break intentional wrappers.

## Validation status

The following are required before this change can be treated as fully release-verified:

| Check | Status |
|---|---|
| `npm ci` | Passed locally in a clean sandbox using the committed lockfile (lockfile v3; 33 package entries). GitHub Actions has been changed to use `npm ci`; latest CI run is pending. |
| `npm run test:unit` | Passed: 13/13 tests, 0 failures. Re-run is triggered on the lockfile/workflow head. |
| `npm run check:bank` | Passed: no root duplicates, bank identity/data audit clean, 0 warnings and 0 errors. |
| `npm run build:pwa` | Passed: 79 deferred scripts verified, 342 offline files (28.64 MiB), 0 external runtime references. |
| Playwright first install | Passed in Chromium standalone-mode simulation: 342/342 files (28.6 MB) downloaded; all five package stages including integrity verification completed. Service Worker registered and controlled the app. |
| App navigation, banks, offline restart, update/reload | Passed in Chromium at 390×844 and 1280×800. No horizontal overflow, page/console errors, failed requests, or HTTP errors. Both AI Clinical Cases and AI Generated banks rendered questions/options and accepted answers; per-case vignette/questions and Back navigation worked. Offline reload worked. A controlled two-file update (14.8 KB) passed byte/SHA-256 verification, cached the changed file, and requested exactly one reload after approval. |
| Screenshot baseline comparison and physical-device installation | Still pending. Screenshots were captured during browser checks, but a trusted before/after visual baseline comparison and installation on a real Android/desktop device have not been performed. |

The automated unit, bank-validation, PWA-build, and simulated Chromium functional checks are green. Keep the PR in draft / do not merge until the latest `npm ci` CI run completes and the visual screenshot baseline comparison plus physical-device checks are completed. The CSS bundles retain their source order; layout overflow was checked at both viewports, but pixel-level before/after equivalence has not been certified.

## Explicitly not changed

- One CI workflow adjustment outside `to me/`: `.github/workflows/pwa-check.yml` now uses `npm ci` with the committed lockfile.
- No question content, answer keys, bank datasets, or student progress stores.
- No direct push to or merge into `main`.
