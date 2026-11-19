# SHBACE Medical — Android Page Builder v2

**Scope:** Android APK declarative remote UI only. This is a data-driven page composition engine, not a remote-code execution facility.

## Supported component tree

Existing blocks remain available: heading, text, notice, divider, verified image, link, safe action button, resource list, bank list, flashcard-deck list, card, list, metric and spacer.

New nested blocks:

- `section`: stack, row or grid layout containing child blocks.
- `grid`: a one-to-three-column responsive child-block layout.
- `tabs`: two-to-six named tabs with local accessible tab/panel interaction.
- `accordion`: one-to-twelve expandable sections.
- `when`: a conditional group using only fixed predicates: `always`, `hasBanks`, `hasResources`, `hasFlashcardDecks`, and `hasLearningContent`. Optional `not: true` negates the selected predicate.
- `slot`: a named placeholder used only inside a reusable template.

Nested `blocks` are supported by section, grid, card, tabs, accordion and when. Every rendered text field and URL is escaped/validated; URL blocks accept HTTPS only. Buttons only target existing pages/screens, verified resources, known banks or registered decks.

## Reusable templates

The optional `catalog.ui.templates` array defines reusable layout records:

```json
{
  "ui": {
    "templates": [
      {
        "id": "learning-layout",
        "blocks": [
          { "type": "heading", "text": "Clinical learning" },
          { "type": "slot", "name": "intro" },
          { "type": "section", "layout": "grid", "blocks": [
            { "type": "slot", "name": "main" },
            { "type": "slot", "name": "aside" }
          ]}
        ]
      }
    ],
    "pages": [
      {
        "id": "clinical-library",
        "title": "Clinical Library",
        "templateId": "learning-layout",
        "slots": {
          "intro": [
            { "type": "notice", "tone": "info", "text": "Choose a learning resource." }
          ],
          "main": [
            { "type": "bankList", "ids": ["pediatric-cases"] }
          ],
          "aside": [
            { "type": "flashcardDeckList", "ids": ["pediatric-cardiology"] }
          ]
        }
      }
    ]
  }
}
```

Each page references one known template and can populate only named slots declared by that template. Slot contents cannot contain another template slot, preventing recursive expansion.

## Limits and validation

The validator and Android runtime both restrict component types and layout values. A single block list may contain at most 60 items, nested depth is at most four, and a component tree may contain at most 300 blocks. There may be at most 20 reusable templates, 40 pages, six tabs, twelve accordion sections, and three grid columns. Arbitrary CSS, HTML, scripts, JavaScript event handlers, expressions, remote imports, and `eval` are not accepted.

The five conditional predicates are intentionally data-safe and are not general-purpose expressions. No network, storage, or user progress operation is triggered by rendering a page.

## Current boundaries

- The page builder still composes pages from a finite approved component catalog; it is not a free-form native UI compiler.
- Preview/editor authoring and workflow automation are separate future work.
- Existing page registrations and navigation remain in place. The new renderer is additive and keeps existing routes and settings.
- The new JavaScript renderer is local APK source; the remote feed supplies JSON and verified media only.
