# SHBACE Medical — Android remote content package

This directory is the content origin used by the **Android APK remote-content engine**.
Publish content-only updates by committing to `main` under `for ApK/android-content/`. The old `shbace-android-content` branch remains as a historical staging copy; the APK reads the feed from this folder on `main`. Content-only commits are validated automatically and do not trigger an APK rebuild or affect PWA/Chrome/iOS release flows.

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

The APK runtime renders remote MCQ banks through the existing SHBACE question, answer, review, quiz, and statistics engine. It also renders remote flashcard decks and learning-resource cards. Verified PDF/audio/video/image/file resources are stored offline and opened using compatible Android viewer/player apps; document rendering and playback are delegated to those installed apps.



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

## Publishing checklist — current main branch workflow

1. Add the bank JSON file under `for ApK/android-content/banks/` and add any cover, system icon, topic icon, or question images under `for ApK/android-content/media/`.
2. Add the matching system, topics, and bank record to `for ApK/android-content/catalog.json`.
3. Add every new or changed file to `for ApK/android-content/manifest.json`, with its exact byte count and SHA-256. The manifest must include the catalog and all referenced JSON/media files.
4. Increase the version in both `manifest.json` and `catalog.json` to the same new value.
5. From the repository root, run `node "for ApK/android-content/validate.mjs"` (or open a pull request and check the content validation result).
6. Commit or merge the content files into `main` under `for ApK/android-content/`. The content validation workflow runs automatically. Content-only changes in this folder do not trigger an APK build.
7. In the Android app, open Settings and press **Check for content updates** to test immediately. Otherwise the APK checks periodically when it has an internet connection.

Do not publish new content to the old `shbace-android-content` branch: it is a historical staging copy. The installed APK reads the feed from `main/for ApK/android-content/manifest.json`.

This package is independent from the APK binary. A compatible APK can receive new banks, questions, metadata, images, resources, and flashcard decks without a new APK release. Changes to the app's UI or the remote-content engine still require an APK build.
