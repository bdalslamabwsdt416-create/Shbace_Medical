# Shbace Medical — Chrome Android PWA

Dedicated Progressive Web App for Google Chrome on Android. This deployment is separate from the Computer PWA and the signed Android APK.

## Source and release

- Active app source: the current unified `to me/` application source, adapted for Android Chrome.
- Release: `1.3.10-chrome.1` (1.3.10.1 · Chrome Android).
- Vercel project: `shbace-medical-chrome-android`.
- Production domain: `https://shbace-medical-chrome-android.vercel.app`.
- The Android Chrome bridge is enabled only for Android Chrome and does not create a fake Capacitor bridge.

## Protected device storage

The existing Chrome Android storage identifiers are retained:

- Cache Storage: `shbace-chrome-offline-v1.3.4`
- IndexedDB: `shbace-medical-offline-state-v1`
- Existing localStorage preferences, answers, bookmarks, notes, quiz attempts and student progress remain on the same origin.

The offline updater adopts the existing verified package, checks cached files by byte size and SHA-256, stages changed or missing files, verifies the staged package, then applies the update. Do not rotate the cache name for ordinary releases.

## Build and checks

Run from this directory:

```bash
npm ci
npm run test:unit
npm run check:bank
npm run build:pwa
```

The build produces the static PWA in `www/` and generates `offline-assets-manifest.json` from the verified app files.
