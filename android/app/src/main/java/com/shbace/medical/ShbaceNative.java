package com.shbace.medical;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * Two things a plain Android WebView cannot do on its own, exposed to the page as window.ShbaceNative:
 *
 *  - saveFile(name, mime, base64): the app's "Export backup" / "Export feedback" buttons create a Blob and click an
 *    <a download> link. WebView ignores that, so the page (see the shim in www/index.html) hands the bytes here and they
 *    are stored in the public Downloads folder (MediaStore on Android 10+, the app's own Downloads folder before that:
 *    no storage permission is needed in either case).
 *  - printHtml(html): the "Export PDF" button calls window.print(), which WebView does not implement. The generated
 *    document is rendered in a private WebView and handed to the system print dialog ("Save as PDF" / printers).
 *
 * Everything is wrapped in try/catch: on any failure the JS side simply falls back to the previous behaviour.
 */
final class ShbaceNative {
    private static final String TAG = "ShbaceNative";

    private final Activity activity;
    private WebView printView;            // kept alive until the print job has been handed to the PrintManager

    ShbaceNative(Activity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public boolean saveFile(String name, String mime, String base64) {
        try {
            final byte[] data = Base64.decode(base64, Base64.DEFAULT);
            final String safeName = sanitize(name);
            final String type = (mime == null || mime.length() == 0) ? "application/octet-stream" : mime;
            final String where = write(safeName, type, data);
            toast(safeName + " -> " + where);
            return true;
        } catch (Throwable t) {
            Log.e(TAG, "saveFile failed", t);
            toast("Could not save the file");
            return false;
        }
    }

    @JavascriptInterface
    public boolean printHtml(final String html) {
        if (html == null || html.length() == 0) return false;
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    final WebView wv = new WebView(activity);
                    wv.getSettings().setJavaScriptEnabled(false);          // static document only
                    wv.setWebViewClient(new WebViewClient() {
                        private boolean printed = false;

                        @Override
                        public void onPageFinished(WebView view, String url) {
                            if (printed) return;
                            printed = true;
                            try {
                                PrintManager pm = (PrintManager) activity.getSystemService(Context.PRINT_SERVICE);
                                PrintDocumentAdapter adapter = view.createPrintDocumentAdapter("SHBACE Medical");
                                pm.print("SHBACE Medical", adapter, new PrintAttributes.Builder().build());
                            } catch (Throwable t) {
                                Log.e(TAG, "print failed", t);
                                toast("Printing is not available on this device");
                            }
                        }
                    });
                    printView = wv;
                    wv.loadDataWithBaseURL("about:blank", html, "text/html", "UTF-8", null);
                } catch (Throwable t) {
                    Log.e(TAG, "printHtml failed", t);
                    toast("Printing is not available on this device");
                }
            }
        });
        return true;
    }


    @JavascriptInterface
    public void keepScreenOn(final boolean enabled) {
        activity.runOnUiThread(new Runnable() {
            @Override public void run() {
                if (enabled) activity.getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else activity.getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            }
        });
    }

    @JavascriptInterface
    public void haptic(String kind) {
        try {
            android.os.Vibrator vibrator = (android.os.Vibrator) activity.getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator == null || !vibrator.hasVibrator()) return;
            String k = kind == null ? "light" : kind.toLowerCase(java.util.Locale.US);
            long[] pattern;
            int[] amplitude;
            if ("correct".equals(k)) {
                pattern = new long[]{0, 24, 42, 30};
                amplitude = new int[]{0, 90, 0, 135};
            } else if ("wrong".equals(k)) {
                pattern = new long[]{0, 42, 48, 42, 48, 42};
                amplitude = new int[]{0, 150, 0, 120, 0, 150};
            } else {
                pattern = new long[]{0, 12};
                amplitude = new int[]{0, 70};
            }
            if (Build.VERSION.SDK_INT >= 26) {
                vibrator.vibrate(android.os.VibrationEffect.createWaveform(pattern, amplitude, -1));
            } else {
                vibrator.vibrate(pattern, -1);
            }
        } catch (Throwable t) {
            Log.w(TAG, "haptic unavailable", t);
        }
    }

    @JavascriptInterface
    public void updateStudyTimer(long elapsedMs, boolean running) {
        try {
            android.content.Intent intent = new android.content.Intent(activity, StudyTimerService.class);
            intent.setAction(StudyTimerService.ACTION_UPDATE);
            intent.putExtra(StudyTimerService.EXTRA_ELAPSED, Math.max(0L, elapsedMs));
            intent.putExtra(StudyTimerService.EXTRA_RUNNING, running);
            if (Build.VERSION.SDK_INT >= 26) androidx.core.content.ContextCompat.startForegroundService(activity, intent);
            else activity.startService(intent);
        } catch (Throwable t) {
            Log.e(TAG, "Could not update study timer notification", t);
        }
    }

    @JavascriptInterface
    public void stopStudyTimer() {
        try {
            StudyTimerService.clearSavedState(activity);
            activity.stopService(new android.content.Intent(activity, StudyTimerService.class));
        } catch (Throwable t) {
            Log.e(TAG, "Could not stop study timer notification", t);
        }
    }

    @JavascriptInterface
    public void speakText(final String text, final String language, final float rate) {
        if (text == null || text.trim().length() == 0) return;
        activity.runOnUiThread(new Runnable() {
            @Override public void run() {
                try {
                    pendingSpeech = text;
                    pendingLanguage = (language == null || language.length() == 0) ? "en-US" : language;
                    pendingRate = Math.max(0.65f, Math.min(1.4f, rate));
                    if (tts == null) {
                        tts = new android.speech.tts.TextToSpeech(activity, status -> {
                            if (status == android.speech.tts.TextToSpeech.SUCCESS) {
                                ttsReady = true;
                                speakPending();
                            } else {
                                ttsReady = false;
                                toast("Speech engine is not available");
                            }
                        });
                    } else if (ttsReady) {
                        speakPending();
                    }
                } catch (Throwable t) {
                    Log.e(TAG, "Text to speech failed", t);
                    toast("Could not read this question aloud");
                }
            }
        });
    }

    @JavascriptInterface
    public void stopSpeaking() {
        activity.runOnUiThread(new Runnable() {
            @Override public void run() {
                try { if (tts != null) tts.stop(); pendingSpeech = null; }
                catch (Throwable t) { Log.w(TAG, "TTS stop failed", t); }
            }
        });
    }

    private android.speech.tts.TextToSpeech tts;
    private boolean ttsReady = false;
    private String pendingSpeech = null;
    private String pendingLanguage = "en-US";
    private float pendingRate = 1f;

    private void speakPending() {
        if (tts == null || !ttsReady || pendingSpeech == null) return;
        try {
            java.util.Locale locale = java.util.Locale.forLanguageTag(pendingLanguage);
            tts.setLanguage(locale);
            tts.setSpeechRate(pendingRate);
            // Prefer a voice whose provider explicitly labels it male; fall back to the best matching English voice.
            if (Build.VERSION.SDK_INT >= 21) {
                android.speech.tts.Voice chosen = null;
                java.util.Set<android.speech.tts.Voice> voices = tts.getVoices();
                if (voices != null) {
                    for (android.speech.tts.Voice voice : voices) {
                        if (voice == null || voice.getLocale() == null) continue;
                        if (!voice.getLocale().getLanguage().equalsIgnoreCase(locale.getLanguage())) continue;
                        String name = voice.getName() == null ? "" : voice.getName().toLowerCase(java.util.Locale.US);
                        if (name.contains("male") || name.contains("masculine")) {
                            chosen = voice;
                            break;
                        }
                        if (chosen == null || voice.getQuality() > chosen.getQuality()) chosen = voice;
                    }
                }
                if (chosen != null) tts.setVoice(chosen);
            }
            tts.speak(pendingSpeech, android.speech.tts.TextToSpeech.QUEUE_FLUSH, null, "shbace-question");
            pendingSpeech = null;
        } catch (Throwable t) {
            Log.e(TAG, "Could not start speech", t);
            toast("Could not read this question aloud");
        }
    }

    @JavascriptInterface
    public void copyText(final String text) {
        if (text == null) return;
        activity.runOnUiThread(new Runnable() {
            @Override public void run() {
                try {
                    android.content.ClipboardManager cm = (android.content.ClipboardManager) activity.getSystemService(Context.CLIPBOARD_SERVICE);
                    if (cm != null) cm.setPrimaryClip(android.content.ClipData.newPlainText("Shbace Medical", text));
                    // Success feedback is shown once by the calling web UI.
                } catch (Throwable t) { toast("Could not copy text"); }
            }
        });
    }

    @JavascriptInterface
    public void shareText(final String text) {
        if (text == null || text.trim().length() == 0) return;
        activity.runOnUiThread(new Runnable() {
            @Override public void run() {
                try {
                    android.content.Intent send = new android.content.Intent(android.content.Intent.ACTION_SEND);
                    send.setType("text/plain");
                    send.putExtra(android.content.Intent.EXTRA_TEXT, text);
                    activity.startActivity(android.content.Intent.createChooser(send, "Share question"));
                } catch (Throwable t) { toast("Could not open sharing options"); }
            }
        });
    }

    @JavascriptInterface
    public void shareImage(final String base64) {
        if (base64 == null || base64.length() == 0) return;
        activity.runOnUiThread(new Runnable() {
            @Override public void run() {
                java.io.FileOutputStream out = null;
                try {
                    byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                    java.io.File dir = new java.io.File(activity.getCacheDir(), "shared");
                    if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("cache folder unavailable");
                    java.io.File file = new java.io.File(dir, "shbace-progress-" + System.currentTimeMillis() + ".png");
                    out = new java.io.FileOutputStream(file);
                    out.write(bytes); out.flush(); out.close(); out = null;
                    Uri uri = androidx.core.content.FileProvider.getUriForFile(activity,
                            activity.getPackageName() + ".fileprovider", file);
                    android.content.Intent send = new android.content.Intent(android.content.Intent.ACTION_SEND);
                    send.setType("image/png");
                    send.putExtra(android.content.Intent.EXTRA_STREAM, uri);
                    send.addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    activity.startActivity(android.content.Intent.createChooser(send, "Share study progress"));
                } catch (Throwable t) {
                    Log.e(TAG, "shareImage failed", t);
                    toast("Could not share the progress card");
                } finally {
                    if (out != null) try { out.close(); } catch (Exception ignored) {}
                }
            }
        });
    }

    @JavascriptInterface
    public String getDeviceInfo() {
        try {
            android.content.pm.PackageInfo p = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
            long code = Build.VERSION.SDK_INT >= 28 ? p.getLongVersionCode() : p.versionCode;
            String name = p.versionName == null ? "unknown" : p.versionName;
            String model = Build.MANUFACTURER + " " + Build.MODEL;
            return "Package: " + activity.getPackageName() + "\nVersion: " + name + " (" + code + ")" +
                    "\nAndroid: " + Build.VERSION.RELEASE + " · API " + Build.VERSION.SDK_INT +
                    "\nDevice: " + model + "\nBuild: " +
                    (((activity.getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) ? "debug" : "release");
        } catch (Throwable t) { return "Package: " + activity.getPackageName() + "\nAndroid API: " + Build.VERSION.SDK_INT; }
    }

    void shutdown() {
        try { if (tts != null) { tts.stop(); tts.shutdown(); tts = null; ttsReady = false; } }
        catch (Throwable ignored) {}
        try { activity.getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); }
        catch (Throwable ignored) {}
    }

    // ------------------------------------------------------------------------------------------------------------

    private String write(String name, String mime, byte[] data) throws Exception {
        if (Build.VERSION.SDK_INT >= 29) {
            final ContentResolver resolver = activity.getContentResolver();
            final ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
            final Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IllegalStateException("MediaStore insert failed");
            final OutputStream os = resolver.openOutputStream(uri);
            if (os == null) throw new IllegalStateException("openOutputStream failed");
            try {
                os.write(data);
            } finally {
                os.close();
            }
            return "Downloads";
        }
        File dir = activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (dir == null) dir = activity.getFilesDir();
        if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("cannot create " + dir);
        File out = new File(dir, name);
        int n = 1;
        while (out.exists()) {
            final int dot = name.lastIndexOf('.');
            out = new File(dir, dot > 0 ? name.substring(0, dot) + " (" + n + ")" + name.substring(dot) : name + " (" + n + ")");
            n++;
        }
        final OutputStream os = new FileOutputStream(out);
        try {
            os.write(data);
        } finally {
            os.close();
        }
        return out.getAbsolutePath();
    }

    private static String sanitize(String name) {
        String n = (name == null) ? "" : name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_").trim();
        if (n.length() == 0) n = "shbace-medical-file";
        return n.length() > 120 ? n.substring(0, 120) : n;
    }

    private void toast(final String msg) {
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Toast.makeText(activity, msg, Toast.LENGTH_LONG).show();
            }
        });
    }
}
