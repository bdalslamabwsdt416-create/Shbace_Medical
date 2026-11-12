# SHBACE Medical — Chrome Android PWA

This is an independent Google Chrome / Android Progressive Web App delivery copied from the Android v1.3.4 source branch.

## Included

- Same runtime, question-bank data and assets as the v1.3.4 Android branch.
- Browser-adapted Android study tools: Share / Copy / Read aloud, doctor preference, automatic theme, haptics where supported, Exam Goal Planner and Android navigation refinements.
- Chrome install guidance, fullscreen launch mode and Screen Wake Lock while the Question Bank is open.
- Separate service-worker cache and resumable offline package with SHA-256 verification.
- Background update checks that defer reloads while the Question Bank is open.

## Browser limitations

Capacitor notifications, exact Android alarms and the native foreground study-timer service belong to the APK. Chrome does not expose these services to a website; this PWA does not display them as if they were working. Wake Lock, Web Share, clipboard, vibration and speech depend on Chrome support and permissions.

## Build and deployment

- Build: `npm run build:pwa`
- Vercel root: `for Chrome`
- Output: `www/`
- This has its own Vercel project/domain and does not replace the iOS PWA or Android APK.
