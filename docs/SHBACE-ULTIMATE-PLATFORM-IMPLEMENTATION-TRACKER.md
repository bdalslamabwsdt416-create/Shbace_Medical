# SHBACE Medical Ultimate Platform — Implementation Tracker

**Target:** Android APK only  
**Repository source of truth:** \`bdalslamabwsdt416-create/Shbace_Medical\`  
**Frozen Android baseline:** \`applicationId=com.shbace.medical\`, \`versionName=1.3.9\`, \`versionCode=18\`  
**Release baseline:** \`android-v1.3.9\`  
**Non-negotiable:** future work must not edit the Android version name or version code.

## Delivery status

| Phase | Scope | Current status | Exit condition |
|---:|---|---|---|
| 0 | Repository and runtime audit | **Source audit complete; device acceptance pending** | All Android routes exercised on a real device/emulator, with back targets, stores, bridge calls and offline result recorded. |
| 1 | Screen, route and feature inventory | **Route contract v1 and static tests implemented; device matrix pending** | Every route has a verified runtime renderer, back/scroll target, store ownership and offline/device result. |
| 2 | Core Architecture | **Core Runtime v1 implemented** | Existing navigation, data and feature engines use stable service contracts without behaviour regression. |
| 3 | Remote Configuration Engine | **Core content policy v1 + verified last-known-good rollback implemented; signed manifest pending key provisioning** | Declarative schemas, monotonic content versions, APK compatibility, rollback integrity tests, feature policies and later signed-config verification. |
| 4 | UI and Navigation Engine | **Partial; shared route dispatch integrated for Android drawer and remote UI; device matrix pending** | Built-in route adapter, all supported nav surfaces and back/scroll invariants covered by parity tests. |
| 5 | Page Builder | **Starter renderer only** | Validated component tree, reusable templates, nested layout, conditions, tabs and preview workflow. |
| 6 | Workflow Engine | **Planned** | Local trigger/condition/allow-listed-action engine with rule validation, traces and limits. |
| 7 | Theme Engine | **Partial** | Unified token schema and complete theme application/reset/validation coverage. |
| 8 | Modular Architecture | **Module Registry v1 implemented; legacy extraction pending** | Existing engines extracted one at a time behind adapters and parity tests. |
| 9 | Quiz, Smart Review and Flashcards | **Existing features partial against target** | New question types, scheduler strategy contract, authoring and learning-history preservation. |
| 10 | Medical Bank Engine | **Substantial legacy base; standardisation pending** | Stable IDs, provenance, repeat tracking, revisions and schema validation across all banks/cases. |
| 11 | Data, Offline and Sync | **Local/offline base exists; unified data layer and cloud sync pending** | Versioned migrations, transactional backup/restore, conflict policy and offline queue tests. |
| 12 | Media, Search and Statistics | **Partial** | Unified media catalog, indexed all-content search and configurable statistics/report contracts. |
| 13 | AI Engine | **Prepared content/voice only; live service pending** | Backend proxy, source-grounded retrieval, safety policy, budgets and evaluation suite. |
| 14 | Admin Console | **Planned** | Authenticated GitHub-backed editor with review/preview and least-privilege permissions. |
| 15 | Security and Performance | **Foundations exist; audits pending** | Threat model, signed manifests, dependency/SBOM scans, performance budgets and device profiling. |
| 16 | GitHub Automation and Release Management | **Android build/test and stable release pipeline present; same-version overwrite blocked** | Extend with provenance, SBOM, security scans, staged rollout and rollback verification. |
| 17 | Comprehensive Testing | **Partial** | Unit, integration, migration, offline, route, native and real-device acceptance matrix passes. |
| 18 | APK delivery | **Current baseline published: 1.3.9 / 18** | Keep this baseline unchanged throughout the current plan. |

## Current foundations

- Phase 0 audit, static route/store inventory and native permission/bridge map.
- Android Remote Control Engine V3 with declarative configuration.
- Remote-content policy v1: monotonic package version code, minimum APK version enforcement, stored last-known-good manifest, verified rollback bridge, and unit/static tests. The manifest itself is not yet cryptographically signed.
- Android Settings grouping, APK release check and learning-content update check.
- Core Runtime v1: event bus, service registry and bounded diagnostics.
- Module Registry v1: dependency validation, ordered initialization and reverse-order cleanup.
- Module manifest for all 25 major subsystems.
- Navigation Route Contract v1: 29 route entries, V2/V3 remote allow-lists, registered local pages, shared built-in route dispatch for drawer/remote UI, and an observational adapter around the legacy renderer.

## Frozen version and release protection

- \`android/app/build.gradle\`: \`versionName "1.3.9"\`.
- \`android/app/build.gradle\`: \`versionCode 18\`.
- \`applicationId "com.shbace.medical"\`.
- Existing Android release signing certificate fingerprint.
- Once \`android-v1.3.9\` exists, release automation must not replace its APK or checksum. New development builds remain Actions validation artifacts until a future version change is explicitly authorized.

## Next implementation sequence

1. Complete real-device route/back/scroll/offline acceptance.
2. Add characterization tests around the current page renderers and student stores.
3. Add controlled adapters for bottom navigation and drawer navigation without removing legacy handlers.
4. Build Page Builder and Workflow Engine on top of the validated route, Core and component contracts.
5. Extract legacy engines one at a time behind tested adapters.

## Platform and data rules

- Only Android delivery source is in scope. Do not edit \`for ios/\`, \`for Chrome/\` or \`for Computer/\`.
- Do not wipe, rename or silently migrate any student answer, quiz attempt, Smart Review schedule, note, bookmark, pin, flashcard state or study history.
- Keep offline content available after successful package installation.
- Remote configuration is data-only. Module code is introduced by local APK build, never from GitHub-fed JavaScript.
- Cloud AI, user accounts, cross-device sync, cloud notifications and Admin Console authentication need external services and secrets; do not claim they are operational until connected and tested.
- Static analysis and CI do not replace physical-device visual, navigation, storage, notification and upgrade acceptance.
