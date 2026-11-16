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
| `npm ci` | Blocked: `to me/package-lock.json` is absent in the current base branch. A lockfile was not fabricated. |
| `npm run test:unit` | Not executed in this environment. |
| `npm run check:bank` | Not executed in this environment. |
| `npm run build:pwa` | Not executed in this environment. |
| Playwright first-install / update / reload-flow | Not executed; a connected browser runner was not available in this task session. |
| Screenshot comparison at 390×844 and 1280×800 | Not executed; no trusted before/after browser captures are available. |
| Console and page-error checks | Not executed. |

The PR must remain unmerged until these checks run in a working checkout. The CSS bundles are produced by direct source-order concatenation, so their visual equivalence still needs the requested screenshot checks at both viewports.

## Explicitly not changed

- No files outside `to me/`.
- No question content, answer keys, bank datasets, or student progress stores.
- No direct push to or merge into `main`.
