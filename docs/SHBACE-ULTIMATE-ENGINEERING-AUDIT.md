# SHBACE Medical Ultimate Platform — Engineering Audit & Roadmap

**Audit date:** 19 November 2026  
**Repository:** `bdalslamabwsdt416-create/Shbace_Medical`  
**Audited production baseline:** `main` at `e49655660ed0eab1293034cde532a600397eb8f1`  
**Android baseline:** `applicationId=com.shbace.medical`, `versionName=1.3.7`, `versionCode=16`  
**Scope:** Native Android APK and the source files it packages. The iOS, Chrome, Computer and other delivery folders are excluded from implementation scope.

> This is a repository and source-structure audit, not a claim that every runtime path has been visually tested on a physical Android device. Every item below is classified as present, partial, missing, or dependent on an external service so the roadmap does not confuse a file existing with a feature being complete.

## 1. Executive assessment

The project has a substantial working base. Rebuilding it from scratch would create unnecessary risk. The correct direction is an **incremental modularisation (strangler) approach**: keep proven study flows and data stores working, add explicit interfaces around them, extract modules in small testable pieces, and only retire old code after parity tests prove the replacement.

The repository's recursive Git tree contained **2,541 entries** at the audited commit. The Android Gradle project packages the generated web app from `to me/www`; it does not package the separate root web tree as its runtime source. The Android native source set additionally includes `for ApK/native`.

The largest structural risk is the closed, approximately **431 KB / 3,483-line** `to me/js/09-app-features-v6.js` core IIFE. It owns many study features and private state. Numbered follow-on scripts wrap core functions and use a shared bridge. This pattern is workable for safe incremental development, but it is not yet the independent module registry and service-boundary architecture in the ultimate blueprint.

## 2. Actual project composition

### Android delivery path

- `android/app/build.gradle` defines namespace and application ID `com.shbace.medical`.
- Gradle adds `for ApK/native` as a Java source directory.
- Gradle's `copyWebAssets` task copies the generated `to me/www` package into Android's `src/main/assets/public`.
- The app's web source is therefore maintained in `to me/`; it is not safe to reorganise or replace that source without checking the Android packaging task and the browser/PWA checks.
- The native host currently includes `MainActivity`, `ShbaceNative`, `StudyTimerClock`, and `StudyTimerService`. The extra Android-only `RemoteContentManager` is compiled from `for ApK/native`.

### Important repository boundaries

- `to me/`: unified web source used by the Android APK build; includes numbered JS modules, data, assets, tests and build scripts.
- `android/`: Capacitor/Gradle Android host, resources, manifest and native application configuration.
- `for ApK/android-content/`: remote content package, catalog, manifest, overrides, validator and documentation.
- `for ios/`, `for Chrome/`, `for Computer/`: separate delivery folders; do not edit as part of this Android-only roadmap.
- Root `index.html`, `css/`, `js/` and `data/`, along with `2r2/` and other archive/material folders, are not the Android Gradle web source. Do not move or delete them as a side effect of Android modularisation.

## 3. Capability matrix: what is already there

| Blueprint area | Audited state | Existing implementation / limitation |
|---|---|---|
| Android shell | **Present** | Capacitor host, edge-to-edge/insets, immersive bars, splash handling, FileProvider, native timer service and JS bridge. |
| Navigation | **Partial / substantially expanded** | Existing home and drawer navigation; V2 remote sidebar/custom pages; V3 remote header and bottom navigation; safe route targets. Full arbitrary navigation graphs, nested interaction patterns and per-screen transition rules remain future work. |
| Remote configuration | **Partial** | Android-only JSON catalog, manifest, file hash checks, versioned private storage and declarative V2/V3 UI settings. The current catalog is still an empty template. |
| Page Builder | **Partial / starter renderer** | Existing safe blocks include headings, text, notices, dividers, images, links, buttons, resource/bank/deck lists, cards, lists, metrics and spacers. No full layout tree, drag/drop editor, nested grids, forms, tabs, conditions, reusable templates or visual preview/publish flow yet. |
| Workflow Engine | **Missing as a general engine** | Some app events are hard-coded (quiz completion, reminders, notifications and navigation). There is no general trigger/condition/action/rule registry or rule editor. |
| Theme Engine | **Partial** | Existing CSS design system and remote appearance tokens for selected colours, font scale, card radius and density. Full token coverage for typography, gradients, spacing, shadows, icon scale, motion and theme variants is not yet established. |
| Core / module architecture | **Partial** | Many numbered modules exist, but the main study engine is a large closed IIFE; later scripts wrap global functions. There is no complete dependency graph, module lifecycle/registry or stable service contract for every feature. |
| Quiz | **Present, extensible** | Existing MCQ quiz, filters, banks, systems/topics, practice/timed modes, feedback timing, ordering, count, duration, history and results. Remote V3 can configure existing whitelisted options. New question interaction types are not all implemented. |
| Smart Review | **Present, extensible** | Separate local Smart Review v3 store, scheduler, Again/Hard/Good/Easy ratings, due queue, topic mastery, sessions and history. Remote control currently reaches daily goal/default bank only. FSRS/SM-2 selection and a public scheduler interface remain future work. |
| Flashcards | **Partial** | Android remote deck format and viewer exist; supports front/back text and images, reveal, navigation and local Known/Again progress. The remote catalog currently has no decks. This is not yet a full authoring/import/export/spaced-repetition Flashcards module. |
| Medical banks / cases | **Substantial base** | Original/reviewed question sets and multiple bank sources, including Nelson, All Once/Kasr Al-Ainy, Clinical Cases, Egyptian Book and AI-generated bank adapters. Data governance, metadata standardisation, media linking and audit tooling can be expanded. |
| Statistics | **Present, local** | Existing question-bank, quiz, review, topic and study-time summaries. Customisable report/dashboard composition and cross-device analytics are not established. |
| Search | **Partial** | Existing question/topic/source search and shared normalisation. A unified index for notes, flashcards, references, PDFs, media and all user collections remains future work. |
| Data / backups | **Partial** | Existing localStorage records, Android SharedPreferences for native timer, IndexedDB/CacheStorage for offline package handling, and export/restore flows. A documented data schema, central data layer, migrations catalogue and conflict-safe sync database remain future work. |
| Offline | **Strong base** | First-install setup, package inventory, SHA-256 validation, staged update/commit, repair/recovery and scheduled/manual checks. Android remote content also uses private versioned storage, per-file hash verification and a retained previous package. |
| Media | **Partial** | Remote resources include PDF/audio/video/image/file metadata and Android opens installed files with compatible external apps. A first-party media viewer, resumable media transfer, derivatives, unused-asset inventory and richer media lifecycle are future work. |
| Notifications | **Partial / local-first** | In-app notification history, local notifications, reminder scheduling and native channels exist. A verified cloud push service, delivery backend and user preference service are not established by the inspected repo. |
| AI | **Partial / data integration, not a complete live assistant** | An adapter plugs pre-generated AI Clinical Cases and AI Generated banks into the shared question engine. Native text-to-speech/voice support exists. A secure server-side LLM assistant, cited retrieval, generation pipeline, moderation, model routing and cost controls are not established. |
| Accounts / roles / cloud sync | **Not found in the audited app structure** | No complete authentication, account roles, student-cloud profile or cross-device progress sync service was identified. This requires a backend and privacy/security design. |
| Admin Console | **Missing** | No complete visual administration console or authenticated GitHub-backed page/content/workflow/release editor was identified. |
| Security | **Partial, good foundations** | Native Android guard, allowlisted manifest URL and HTTPS host, path checks, file size limits, SHA-256 verification, schema validation and atomic package activation exist. A separately signed manifest/config, key rotation, threat model, dependency/SBOM scanning and security test suite remain future work. |
| Performance | **Partial / foundations present** | Deferred script loading, offline package caching, staged content downloads and image optimisation tooling exist. Baseline performance budgets, memory/CPU telemetry, stress/load tests and systematic profiling remain future work. |
| Accessibility / localisation | **Partial** | Arabic/English and responsive UI foundations exist. A systematic screen-reader, focus, contrast, touch-target, font-scale, RTL/LTR and localisation audit is still required. |
| Gamification | **Partial** | Study goals, streak/progress concepts and mastery indicators exist in parts of the app. A unified achievements/badges/challenges/rewards service is not established. |
| GitHub engineering | **Present, expandable** | Android build/signing pipeline, content validator, PWA checks and iOS/PWA workflow exist. Add static security scans, dependency review, SBOM, integration/contract/accessibility/performance tests, release notes automation and promotion/rollback gates. |

### Important detail about “AI”

The files called AI-generated banks are real content providers that adapt pre-generated records to the question engine. That is valuable and should be preserved. It should not be described as a live conversational AI service or a cloud LLM integration unless a running model endpoint and backend are actually configured and tested.

### Important detail about “Sync”

`to me/js/10-history-sync.js` synchronises browser history/navigation state with the app's current route. It is not account-based cross-device synchronisation of answers, bookmarks, notes or review progress.

## 4. Remote content and security baseline

The current production remote package is:

- Catalog schema: `shbace-remote-content-catalog-v1`, version `1.0.2`.
- Manifest schema: `shbace-android-content-v1`, version `1.0.2`.
- Current `systems`, `banks`, `resources` and `flashcardDecks` arrays are empty.
- Overrides currently contain empty systems/topics/questionPatches/collections arrays.

The Android native updater already:
1. Accepts only its configured manifest URL and the approved HTTPS raw GitHub host.
2. Restricts paths and rejects traversal/duplicate paths.
3. Limits file count and individual/total package size.
4. Verifies downloaded bytes and SHA-256 against the manifest.
5. Downloads into staging, activates the new version only after verification, and retains a previous version for recovery.

**Security gap to address:** SHA-256 proves that downloaded files match the manifest that was received. It does not, on its own, authenticate the manifest publisher if the GitHub source or delivery path is compromised. Add an asymmetric signature over canonical manifest/config bytes, embed only the public verification key in the APK, keep the private signing key in GitHub Secrets or a managed signing service, and design key rotation/revocation before using remote rules for sensitive behaviour.

Remote JSON must remain declarative. Do not execute scripts, arbitrary HTML, dynamic CSS, eval, downloaded modules or shell commands from the content feed.

## 5. Constraints and prerequisites

### Work that can stay in GitHub and the APK repository

Source refactoring, module contracts, schemas, tests, content packaging, APK builds, signing, documentation, GitHub Actions, and the declarative configuration pipeline can be developed through GitHub without using the user's laptop.

### Work that requires an external service

These capabilities cannot become operational through GitHub source files alone:

- Cross-device sync and accounts need a deployed backend, database, authentication, access rules, backup/retention policy and conflict-resolution protocol.
- A conversational AI assistant needs an approved model/API provider and a server-side proxy. Secret API keys must not be embedded in the APK or browser JavaScript.
- Push notifications need a server-side sender and provider credentials; local notifications do not require that service.
- An Admin Console that can publish to GitHub needs a secure GitHub App or server-side OAuth integration with narrowly scoped permissions. Never put a personal access token or signing secret in the APK or client-side web bundle.

These are architecture decisions to make when each phase is ready, not reasons to delay the local architecture, schemas and test harness.

## 6. Recommended target architecture

Do not mechanically create a large directory tree or move all current files before the dependency map exists. First introduce boundaries around current behaviour, then extract the implementation gradually:

1. **App Core:** startup lifecycle, app context, capability detection, error reporting and module lifecycle.
2. **Module Registry:** module ID, version, dependencies, capabilities, enablement and migration requirements.
3. **Navigation Service:** route registry, history, sidebar/bottom/top navigation and safe action dispatch.
4. **UI Runtime + Page Builder:** schema-validated component tree, layout primitives, conditions, reusable templates and preview.
5. **Workflow Runtime:** named event catalogue, condition evaluator, allowlisted action registry, rule priorities, idempotency and execution audit.
6. **Design Token Service:** semantic tokens, themes, typography, spacing, density, responsive rules and accessibility constraints.
7. **Study Services:** Quiz, Smart Review, Flashcards, Medical Bank, Cases, OSCE, Planner and Gamification.
8. **Data Services:** typed stores, stable IDs, migrations, backup/restore, conflict handling and export/import.
9. **Offline/Media Services:** package manifests, delta planning, quotas, cache policies, media derivatives and viewers.
10. **Search/Analytics/Notifications:** one search index, local analytics events and notification adapters.
11. **AI Gateway:** server-side model provider, retrieval, citations, evaluation, safety, rate limits and budget limits.
12. **Security/Update Services:** signed config, policy engine, capability gates, feature flags, release channels and last-known-good rollback.

Every new service first receives contract tests against the current app. Existing local data remains the source of truth until a deliberate, backed-up migration is implemented.

## 7. Delivery plan — all blueprint phases mapped to engineering work

| Phase | Work package | Completion evidence |
|---:|---|---|
| 0 | Repository, app and data audit | Inventory, page/route map, store map, native bridge map, dependency map, baseline checks and risk register. |
| 1 | Complete screen and capability map | Every screen, modal, drawer group, tab, route, feature, data store and native permission catalogued with owner and test. |
| 2 | Core Architecture | Stable app context, service contracts, module lifecycle, error boundaries and compatibility adapters. |
| 3 | Remote Configuration Engine | Versioned schemas, signed manifests, defaults/overrides, staged rollout, feature flags, last-known-good and rollback. |
| 4 | UI + Navigation Engines | Route/action registry and remote configuration for all approved navigation positions, without changing other platforms. |
| 5 | Page Builder | Validated component tree, nesting/layout/conditions, reusable templates, accessibility rules and preview/publish checks. |
| 6 | Workflow Engine | Event catalogue, safe conditions/actions, rule priorities, retries/idempotency, test mode and audit log. |
| 7 | Theme Engine | Full semantic design tokens, dark/light themes, typography, density, motion preferences and RTL/LTR. |
| 8 | Modular Architecture | Incrementally extract modules from the monolith; define dependencies and public interfaces; no big-bang rewrite. |
| 9 | Learning Engines | Extend Quiz/Smart Review/Flashcards and add supported question types with migration and parity tests. |
| 10 | Medical Bank Engine | Standardise systems/topics/questions/cases/sources, versioned IDs, duplicate/repeat provenance, audit trail and media references. |
| 11 | Data + Offline + Sync | Data schema/migrations, reliable backup, offline delta packs, then optional backend sync and conflict handling. |
| 12 | Media + Search + Statistics | Media manager/viewers, full-text search catalogue, configurable analytics and report exports. |
| 13 | AI Engine | Server-side AI gateway, retrieval/citations, generation workflows, OSCE simulator, evaluation and spend controls. |
| 14 | Admin Console | Authenticated visual Page/Content/Module/Workflow/Release editors backed by GitHub PRs and validated previews. |
| 15 | Security + Performance + Accessibility | Signed config, threat model, dependency/SBOM checks, budgets, stress tests and accessibility audit. |
| 16 | GitHub Automation + Release Management | Contract/schema gates, security scans, test matrix, APK artifacts, change log, staged promotion and rollback. |
| 17 | End-to-end validation | Regression, upgrade, restore, offline, permission, navigation, feature, performance and physical-device acceptance tests. |
| 18 | Stable APK release | VersionCode increment, unchanged application ID/signing certificate, signed artifact, release notes and upgrade verification. |

A phase can contain multiple small PRs. No phase is complete until its completion evidence is available.

## 8. Non-negotiable project rules

- Android APK only for implementation changes. Keep `for ios/`, `for Chrome/` and `for Computer/` untouched.
- GitHub is the source of truth. No laptop or Remote Desktop dependency.
- Preserve the installed app identity and signing certificate.
- Keep `1.3.7 / 16` while developing APK-independent content/config work. The next installable APK must use a higher `versionCode` once the current build has been installed; never reuse a version code for an installed upgrade.
- Do not delete or rewrite student answers, Quiz attempts, bookmarks, notes, review history or timer state during UI/content upgrades.
- Every migration must be reversible or have a verified backup/restore plan.
- Keep offline study working; remote content failure must leave the last valid installed package usable.
- Do not call an external backend or AI provider operational until its credentials, endpoint, privacy controls and live tests are configured.
- Do not claim a page/module is remotely configurable until it is wired to the runtime, covered by schema validation and tested on the actual Android APK.
- No remote code execution.
- Do not rewrite the monolithic study core wholesale. Extract only after tests capture the current behaviour.

## 9. Immediate next engineering actions

1. Complete Phase 0 by extracting a structured screen/route inventory, data-store inventory, event/action list, native capability/permission map and module dependency graph from the current code.
2. Add characterization tests for all current student-critical journeys: open bank/topic/question, answer/save/note/report, run Quiz, finish/reopen attempt, complete Smart Review, restore backup, switch offline/online and recover content updates.
3. Create the first stable service contracts around navigation, local stores, study events and remote config.
4. Build the module registry and schema compatibility checks before moving any existing feature implementation.
5. Expand the Android-only Page Builder and Workflow Engine in small increments; preserve adapters for the current UI until parity is proven.

**Audit status:** the repository baseline is identified and a source-level inventory has begun. The complete screen/store/permission dependency map and physical-device acceptance matrix are still Phase 0 work. No claim is made that the entire ultimate blueprint is already implemented.

## 10. Phase 0 extracted route and state inventory

This is a source-derived route/store map. Some entries are internal views or tabs within one route rather than separately addressable Android activities. The inventory must be confirmed against runtime navigation tests before any route is renamed or removed.

### Student-facing routes and view families found

| Route / family | Current role | Notes for future modularisation |
|---|---|---|
| `subjects` | Main learning/home area | Primary entry and home content insertion point. |
| `grade` | Grade selector/progress context | Registered from the core feature module. |
| `specialties` | System/specialty selection | Existing navigation and collection overlays. |
| `topics` | Topic list | Includes bank/collection selection context and return-position behaviour. |
| `questions` | Question bank / question detail | Core answer, save, note, report and explanation flows. |
| `quiz`, `quizrun`, `quizresult`, `quizhistory` | Quiz setup, active session, result and attempt history | Separate attempt store and preferences store; keep attempt IDs stable. |
| `review` | Smart Review | Contains topic/build, overview, schedule, weak-question, active-session and summary views/tabs. |
| `stats` | Statistics | Derived from local answer, quiz, review and study-activity records. |
| `search` | Question/content search | Current shared question search; full-resource indexing is future work. |
| `settings` | Settings and app tools | Contains update, backups, notifications, voice and other settings panels. |
| `notes`, `saved`, `wrong`, `pinned`, `reported` | Personal study collections | Some are overlays/list pages, not necessarily independent services yet. |
| `notifs` | In-app notifications | Local device event list; do not equate this with server push delivery. |
| `timer` | Study timer | Web timer plus Android foreground timer service bridge. |
| `examplanner` | Exam planning | Registered by the planner module and backed by local settings data. |
| `about`, `dedication`, `changelog`, `feedback`, `rate` | Information and feedback views | Currently page/view registrations around the core. |
| `reviewAudit` | Question-bank review/audit view | Related to the original/reviewed bank selection and audit log. |
| `shbRemoteFlashcards` | Remote flashcard deck view | Android remote deck viewer with per-card local status. |
| Remote bank/resource routes | Remote content | Dynamically added by the Android remote-content engine when a catalog package provides records. |
| Remote custom pages | Remote UI pages | Dynamically registered from `catalog.ui.pages`; restricted to supported blocks/actions. |

### Existing student-state stores identified in source

The following are examples of real persisted keys identified in the core and selected feature/Android scripts. They are a map to protect, not a proposal to rename them. Keep keys stable until a migration plan and backup/restore tests exist.

| Store / key | Current purpose |
|---|---|
| `shbace_qb_v6` | Main question-bank answers and related saved/note/report/review-v2 fields. |
| `shbace_quiz_v1` | Quiz attempts and active quiz session. |
| `shbace_quizcfg_v1` | Quiz settings/preferences. |
| `shbace_sr3_v1` | Smart Review v3 schedule, per-question records, sessions, history, daily goal and statistics. |
| `shbace_pins_v1` | Pinned questions/topics. |
| `shbace_recent_v1` | Recent study/navigation entries. |
| `shbace_notif_v1` | In-app notification records. |
| `shbace_note_meta_v2` | Note metadata used by the note experience. |
| `shbace_remote_flashcards_v1` | Per-card remote flashcard progress. |
| `shbace_exam_goal_planner_v1`, `shbace_exam_goal_v1`, `shbace_exam_goals_v2` | Exam planner/goals settings and data versions. |
| `shbace_studytime_v1`, `shbace_study_activity_days_v1` | Study time and activity summaries. |
| `shbace_settings_v1`, `shbace_theme` | App preferences and theme. |
| `shbace_question_bank_version` | Original/reviewed question-bank selector. |
| `shbace_topicmap_v1`, `shbace_topicmap_backup_v1` | Topic ID mapping and migration backup. |
| `shbace_onboarding_v3_complete`, `shbace_onboarding_v3_grade` | Onboarding completion and selected grade. |
| `shbace_fcm_token_v1`, `shbace_push_auth_v1` | Push-token/auth-related local state; a working server sender was not verified. |
| `shbace_pkg_*` | Offline package installed/available/pending update state. |
| `shbace_remote_flashcards_v1` | Remote flashcard Known/Again state. |

Additional state is kept outside WebView localStorage: the remote content manager uses Android private app files plus SharedPreferences for installed package metadata, and the native study timer uses Android SharedPreferences. The offline package installer uses IndexedDB/CacheStorage for downloaded web assets. These stores must be included in the data ownership and backup analysis before designing a unified data layer.

### Phase 0 risks from the route/store map

1. Several features are view families inside the core IIFE, not standalone modules. Moving a screen means tracing its private state, event handlers, bridge methods, back target and persistence.
2. Some modules replace or wrap global view functions. Script execution order is therefore part of the current runtime contract and must be recorded in dependency tests.
3. Question IDs, topic IDs and bank IDs are linked to student records. Any bank restructuring must preserve permanent IDs or ship an explicit, backed-up migration.
4. The remote flashcard deck progress key is separate from the Smart Review scheduler; do not silently merge the two learning-history models.
5. Browser history state and cloud account synchronisation are different systems. The former is present; the latter remains an external-service project.

### Remaining Phase 0 verification

The static source map is not yet a full runtime acceptance matrix. Still required: exercise every route on the Android APK, capture its navigation entry/back target, list its read/write stores and native bridge calls, and record whether it works offline. The result becomes the acceptance baseline for Page Builder, module extraction and future migrations.
