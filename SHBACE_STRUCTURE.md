# SHBACE MEDICAL — Project Structure Standard

**Architecture ID:** SHBACE-ARCH-01  
**Baseline:** `version-1.1`  
**Application version:** `1.1` (must not change as part of file organization)

This document defines the canonical organization for Shbace Medical. It is deliberately separate from platform release branches. The original `version-1.1` branch remains the protected baseline.

## 1. The organizing principle

Organize by responsibility first, platform second. Every file must have one clear home. Do not keep multiple active copies of the same source file in different folders. Platform-specific code belongs under its platform area; shared application logic stays platform-neutral.

## 2. Target directory map

```text
Shbace_Medical/
├── index.html                 # Web/PWA entry point only
├── manifest.webmanifest       # PWA metadata
├── sw.js                      # PWA service worker entry point
├── package.json               # Build scripts and dependencies
│
├── app/                       # Shared application source
│   ├── css/                   # Shared styles
│   ├── js/                    # Shared application modules
│   ├── components/            # Reusable UI components
│   └── assets/                # Shared images, icons, fonts
│
├── data/                      # Application data; never mix with source code
│   ├── question-bank/
│   │   ├── original/          # Immutable original question bank
│   │   ├── reviewed/          # Reviewed/edited question bank
│   │   └── audit/              # Review logs, CSVs, change history
│   └── config/                # Data configuration and status manifests
│
├── platforms/
│   ├── android/               # Android/Capacitor-specific files
│   └── pwa/                   # PWA install, offline, cache, and build files
│
├── docs/                      # Human-readable project documentation
│   ├── architecture/
│   ├── development/
│   └── releases/
│
├── tests/                     # Automated checks and test fixtures
├── tools/                     # Developer utilities and build helpers
├── .github/workflows/         # CI/build automation
└── SHBACE_STRUCTURE.md        # This architecture contract
```

## 3. File naming rules

- Shared JavaScript modules: `NN-kebab-case.js` (number only when load order is genuinely required).
- CSS: `component-or-feature.css`; avoid generic names such as `new.css` or `final2.css`.
- Data files: descriptive lowercase names, with role stated in the directory rather than duplicated in filenames.
- Images: `feature-purpose-variant.ext`; use lowercase and hyphens.
- Documentation: `topic.md`; dated release notes use `YYYY-MM-DD-topic.md`.
- One canonical source per feature. Do not create `final`, `final-new`, `final-fixed` copies.

## 4. Data safety rules

1. `original` question-bank data is immutable. Never edit it during cleanup.
2. Reviewed data must remain separate from original data.
3. Review logs and CSV audit files must never be placed beside runtime JavaScript modules.
4. Before moving any data file, verify every fetch/import path and update all references in the same change.
5. Never delete duplicate-looking files until their usage and history are proven redundant.

## 5. Platform boundaries

- Shared behavior belongs in `app/`.
- Android-only configuration and native resources belong in `platforms/android/`.
- PWA-only manifest, service-worker, offline installer, and PWA build configuration belong in `platforms/pwa/`.
- A shared fix is applied independently to each release target and tested on both.
- Android/APK changes must not leak into the PWA release, and PWA-only code must not leak into the APK release.

## 6. Branch model

| Branch | Responsibility |
|---|---|
| `version-1.1` | Protected original baseline |
| `main` | Integration and reviewed, tested shared changes |
| `work/shared-*` | Shared application changes |
| `work/android-*` | Android-only changes |
| `work/pwa-*` | PWA-only changes |
| `release/android-v1.1-*` | Android release candidate |
| `release/pwa-v1.1-*` | PWA release candidate |

Do not create a new branch for documentation-only noise. Use one task branch per coherent change. Do not merge branches merely because their names look related.

## 7. Safe migration sequence

This is a target map, not permission to move files blindly. Migration must be incremental:

1. Inventory every tracked file and identify its role.
2. Identify entry points, script load order, dynamic imports, fetch paths, service-worker precache paths, and build references.
3. Mark each file as shared, Android-only, PWA-only, data, documentation, test, or obsolete candidate.
4. Move one coherent group at a time while updating every reference.
5. Run syntax checks, build checks, and path/reference checks.
6. Compare behavior against the protected baseline.
7. Only after verification, propose merging the migration branch into the intended integration branch.

## 8. Explicit non-goals

This architecture task does not change application behavior, visual design, question content, application version, or release configuration. It does not delete or overwrite existing source files. It does not merge any release branches.

**Current status:** Architecture standard created. Physical file migration is pending a complete repository-tree inventory and reference audit.
