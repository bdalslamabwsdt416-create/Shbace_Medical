# SHBACE Medical Android Page Builder v1

## What is implemented

The Android APK now has a local-only page rendering service, `window.SHBACEPageBuilder`, registered as `page-builder.renderer` in Core Runtime.

The renderer accepts validated declarative JSON and supports:

- Existing leaf blocks: headings, text, notices, dividers, images, cards, lists, metrics, spacers, HTTPS links, buttons, resource lists, bank lists and flashcard-deck lists.
- Nested vertical stacks and responsive grids.
- Interactive tabs with accessible tab roles and selected-state attributes.
- Native disclosure/accordion sections.
- A maximum nesting depth of four and a maximum rendered block budget of 120 per render tree.

The renderer is loaded locally in the Android app after the navigation contract. Remote UI pages, home blocks and Remote Control screen slots use it when available; existing leaf renderers remain the compatibility fallback.

## Safety and compatibility

- Android native only; it does not activate in browser/PWA environments.
- Layout values are bounded numeric tokens. Text and labels are escaped before HTML output.
- No remote JavaScript, HTML templates, expressions, eval, dynamic imports or arbitrary CSS are accepted.
- It does not read or write localStorage, IndexedDB, question answers, attempts, notes, bookmarks or Smart Review state.
- Existing renderer, route history and native bridge contracts remain in place.
- APK baseline remains `1.3.9 / 18`; this repository change does not publish a replacement APK.

## Remaining Page Builder work

This is a renderer foundation, not a visual editor. Reusable templates, bounded condition rules, editor UI, preview/publish workflow, authoring permissions and device-level layout acceptance remain future work.
