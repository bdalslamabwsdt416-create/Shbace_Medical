# SHBACE Medical — Navigation Route Contract v1

**Scope:** Android APK only  
**Frozen version:** \`com.shbace.medical\` · \`1.3.9\` · \`versionCode 18\`

## What exists today

The app's route state is the local variable \`appPage\`. Most route transitions set that value and call \`renderAppDemo()\`. The original switch in \`04-app-main.js\` renders Home, Specialties, Topics, Question Bank, Quiz setup/run/result, Smart Review, Statistics and Search. The feature bundle later wraps the renderer and uses a local \`PAGES\` map plus \`menuView()\` for additional routes.

The shared Back button is injected from the \`BACKP\` map in \`09-app-features-v6.js\`. Two route-specific rules matter:
- Question Bank uses a wildcard back target: Topics while scoped to a specialty, otherwise Home.
- Quiz Result can return to Quiz History if it was opened from the history list; otherwise it returns to Quiz.

The local History API snapshot in \`10-history-sync.js\` contains mode, onboarding slide, \`appPage\` and the Pediatrics collection. This is browser history only, not account or cross-device sync.

## Route inventory

The machine-readable source is \`to me/modules/routes.v1.json\`. It records:
- 29 built-in/local route entries, renderer family, group, current shared Back target and source-identified local stores;
- the distinct remote-target allow-lists from Remote UI V1 (46) and Remote Control V3 (47);
- local pages registered through \`__shbRegisterPage\`, including Exam Planner and remote Flashcards;
- the \`shbRemotePage_<id>\` pattern used for declarative remote pages.

The V3 remote target allow-list is broader than the V2 Remote UI allow-list. A route existing in the app is not proof that both remote engines accept it.

## Navigation Contract v1

Global API: \`window.SHBACENavigation\` (native Android only).

- \`list()\` / \`get(id)\`: immutable route metadata copies.
- \`classify(id)\`: identifies a known app route or a remote-page route candidate.
- \`current()\`: current route and app mode.
- \`validate(id)\`: checks a known route ID before using the adapter.
- \`navigate(id)\`: routes only to catalogued app IDs while the app is in app mode; it delegates to the existing \`appPage\` + \`renderAppDemo()\` mechanism.
- \`resolveBackTarget(id)\`: reflects the existing Back mapping and its special wildcard/history rules.
- \`back()\`: delegates to the existing \`navBack()\`; it does not create a new back stack.
- \`onChange(handler)\` / \`onRendered(handler)\`: subscribe through the Core event bus to local route and render events.
- \`isRemoteTarget(id, "v2"|"v3")\`: checks the actual version-specific remote allow-list.

The adapter is observational and additive: existing UI controls, routes, data stores and history implementation remain in place. It does not attempt to enumerate arbitrary remote page registrations or execute remote content.

## Data ownership

The manifest lists stores where the source clearly identifies route usage. Question-bank routes share the question-bank store; Quiz, Smart Review, Notes, Pinned/Recent, Notifications, Exam Planner, Timer, Settings and Remote Flashcards retain their separate stores. In particular, remote Flashcard \`Again/Known\` state remains separate from Smart Review scheduling.

## Validation

\`to me/tests/navigation-catalog.test.mjs\` checks route IDs, Back targets, V2/V3 allow-list parity, renderer/registration evidence, history-state scope, the route observer and adapter, and frozen version metadata.

Static route verification does not replace the Phase 0 physical Android acceptance matrix. Each route still needs a real-device pass for open, back, preserved scroll, data reads/writes, offline behaviour and native bridge calls before the navigation layer can be marked fully implemented.


## Shared route dispatch adapter (v1.1)

The Android navigation contract is now the preferred dispatch path for built-in routes opened from remote UI blocks and drawer items. Both surfaces ask `SHBACENavigation.validate()` before calling `navigate()`; the legacy `appPage = route; renderAppDemo()` path remains as a compatibility fallback when the Android contract is unavailable (including browser/PWA builds). Remote registered pages continue to use the existing `shbRemoteOpenPage()` registration flow and are not misclassified as built-in routes.

This adapter does not replace the legacy renderer, browser History API, back handlers, or local stores. Existing render wrappers continue to own history snapshots and route-change observation. The change only centralizes the route decision for supported built-in drawer and remote-UI navigation actions.
