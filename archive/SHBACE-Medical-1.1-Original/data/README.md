# Question-bank data

The runtime question-bank files remain at this directory's root to preserve the app's existing loader and build contract:

- `qbData.json`: original/base question bank. Treat as immutable.
- `qbData_reviewed.json`: reviewed working copy; keep separate from the original.
- `qbData_review_log.json`: structured review log used by the app's review-audit screen.

Audit-only exports and status snapshots are stored in `audit/`. They are not runtime inputs.

Do not overwrite the original bank when updating the reviewed copy. Keep source exam wording and provenance intact.
