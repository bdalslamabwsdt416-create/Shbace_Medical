# SHBACE Medical — Universal Android Remote Control V3

This document describes the declarative remote-control layer for the **native Android APK only**. Its source is `for ApK/android-content/catalog.json`; files are downloaded using the existing manifest and SHA-256 verification system.

The controller reads JSON settings. It does not execute remote JavaScript, HTML, CSS, scripts, or expressions. iOS, Chrome/PWA, and Computer builds do not activate the V3 controller.

## What can be changed remotely

- **Bottom navigation:** show or hide, reorder, rename, change icons, move to the top or bottom, and link to built-in/custom pages, question banks, resources, and flashcard decks.
- **Header:** show/hide, brand, subtitle, logo asset, menu, theme, notification and settings actions, plus up to five safe custom actions.
- **Sidebar:** hide, rename, reorder or move existing entries between named groups; rename/reorder groups and create additional groups/items.
- **Screens:** change the title, subtitle, background, and add content before/after individual screens or across all app screens.
- **Appearance:** approved color tokens, font scale, card radius, and compact/comfortable density.
- **Quiz:** supported existing options (scope, filter, practice/timed mode, feedback, order, question count, duration and bank/system/topic selection). This configures the current Quiz engine; it does not replace its algorithm.
- **Smart Review:** daily goal and default bank. The scheduling algorithm and review history remain local.

## Example `catalog.ui`

```json
{
  "header": { "enabled": true, "brand": "SHBACE Medical", "subtitle": "Medical Learning", "showMenu": true, "showThemeToggle": true, "showNotifications": true, "showSettings": true },
  "bottomNavigation": {
    "enabled": true, "position": "bottom",
    "items": [
      { "id": "home", "label": "Home", "icon": "⌂", "targetPage": "subjects", "order": 1 },
      { "id": "bank", "label": "Bank", "icon": "▤", "targetPage": "questions", "order": 2 },
      { "id": "quiz", "label": "Quiz", "icon": "✓", "targetPage": "quiz", "order": 3 },
      { "id": "review", "label": "Review", "icon": "◷", "targetPage": "review", "order": 4 },
      { "id": "stats", "label": "Stats", "icon": "▥", "targetPage": "stats", "order": 5 }
    ]
  },
  "sidebar": {
    "itemOrder": ["subjects", "questions", "quiz", "review", "stats", "settings"],
    "itemGroups": { "quiz": "Practice", "review": "Practice" },
    "groups": [{ "title": "My Learning", "items": [{ "id": "study-guides", "label": "Study Guides", "icon": "📚", "pageId": "study-guides", "enabled": true, "order": 1 }] }]
  },
  "appearance": {
    "accentColor": "#2F8BFF", "accentSoft": "#D9EEFF", "backgroundColor": "#07131F",
    "surfaceColor": "#10243A", "cardColor": "#132A42", "textColor": "#EAF3FF",
    "mutedColor": "#9CB3CA", "borderColor": "#29445D", "fontScale": 1, "cardRadius": 18, "density": "comfortable"
  },
  "features": {
    "quiz": { "visible": true, "policy": "defaults", "defaults": { "scope": "all", "filt": "any", "mode": "timed", "fb": "end", "order": "random", "count": 30, "mins": 45, "banks": ["aj", "previous"] } },
    "smartReview": { "visible": true, "policy": "defaults", "dailyGoal": 25, "defaultBank": "all" },
    "statistics": { "visible": true }, "questionBank": { "visible": true }
  },
  "globalBlocks": { "before": [{ "type": "notice", "tone": "info", "title": "Study update", "text": "New learning resources are available." }] },
  "screens": {
    "subjects": { "title": "My Study Space", "subtitle": "Choose where you want to study.", "prepend": [{ "type": "heading", "text": "Welcome back" }], "append": [{ "type": "button", "label": "Open Quiz", "action": "builtin", "target": "quiz" }] },
    "quiz": { "title": "Quiz Centre", "append": [{ "type": "text", "text": "Choose a practice mode and begin." }] }
  }
}
```

The example's `study-guides` entry is illustrative: a matching custom page must also exist in `ui.pages`. Any resource, bank, or deck action must refer to an ID present in the same catalog.

## Supported content blocks

`heading`, `text`, `notice`, `divider`, `image`, `link`, `button`, `resourceList`, `bankList`, `flashcardDeckList`, `card`, `list`, `metric`, and `spacer`.

All text is escaped. Links must use HTTPS. Images must be listed in the verified remote manifest. Buttons may only target a registered custom page, an allowlisted built-in page, or an existing resource/bank/deck.

## Quiz and Smart Review policies

`policy: "defaults"` applies remote defaults only when the student has not saved their own preferences. `policy: "enforce"` deliberately applies the approved remote values at app startup. The controller never clears or replaces quiz attempts, answers, saved questions, notes, Smart Review history, or student progress.

## Publishing

1. Edit `catalog.json` under `for ApK/android-content/`.
2. Increment both `catalog.version` and `manifest.version` for a changed package.
3. Recalculate exact byte lengths and SHA-256 values in `manifest.json`.
4. Run `node "for ApK/android-content/validate.mjs"` or use the GitHub Actions validation workflow.
5. Android devices fetch the new manifest during the normal update check, or when the student manually checks for content updates in Settings.

**Current feed note:** the initial V2 catalog remains an empty content template until real catalog.ui configuration and any referenced content/assets are published. Merging V3 adds these capabilities to the APK; it does not create or publish medical content.