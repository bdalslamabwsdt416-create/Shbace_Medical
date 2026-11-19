# SHBACE Medical — Android remote content package

This directory is the content origin used by the **Android APK remote-content engine**.
Publish content-only updates to the dedicated `shbace-android-content` branch. It is intentionally separate from the APK code branch and from PWA/Chrome and iOS release flows.

## Safety and publishing rules

- Publish declarative JSON and media files only. The app does **not** download or execute remote JavaScript.
- Every file (including the catalog and images) must be listed in `manifest.json` with its exact byte length and SHA-256 digest.
- Increase `manifest.version` whenever any content, metadata, or file inventory changes. A version is immutable once published.
- Keep every content path relative to this directory. Do not use absolute paths, query strings, or parent-directory segments.
- The app downloads changed files to a staging directory, verifies size and SHA-256, then switches the installed manifest. An interrupted update leaves the previous content version active.
- Unchanged files are copied forward from the previous local version, so only changed/new files need network transfer.
- The previous installed content version is retained for rollback/recovery. Student answers, bookmarks, notes, and study progress stay in the existing local app stores.

## Manifest schema

`manifest.json`:

```json
{
  "schema": "shbace-android-content-v1",
  "version": "1.0.0",
  "generatedAt": "2026-11-19T00:00:00.000Z",
  "catalogPath": "catalog.json",
  "files": [
    {
      "path": "catalog.json",
      "bytes": 105,
      "sha256": "lowercase-sha256-hex"
    }
  ]
}
```

The Android app currently limits a package to 500 files, 80 MiB per file, and 512 MiB total. Paths are case-sensitive and should use ASCII letters, digits, dot, underscore, hyphen, and slash.

## Catalog schema — remote MCQ banks

`catalog.json`:

```json
{
  "schema": "shbace-remote-content-catalog-v1",
  "version": "1.0.0",
  "systems": [
    {
      "id": "cardiovascular",
      "name": "Cardiovascular System",
      "icon": "media/icons/cardio.webp",
      "topics": [
        {
          "id": "congenital-heart-disease",
          "name": "Congenital Heart Disease",
          "icon": "media/topics/congenital-heart.webp"
        }
      ]
    }
  ],
  "banks": [
    {
      "id": "new-pediatrics-bank",
      "label": "New Pediatrics Bank",
      "description": "Additional questions for revision.",
      "cover": "media/covers/new-pediatrics.webp",
      "icon": "✚",
      "contentFile": "banks/new-pediatrics.json",
      "systemIds": ["cardiovascular"],
      "totalQuestions": 1
    }
  ]
}
```

## Question file schema

Each `contentFile` is a JSON file with schema `shbace-remote-questions-v1`:

```json
{
  "schema": "shbace-remote-questions-v1",
  "questions": [
    {
      "id": "cv-0001",
      "systemId": "cardiovascular",
      "topicId": "congenital-heart-disease",
      "stem": "A child presents with ... What is the most likely diagnosis?",
      "caseText": "Optional shared clinical vignette.",
      "options": ["Option A", "Option B", "Option C", "Option D", "Option E"],
      "correctIndex": 2,
      "explanation": "A short explanation.",
      "extendedExplanation": "Optional detailed explanation.",
      "tag": "Clinical Case",
      "source": "Reference or exam source"
    }
  ]
}
```

The question ID must remain stable when correcting the question. The engine derives a local question key from the bank ID and question ID, allowing existing local answers to remain attached after content refreshes. Do not reuse an ID for a different question.

## Media and other content

Media files (WebP/PNG/JPEG/SVG, PDF, MP4, MP3/M4A, and other binary files) can be included in `files` and referenced by relative path in the catalog. Cover art and system/topic icons can be displayed by the current Android remote-bank screens. The native content store can also read verified text files and small image/icon assets for additional Android renderers.

The first engine release currently renders declarative MCQ banks through the existing SHBACE question, answer, review, quiz, and statistics engine. PDFs, audio/video lessons, and flashcard decks can be distributed and cached by the content store, but their dedicated viewing/study screens require their corresponding in-app renderer to be added in a later APK update. Do not label those formats as active UI features until their renderer is implemented.



## Offline resources

Add a `resources` array to the catalog for files that should appear as separate learning-resource cards:

```json
{
  "id": "cah-guideline-pdf",
  "title": "Congenital Adrenal Hyperplasia — Study Guide",
  "description": "A downloadable reference document.",
  "type": "pdf",
  "file": "resources/cah-study-guide.pdf",
  "cover": "media/covers/cah-guide.webp",
  "systemId": "endocrinology",
  "topicId": "adrenal-disorders",
  "source": "SHBACE Medical"
}
```

Supported resource types are `pdf`, `audio`, `video`, `image`, and `file`. Files are downloaded and verified with the package, kept offline in app-private storage, and opened through Android's installed file/media apps. This does not require the learner to remain online; an appropriate viewer/player must be installed on the phone.

## Offline flashcard decks

Add a `flashcardDecks` array to the catalog. Each deck points to its own JSON file:

```json
{
  "id": "pediatric-cardiology-basics",
  "title": "Pediatric Cardiology Basics",
  "description": "Core facts for quick recall.",
  "cover": "media/covers/pediatric-cardiology.webp",
  "contentFile": "flashcards/pediatric-cardiology.json"
}
```

The deck file uses schema `shbace-remote-flashcards-v1`:

```json
{
  "schema": "shbace-remote-flashcards-v1",
  "cards": [
    {
      "id": "card-001",
      "front": "What is the most common congenital heart disease?",
      "back": "Ventricular septal defect (VSD).",
      "frontImage": "media/flashcards/vsd-front.webp",
      "backImage": "media/flashcards/vsd-diagram.webp",
      "topic": "Congenital Heart Disease"
    }
  ]
}
```

The Android app has a dedicated flip-card screen with previous/next navigation and "I know this" / "Review again" ratings. Card progress is stored locally using the deck and card IDs, so updating a card's text or adding cards does not reset the student's other study data. Keep both IDs stable for existing cards.

Question records may also include an `image` path. Small verified images are shown inside the question; larger images can be opened through Android's file viewer.



## Updating content that already exists in the APK

The `overrideFiles` property can point to one or more JSON files using schema `shbace-remote-overrides-v1`. This allows content corrections and artwork changes in existing banks without changing the question IDs:

```json
{
  "schema": "shbace-remote-overrides-v1",
  "systems": [
    { "id": "cardio", "name": "Cardiovascular System", "icon": "media/systems/cardio.webp" }
  ],
  "topics": [
    { "systemId": "cardio", "topicId": 42, "name": "Congenital Heart Disease", "icon": "media/topics/chd.webp" }
  ],
  "questionPatches": [
    {
      "id": "EXISTING-QUESTION-ID",
      "fields": {
        "stem": "Corrected question stem",
        "options": ["Option A", "Option B", "Option C", "Option D", "Option E"],
        "correctIndex": 2,
        "explanation": "Corrected explanation",
        "extendedExplanation": "Additional detail",
        "caseText": "Optional clinical vignette",
        "image": "media/questions/example.webp",
        "source": "Updated source"
      }
    }
  ],
  "collections": [
    { "id": "nelson", "title": "Nelson Textbook", "description": "Updated description", "cover": "media/covers/nelson.webp" }
  ]
}
```

Allowed existing collection IDs are `aj`, `previous`, `nelson`, `kasr`, `clinical`, and `egyptian`. Existing question IDs must be copied exactly from the current question bank. The app changes only the listed fields; its original question IDs and local answer/bookmark/note records remain in place. When replacing an answer or option order, check the existing answer meaning carefully, because stored answer selections are attached to the question ID.

The override package can also change system/Topic names and illustrations, or replace a collection cover. Image paths must be present in the same manifest and are verified before they are displayed.

## Publishing checklist

1. Put the catalog and bank JSON files under this directory.
2. Add any media assets and ensure paths match the catalog.
3. Recalculate every file's byte count and SHA-256 over the exact UTF-8/binary bytes.
4. Increase the manifest version and update the complete file inventory.
5. Run `node android-content/validate.mjs`, then run the Android build and test the update on a device: clean install, offline relaunch, delta update, failed download, and progress retention.
6. Commit the new catalog, data, media and manifest to `shbace-android-content`; the content-only validation workflow checks the package automatically.

This package is independent from the APK binary: content changes can be published without issuing a new APK once a compatible renderer exists.
