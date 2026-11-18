# Update / Patch Files

This folder is the permanent, file-per-update record for Shbace Medical.

## Rules
- Never overwrite or delete the original/base files as part of a patch record.
- Create one new Markdown file for every distinct update. Do not append unrelated updates to an older patch file.
- Use the naming format: `YYYY-MM-DD-short-description.md`.
- Every patch must state its target branch: `main`, APK, PWA, or another explicitly named branch.
- Record the exact source/base version, affected paths, what changes, what must remain unchanged, and validation performed.
- Keep app version **1.1** unchanged unless the owner explicitly requests a version change.
- Do not merge APK and PWA branches into each other. Shared changes must be reviewed and applied separately to each target branch.
- A patch record documents the change; it does not silently replace the actual source files. Code/data changes must be committed separately and linked from the patch record.

## Required patch template

```md
# YYYY-MM-DD — Short update title

- Patch ID:
- Target branch(es):
- Base version:
- Source commit:
- App version: 1.1

## Purpose

## Files affected

## Exact changes

## Must remain unchanged

## Validation / test results

## Commit(s)
```

## Branch roles
- `main`: canonical source and shared baseline.
- APK branch: Android/APK-specific work plus separately applied shared patches.
- PWA branch: PWA/offline-specific work plus separately applied shared patches.
- Review-work branch: question-bank review data and audit trail.

Always create a separate patch file for each update, and keep the patch files in the same `updates/` folder on every branch receiving that update.
