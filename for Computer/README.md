# SHBACE Medical — Computer PWA

Independent desktop and laptop Progressive Web App copied from the SHBACE Chrome Android delivery.

## What is preserved

- Same application screens, question bank, learning data, images, branding, and feature scripts as the Chrome Android project.
- Same browser-adapted study tools and browser-safe behavior; native Android services are not simulated.
- Independent manifest, service worker, cache namespace, offline database, and offline asset verification.

## Computer-specific changes

- Removes the fixed 430px phone frame used by the mobile layout.
- The app background and main screen fill the available browser or installed-app window.
- On very wide displays, the primary app content stays centered with a 1320px readable maximum width.
- Uses a desktop manifest with standalone launch mode and fullscreen display override.
- Adds Chrome desktop install guidance, a fullscreen control, and Screen Wake Lock while the Question Bank is open when supported.

## Browser limitations

Native Android notifications, exact alarms, and the APK foreground study-timer service remain APK-only. Browser installation prompts, fullscreen, clipboard, speech, sharing, and wake lock depend on browser support and permissions.

## Build and deployment

- Build: `npm run build:pwa`
- Vercel root: `for Computer`
- Output: `www/`
- Separate public deployment; does not replace the mobile Chrome PWA, iOS PWA, or Android APK.
- Offline download and SHA-256 verification run on first setup.
