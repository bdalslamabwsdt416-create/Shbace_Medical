# SHBACE Medical — Android Page Builder v2

**Scope:** Android APK declarative remote UI only. The renderer is local APK code; GitHub supplies validated JSON and hash-verified resources only.

## Component contract

The shared renderer retains existing leaf blocks (heading, text, notice, divider, verified image, HTTPS link, allow-listed action button, resource/bank/deck lists, card, list, metric and spacer) and supports:

- Nested `stack` layouts and `section` layouts (`stack`, `row`, `grid`).
- Responsive `grid` layouts with one to three columns.
- Nested card content.
- Accessible `tabs` and expandable `accordion` blocks.
- `when` groups using only `always`, `hasBanks`, `hasResources`, `hasFlashcardDecks` and `hasLearningContent`, with optional boolean `not`.
- Reusable templates with named `slot` placeholders.

For compatibility, the renderer accepts both the v1 `children` / `tabs` / `title` shapes and the v2 `blocks` / `items` / `label` shapes where defined. Remote pages expand conditions and template slots before they reach the shared renderer. Home and screen-layout blocks can use the same fixed condition predicates in the renderer.

## Reusable templates

The optional `catalog.ui.templates` list contains records with an id and blocks array. A page can select one with `templateId` and provide `slots` whose keys must match placeholders declared by that template. Slot content is validated as ordinary blocks and cannot contain another slot or template reference. The remote page runtime expands slots into a fresh block tree before rendering; it does not mutate the downloaded catalog.

## Bounds and safety

- At most 40 remote pages and 20 templates.
- At most 60 blocks in any individual block list.
- At most four nested layout levels.
- At most 120 components in a page after template expansion, including repeated slot insertions.
- At most six tabs, twelve accordion items, and three grid columns.
- All layout gaps and sizes are bounded numeric tokens.
- Text is escaped; external links require HTTPS; action buttons target registered pages, supported built-in screens, known banks, verified resources or known decks.
- Conditions are a fixed predicate allow-list, not an expression language.
- Remote JSON cannot supply HTML, CSS, JavaScript, event handlers, imports, eval, storage operations or executable workflows.

## Deliberate limits

This milestone is a runtime and schema foundation, not a visual editor. Drag/drop authoring, template gallery, preview/publish UI and authoring permissions remain future work. Physical Android visual and accessibility acceptance is still required before this capability is marked complete.
