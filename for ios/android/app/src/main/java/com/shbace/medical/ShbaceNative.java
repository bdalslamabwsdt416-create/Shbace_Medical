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
