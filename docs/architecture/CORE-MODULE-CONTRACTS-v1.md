# SHBACE Medical — Core & Module Registry Contracts v1

**Target:** Android APK only  
**Frozen Android release:** \`com.shbace.medical\`, \`versionName 1.3.9\`, \`versionCode 18\`  
**Approach:** additive strangler architecture; preserve existing feature implementations until an adapter passes parity tests.

## Scope of this increment

This increment establishes two local runtime foundations without rewriting existing screens or feature engines:

1. **Core Runtime v1** — a small event bus, named service registry and bounded in-memory diagnostics.
2. **Module Registry v1** — explicit local module contracts, dependency validation, ordered asynchronous initialization, lifecycle state and reverse-order cleanup.

The machine-readable product inventory is \`to me/modules/module-manifest.v1.json\`. It deliberately distinguishes \`implemented\`, \`partial\` and \`planned\`; it is not a claim that every listed legacy feature has already been extracted.

## Runtime contracts

### Core

Global entry point: \`window.SHBACECore\`.

- \`version\` is the Core implementation version; \`apiVersion\` is the contract number.
- \`events.on(name, handler)\` returns an unsubscribe function.
- \`events.once(name, handler)\` subscribes for one delivery.
- \`events.off(name, handler)\` and \`events.emit(name, payload)\` manage local events.
- \`services.register(name, value, { replace })\` avoids accidental replacement by default.
- \`services.get/has/remove/list\` provide named service access.
- \`diagnostics.record/snapshot/clear\` holds the latest 100 in-memory diagnostic records.
- The native bridge, when present, is registered as \`android.native\`.

The Core does not persist, transform or delete student records. It does not modify localStorage, IndexedDB, SharedPreferences or remote content.

### Module Registry

Global entry point: \`window.SHBACEModuleRegistry\`.

A module must be registered by local application code with:
- a stable identifier and a simple \`major.minor.patch\` module version;
- a local \`initialize(context)\` function;
- optional dependency identifiers, supported platforms and declared capabilities.

Lifecycle states are \`registered\`, \`starting\`, \`ready\`, \`failed\`, \`skipped\` and \`disposed\`.

The registry:
- validates missing dependencies and dependency cycles before initialization;
- initializes dependencies before dependents;
- serializes initialization/disposal operations;
- records initialization failures and prevents dependents from starting when dependencies are not ready;
- disposes ready modules in reverse initialization order;
- refuses duplicate IDs and refuses unregistering a module that still has dependents.

A module's cleanup may be returned as a function or as an object with \`dispose()\`. The registry does not fetch module code, use \`eval\`, construct functions from strings, or interpret remote HTML/JavaScript.

## Integration boundary

These two runtime scripts are loaded after the current Android remote-control and Settings modules. They are guarded by the real Capacitor Android native platform check. Chrome, Computer and iOS delivery paths must not execute these Android-only runtime capabilities.

Existing legacy modules remain as-is until each has:
1. a defined adapter contract;
2. characterization tests for current behaviour;
3. parity tests for the adapter;
4. a data-preservation review;
5. a rollback path.

## Current inventory

The module manifest is the status record for all major blueprint subsystems. At this increment, only Core and Module Registry are marked implemented as extracted runtime foundations. Existing Quiz, Smart Review, Medical Bank, Statistics, Navigation, Data, Offline and Notifications capabilities are classified as partial/legacy rather than falsely declared modular.

## Validation

\`to me/tests/core-module-registry.test.mjs\` exercises Android-only activation, event subscription and one-shot delivery, service overwrite protection, dependency ordering, missing/cyclic dependency rejection, initialization failure propagation, reverse-order cleanup, duplicate module rejection, module coverage and the frozen APK version invariant.

CI still builds the Android APK and runs the existing PWA checks. A physical-device route and visual acceptance pass is a separate Phase 0 exit criterion and is not replaced by static tests.
