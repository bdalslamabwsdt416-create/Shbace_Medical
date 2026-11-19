# SHBACE Medical — Android Workflow Engine v1

**Scope:** Local Android APK runtime consuming declarative `catalog.ui.workflows` records. No downloaded code is evaluated.

## Supported triggers

- `navigation:route-changed`: fields `from`, `to`, `mode`.
- `navigation:rendered`: fields `route`, `mode`.

These events are emitted by the existing Android Navigation Contract. No unverified quiz, student-progress, or storage event is claimed in this version.

## Conditions

Each rule may use up to five scalar conditions. Supported operators are `equals`, `notEquals` and `oneOf`. Fields are fixed per trigger; nested property paths, expressions, formulas and arbitrary predicates are not accepted.

## Actions

- `navigate`: move to a route already approved by the Navigation Contract's V3 remote allow-list.
- `openPage`: open a registered Remote UI page whose ID is present in the validated catalog.
- `showMessage`: append an accessible status message using `textContent`.

A rule has at most three actions, a bounded priority and a cooldown. Dispatch is protected against reentrant navigation loops and is capped at ten action attempts per event. Rules are read from the current catalog when an event arrives, so content-only updates can change them without adding executable code.

## Security boundary

- No arbitrary event names, action names, JavaScript, HTML, eval, dynamic imports or generic event emission.
- No writes to answers, quiz history, Smart Review, notes, bookmarks or student progress.
- No access to arbitrary storage keys or user secrets.
- Invalid or unknown rules are rejected at runtime and by the package validator.

## Remaining work

This is a safe engine foundation, not a visual Workflow Editor. Broader triggers require explicit event producers and tests. Rule simulation, traces UI, authoring permissions and any student-data mutation actions require separate review and contracts before implementation.
