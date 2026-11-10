# Android build notes

## Web asset staging

The Android Gradle build now assembles the split web project automatically:

- `index.html`
- `css/`, `js/`, and `data/`
- `img/`, `img1/`, and `img2/` merged into `www/assets/img/`
- `manifest.webmanifest` and `sw.js`

The `:app:preBuild` dependency runs `stageWebAssets` before copying the staged site into `android/app/src/main/assets/public`. You do not need to manually create `www/` first.

## Build a debug APK

1. Open the `android/` folder in Android Studio.
2. Use JDK 21 for this project's Gradle 8.14.3 wrapper.
3. Run **Build > Build Bundle(s) / APK(s) > Build APK(s)**, or run `gradlew.bat :app:assembleDebug` from the `android/` directory on Windows.
4. The debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.

## Release signing

A release APK is signed only when `android/keystore.properties` and the matching private keystore are configured. Keep those secrets out of Git. Start from `android/keystore.properties.example`.

## App identity safety

The current repository identity remains `com.shbace.medical`, versionCode `1`, versionName `1.0`. Do not change the application ID or version until they are checked against the APK already installed on the target phones; changing the application ID would install a separate app rather than update the existing one.

## Browser PWA

The root web build includes a manifest and a service worker for browser installs. The service worker is intentionally not registered inside Capacitor, which continues to use its native packaged assets.
