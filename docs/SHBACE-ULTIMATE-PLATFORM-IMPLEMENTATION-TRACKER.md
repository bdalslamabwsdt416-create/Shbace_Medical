# SHBACE Medical Ultimate Platform — Implementation Tracker

**Target:** Android APK only  
**Repository source of truth:** \`bdalslamabwsdt416-create/Shbace_Medical\`  
**Frozen Android baseline:** \`applicationId=com.shbace.medical\`, \`versionName=1.3.9\`, \`versionCode=18\`  
**Release baseline:** \`android-v1.3.9\`  
**Non-negotiable:** future work in this plan must not edit the Android version name or version code. Any workflow or release automation added during the plan must preserve this invariant.

## Delivery status

| Phase | Scope | Current status | Exit condition |
|---:|---|---|---|
| 0 | Repository and runtime audit | **Source audit complete; device acceptance pending** | All Android routes exercised on a real device/emulator, with back targets, stores, bridge calls and offline result recorded. |
| 1 | Screen, route and feature inventory | **Static map documented; runtime matrix pending** | Machine-readable route inventory checked against runtime route tests and data ownership. |
| 2 | Core Architecture | **Core Runtime v1 implemented** | Existing navigation, data and feature engines use stable service contracts without behaviour regression. |
| 3 | Remote Configuration Engine | **Partial; V2/V3 baseline exists** | Schemas, version policy, feature flags, validation, last-known-good and signed configuration are covered by tests. |
| 4 | UI and Navigation Engine | **Partial** | Built-in route adapter, full supported nav surfaces and back/scroll invariants covered by parity tests. |
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
| 16 | GitHub Automation and Release Management | **Android build/test and stable release pipeline present** | Extend with provenance, SBOM, security scans, staged rollout and rollback verification. |
| 17 | Comprehensive Testing | **Partial** | Unit, integration, migration, offline, route, native and real-device acceptance matrix passes. |
| 18 | APK delivery | **Current baseline published: 1.3.9 / 18** | Keep this baseline unchanged throughout the current plan unless the owner explicitly authorizes a version change. |

## Completed work that remains part of the baseline

- Phase 0 audit document, route/store map and native Android permission/bridge map.
- Android Remote Control Engine V3: safe configuration for supported navigation, screens, appearance and Quiz/Smart Review preferences.
- Android Settings layout and separate learning-content update check.
- GitHub Releases-based APK update check and stable APK release publication.
- Core Runtime v1: event bus, named service registry and bounded diagnostics.
- Module Registry v1: dependency validation, ordered initialization, failure isolation and reverse-order cleanup.
- Machine-readable inventory for all 25 major subsystems in \`to me/modules/module-manifest.v1.json\`.

## Version lock

The following are protected values during all remaining phases:

- \`android/app/build.gradle\`: \`versionName "1.3.9"\`.
- \`android/app/build.gradle\`: \`versionCode 18\`.
- \`applicationId "com.shbace.medical"\`.
- Existing Android release signing certificate fingerprint.

Every implementation PR must include or pass a check that rejects accidental changes to the version name/code. Do not create a new APK release merely because a new internal engine module is added. The build/test pipeline can produce validation artifacts without publishing a second release tag.

## Next implementation sequence

1. Complete the static route/store/bridge inventory and add executable characterization tests for route IDs, route registration, script order and persistence keys.
2. Add a safe adapter boundary around the existing route navigation without changing the underlying screen renderers.
3. Register the first existing subsystem only after its public adapter and parity tests are ready.
4. Build Page Builder and Workflow Engine on top of the validated Core contracts, not by executing remote JavaScript or HTML.
5. Continue through the target modules in dependency order. Do not move a module to \`implemented\` until its exit condition and tests are satisfied.

## Platform and data rules

- Only the Android delivery source is in scope. Do not edit \`for ios/\`, \`for Chrome/\` or \`for Computer/\`.
- Do not wipe, rename or silently migrate any student answer, quiz attempt, Smart Review schedule, note, bookmark, pin, flashcard state or study history.
- Keep local content available offline after a successful package installation.
- Remote configuration is data-only. Module code is introduced by an APK build, never by a GitHub-fed script.
- Cloud AI, user accounts, cross-device sync, cloud notifications and Admin Console authentication need external services and secrets; do not claim they are operational until connected and tested.
- Static analysis and CI do not replace physical-device visual, navigation, storage, notification and upgrade acceptance.
