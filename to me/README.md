# Shbace Medical · Chrome (Phone + Computer)

This independent delivery lives in the `to me/` folder and is built as a single adaptive Chrome PWA for Android phones and desktop computers.

See `docs/ARCHITECTURE.md` for a short map of the code (the Setup-gated start-up order, the closed core script and its bridge, the question-bank flags, search).

## What is included

- Independent Clinical Case bank: 1,598 questions across 10 medical systems.
- Independent AI Generated bank: 1,881 single-best-answer MCQs from 16 source files.

- A full-screen installed-app experience with responsive phone and wide-screen layouts.
- The Chrome Android question bank, question data, assets, progress and offline package copied as the starting point.
- A redesigned Smart Review session builder: select multiple topics, set a separate question count for each topic, review the planned total, and optionally hide the Smart Pick suggestion.
- Question voice preferences for English (US), English (UK) and Arabic. English (US) is the default; if a requested English voice is unavailable, the voice layer can fall back to Arabic where available.
- Exam Goal Planner entries with free-text names and multiple independent exam dates.
- A countdown display for the Study Timer, with browser notifications/sound when the page is able to run.

- A compact study status strip on Review / Timer / Statistics / Quiz, and a "What next?" panel on quiz results. Home remains uncluttered; these panels only read existing data (`js/37-study-hub-linkage.js`).
- Bank readiness = correct answers (latest attempt on each question) divided by the whole bank; it appears after 20 answered questions.
- Daily Medical Insight notifications run only in the Android app (Capacitor); the Chrome PWA shows the daily fact on Home.

- Offline: on the first installed-app launch, Setup appears immediately after Splash and downloads the complete package inventory (app code, styles, onboarding resources, question-bank data, images and other copied assets). Each file is checked by byte size and SHA-256 before the first onboarding screen is released. On later launches, a committed local install opens directly; no full-package scan or setup screen runs. The single updater checks the manifest every 48 hours or when Settings → Check for updates is tapped. It stages only changed files in the background, verifies them, and requests a safe restart after commit. Repair is limited to files found missing during a scheduled/manual manifest comparison; no recurring whole-package hash scan runs. Student answers, notes, bookmarks and progress retain the existing To Me storage.
- Question Bank opens in the All view by default (30 cards at a time, "Show more"); the Tags and All Questions lists show only what exists in the current topic, with counts. Each question also has a type tag (Clinical Case, Diagnosis, Investigation, Management, Knowledge) derived from its wording.
- Question voice: English only, prefers the clearest male voice the device offers.
- Search: the search box and the bank chips stay on top; specialty, tag, source, topic, system and sort are in one collapsible "Filters" panel.

## Checks

- `npm run test:unit` runs the unit tests in `tests/`.
- `npm run check:bank` checks root-level duplicate JS/CSS names, validates ids, answer keys, option letters and explanations, and syntax-checks every runtime script.
- `npm run build:pwa` repeats the duplicate-name and bank checks before producing the offline package.
- The repository's `PWA checks` GitHub Action runs the unit tests, `check:bank` and `build:pwa` for pull requests and non-main pushes that change `to me/**`.

## Study Timer browser limitation

The timer uses the saved session's wall-clock elapsed time to calculate the remaining countdown and checks again when the page returns to the foreground. The browser can show a notification when the timer completion code runs, but a web app cannot guarantee an exact alarm if Chrome or the device fully closes/suspends the app. Native Android alarm/foreground-service capabilities remain separate from this PWA.

## Question explanations

The 1,718-question bank and answer keys remain intact. Short and cross-reference explanations were expanded for clarity; original exam option labels and duplicate options were preserved where they are present in the source, with explicit QA exceptions rather than silent edits.

## Build

- Run `npm run build:pwa` from this folder.
- Vercel root directory: `to me`
- Output directory: `www/`
- PWA release: declared in `pwa-version.json` (single source of truth; the `sw.js` cache name, `js/29-offline-setup.js` and `package.json` are checked against it).

This is a separate deployment. It does not replace the original Chrome Android, iOS or Computer versions.