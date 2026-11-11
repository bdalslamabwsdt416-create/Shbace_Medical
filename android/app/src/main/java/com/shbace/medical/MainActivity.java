package com.shbace.medical;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.pm.ApplicationInfo;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

import java.util.Locale;

/**
 * Shbace Medical host activity.
 *
 * - Native splash (androidx SplashScreen) is only an icon-less dark placeholder (see AppTheme.NoActionBarLaunch) and is
 *   released at the FIRST drawn frame, so the page's own splash is what the user sees first. It is no longer held until the
 *   page calls ShbaceInsets.ready(): the page never called it, so the placeholder used to cover the web splash for the full 2.5 s.
 * - Edge-to-edge: content draws behind transparent status/navigation bars. The REAL insets are
 *   handed to the page ONCE via window.ShbaceInsets.get() + the 'shbace-insets' event; the page pads
 *   itself. Native code never also pads the WebView for the system bars (no doubling).
 * - Keyboard: with edge-to-edge adjustResize no longer resizes the window, so the IME height is
 *   applied as bottom padding of the content view, and the page is told bottom=0 while it is open.
 * - Immersive Sticky full-screen: status bar + navigation bar are hidden natively
 *   (WindowInsetsControllerCompat, BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE). An edge swipe shows them
 *   transiently and the system hides them again by itself. Hiding is re-applied on resume, window focus,
 *   rotation and after the keyboard closes. The insets handed to the page are the CURRENT ones, so with the
 *   bars hidden the page only keeps the display-cutout (camera hole) safe area and uses the full screen.
 * - Notification channels for local notifications (review / quiz / reminders).
 * Back button: intentionally NOT handled here (Capacitor + the web page's App 'backButton' listener).
 */
public class MainActivity extends BridgeActivity {
    private static final String TAG = "ShbaceInsets";
    private static final int APP_BG = Color.parseColor("#030B1F");

    private volatile String insetsJson = "{\"top\":0,\"bottom\":0,\"left\":0,\"right\":0}";
    private volatile boolean webReady = false;
    private boolean imeWasVisible = false;
    private ShbaceNative nativeBridge;

    /** Exposed to JS as window.ShbaceInsets */
    private final class InsetsBridge {
        @JavascriptInterface public String get() { return insetsJson; }
        /** Kept for compatibility (no-op for the splash now: it is no longer held until this is called). */
        @JavascriptInterface public void ready() { webReady = true; }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Must run before super.onCreate(): swaps Theme.SplashScreen for the post-splash theme.
        // No keep-on-screen condition: the system splash ends at the first frame instead of waiting for the page.
        SplashScreen.installSplashScreen(this);

        super.onCreate(savedInstanceState);

        final boolean debuggable = (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        WebView.setWebContentsDebuggingEnabled(debuggable); // remote debugging only in debug builds

        // ---- edge-to-edge window ----
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        // Draw into the camera cut-out area too (otherwise the hidden status bar leaves a black strip).
        // The page keeps clear of the cut-out through the insets it receives below.
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = Build.VERSION.SDK_INT >= 30
                    ? WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                    : WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 29) {
            getWindow().setNavigationBarContrastEnforced(false); // no grey scrim behind 3-button nav
        }
        final View decor = getWindow().getDecorView();
        decor.setBackgroundColor(APP_BG); // nothing black/white before the WebView paints

        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), decor);
        c.setAppearanceLightStatusBars(false);      // light icons on the dark background
        c.setAppearanceLightNavigationBars(false);

        // ---- WebView ----
        final WebView web = getBridge().getWebView();
        web.setBackgroundColor(APP_BG);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER); // no stretch/glow at scroll ends
        web.addJavascriptInterface(new InsetsBridge(), "ShbaceInsets");
        nativeBridge = new ShbaceNative(this);
        web.addJavascriptInterface(nativeBridge, "ShbaceNative"); // file, print, haptics, TTS, timer service and sharing bridge

        final View content = findViewById(android.R.id.content);

        ViewCompat.setOnApplyWindowInsetsListener(decor, (v, insets) -> {
            // CURRENT system bars + cutout. With the bars hidden (immersive) this is only the cut-out,
            // so the page uses the whole screen; if a bar is visible the page still pads for it.
            // Transient (swipe-revealed) bars overlay the page and do not change this value.
            Insets bars = insets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());

            boolean imeVisible;
            int imeBottom;
            if (Build.VERSION.SDK_INT >= 30) {
                imeVisible = insets.isVisible(WindowInsetsCompat.Type.ime());
                imeBottom = imeVisible ? insets.getInsets(WindowInsetsCompat.Type.ime()).bottom : 0;
            } else {
                @SuppressWarnings("deprecation") int sys = insets.getSystemWindowInsetBottom();
                @SuppressWarnings("deprecation") int stable = insets.getStableInsetBottom();
                imeVisible = sys > stable;
                imeBottom = imeVisible ? sys : 0;
            }

            // Some keyboards bring the navigation bar back: hide it again once the keyboard closes.
            if (imeWasVisible && !imeVisible) decor.post(this::hideSystemBars);
            imeWasVisible = imeVisible;

            // Keyboard open: the WebView ends at the top of the keyboard, which already covers the
            // navigation bar, so the page must not add the bottom inset a second time.
            if (content != null && content.getPaddingBottom() != imeBottom) {
                content.setPadding(0, 0, 0, imeBottom);
            }
            float d = getResources().getDisplayMetrics().density;
            insetsJson = String.format(Locale.US,
                    "{\"top\":%.2f,\"bottom\":%.2f,\"left\":%.2f,\"right\":%.2f}",
                    bars.top / d, imeVisible ? 0f : bars.bottom / d, bars.left / d, bars.right / d);

            web.post(() -> {
                web.evaluateJavascript("window.dispatchEvent(new Event('shbace-insets'))", null);
                if (debuggable) logLayout(web, decor);
            });
            return ViewCompat.onApplyWindowInsets(v, insets); // not consumed
        });
        ViewCompat.requestApplyInsets(decor);

        createNotificationChannels();

        hideSystemBars();
        // Plugins loaded during super.onCreate() may touch the bars; apply once more after startup.
        new Handler(Looper.getMainLooper()).postDelayed(this::hideSystemBars, 700);
    }

    @Override
    public void onDestroy() {
        if (nativeBridge != null) nativeBridge.shutdown();
        super.onDestroy();
    }

    /** Immersive Sticky: hide status + navigation bars; an edge swipe reveals them only transiently. */
    private void hideSystemBars() {
        final Window w = getWindow();
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(w, w.getDecorView());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        c.hide(WindowInsetsCompat.Type.systemBars());
    }

    @Override
    public void onResume() {
        super.onResume();
        hideSystemBars(); // back from background / another app
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars(); // dialogs, permission prompts, shade pulled down and released
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        hideSystemBars(); // rotation (the activity handles it without being recreated)
    }

    /** Debug-only self check that the WebView was NOT also shrunk by a framework/Capacitor margin. */
    private void logLayout(WebView web, View decor) {
        int[] loc = new int[2];
        web.getLocationInWindow(loc);
        Log.d(TAG, "webview y=" + loc[1] + " h=" + web.getHeight() + " decorH=" + decor.getHeight()
                + " insets=" + insetsJson + "  (expect y=0 and h=decorH when keyboard is closed)");
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;
        nm.createNotificationChannel(channel("review", R.string.channel_review, R.string.channel_review_desc,
                NotificationManager.IMPORTANCE_DEFAULT));
        nm.createNotificationChannel(channel("quiz", R.string.channel_quiz, R.string.channel_quiz_desc,
                NotificationManager.IMPORTANCE_DEFAULT));
        nm.createNotificationChannel(channel("reminders", R.string.channel_reminders, R.string.channel_reminders_desc,
                NotificationManager.IMPORTANCE_LOW));
    }

    private NotificationChannel channel(String id, int nameRes, int descRes, int importance) {
        NotificationChannel ch = new NotificationChannel(id, getString(nameRes), importance);
        ch.setDescription(getString(descRes));
        return ch;
    }
}
