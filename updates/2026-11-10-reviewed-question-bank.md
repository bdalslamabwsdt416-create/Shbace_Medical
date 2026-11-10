# 2026-11-10 — Reviewed question-bank audit

- Patch ID: QB-REVIEW-2026-11-10
- Target branch(es): `medical-reviewed-working-2026-11-10`, `pwa-v1.1-copy-20261110`
- Base version: Shbace Medical 1.1
- Source commit: existing reviewed-bank branch state at time of audit
- App version: 1.1

## Purpose

Document the existing reviewed question-bank work as a distinct, traceable update. This record does not itself modify the question-bank JSON.

## Files affected

Existing reviewed-bank artifacts already present on the target review branch:
- `data/qbData_reviewed.json`
- `data/Reviewed_Copy_Status.json`
- `data/Question_Change_Log_1082.csv`
- `data/Question_Review_Log_1718.csv`
- `data/Question_Review_Log_636.csv`
- `data/qbData_review_log.json`
- `js/29-reviewed-bank-controls.js`

## Exact changes

- Preserve `data/qbData.json` as the original source bank.
- Keep the reviewed bank as a separate copy at `data/qbData_reviewed.json`.
- Preserve question IDs and source order so progress remains linked between Original and Reviewed.
- Keep the review status and audit logs separate from the question-bank content.
- The reviewed-bank selector supports switching between Original and Reviewed and exposes the review log.

## Verification examples

- `NEONATE-003`: answer key changed from E to D; the option letter changed because the source question omitted option D and the reviewed copy restores the normal A–D sequence. The answer text remains Vitamin E deficiency.
- `INFECT-007`: answer remains C; the medical explanation was expanded to distinguish nasopharyngeal sampling, culture, and PCR.

## Must remain unchanged

- Original question-bank content.
- App version **1.1**.
- APK/PWA-specific build configuration unless a separate patch explicitly targets it.

## Validation / test results

- Confirmed the two question records differ as documented when comparing the Original and Reviewed data files.
- Runtime UI switching still requires a device/browser test after the relevant branch is built.

## Commit(s)

This file records the review work; source-data changes remain in their existing commits.
