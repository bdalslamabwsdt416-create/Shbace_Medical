# Update / Patch Files

Create one new Markdown file under `updates/` for every distinct update.

## Rules
- Never overwrite original/base files as part of a patch record.
- Naming: `YYYY-MM-DD-short-description.md`.
- Every patch identifies its target branch, base branch/commit, app version, affected paths, exact behavior, validation, and commit(s).
- Keep app version **1.1** unless explicitly authorized to change it.
- Keep APK-only and PWA-only changes isolated. Apply shared changes separately to each branch.
- A patch note records work; it does not replace source files.

## Branch roles
- `main`: canonical shared baseline.
- APK branch: Android-specific work.
- PWA/release branch: installable web app and offline-specific work.
- Review-work branch: question-bank review and audit data.
