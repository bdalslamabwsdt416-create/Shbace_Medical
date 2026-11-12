# Shbace Medical · Chrome (Phone + Computer)

This independent delivery lives in the `to me/` folder and is built as a single adaptive Chrome PWA for Android phones and desktop computers.

## What is included

- A full-screen installed-app experience with responsive phone and wide-screen layouts.
- The Chrome Android question bank, question data, assets, progress and offline package copied as the starting point.
- A redesigned Smart Review session builder: select multiple topics, set a separate question count for each topic, review the planned total, and optionally hide the Smart Pick suggestion.
- Question voice preferences for English (US), English (UK) and Arabic. English (US) is the default; if a requested English voice is unavailable, the voice layer can fall back to Arabic where available.
- Exam Goal Planner entries with free-text names and multiple independent exam dates.
- A countdown display for the Study Timer, with browser notifications/sound when the page is able to run.

## Study Timer browser limitation

The timer uses the saved session's wall-clock elapsed time to calculate the remaining countdown and checks again when the page returns to the foreground. The browser can show a notification when the timer completion code runs, but a web app cannot guarantee an exact alarm if Chrome or the device fully closes/suspends the app. Native Android alarm/foreground-service capabilities remain separate from this PWA.

## Question explanations

The existing 1,718-question bank, its answer keys and explanations are preserved unchanged. The original explanations are general question-level explanations; the bank did not contain partially completed A/B/C/D option-by-option explanations to fill in.

## Build

- Run `npm run build:pwa` from this folder.
- Vercel root directory: `to me`
- Output directory: `www/`
- PWA release: `1.3.6-to-me.1`

This is a separate deployment. It does not replace the original Chrome Android, iOS or Computer versions.
