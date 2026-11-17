# SHBACE Medical — Chrome Android PWA

This directory is the independent production delivery for **Google Chrome on Android**.

- Production site: https://shbace-medical-chrome-android.vercel.app
- Release: `1.3.10-chrome.1`
- Validation: `npm ci`, `npm run test:unit`, `npm run check:bank`, and `npm run build:pwa`
- Vercel output directory: `www`

The application is synchronized with the latest unified `to me` source, including the current question banks, AI Clinical Cases, shared question engine, unified voice, study tools, and in-app Islamic reminders. The Android Chrome entry guard and Android-specific manifest identity remain in this delivery.

## Existing-device continuity

Do not rotate the Cache Storage namespace or rename the IndexedDB database during routine releases:

- Cache Storage: `shbace-chrome-offline-v1.3.4`
- IndexedDB: `shbace-medical-offline-state-v1`

The Service Worker and offline installer retain the existing cache. Updates are staged and checked by byte size and SHA-256 before committing. Student progress and local preferences are not intentionally cleared.

The retired standalone Chrome styles and clinical-case renderer are replaced by the unified CSS bundles and shared bank engine.