package com.shbace.medical;

import android.app.Activity;
import android.util.Base64;
import android.util.Log;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Android-only remote learning-content store.
 *
 * Content is kept in versioned private app storage. Downloads are staged and verified before
 * current-manifest.json is switched, so an interrupted update never exposes a half-installed pack.
 * Student answers/progress remain in the existing WebView localStorage and are not touched here.
 */
final class RemoteContentManager {
    private static final String TAG = "ShbaceRemoteContent";
    static final String MANIFEST_URL =
            "https://raw.githubusercontent.com/bdalslamabwsdt416-create/Shbace_Medical/main/for%20ApK/android-content/manifest.json";
    private static final String CONTENT_BASE =
            "https://raw.githubusercontent.com/bdalslamabwsdt416-create/Shbace_Medical/main/for%20ApK/android-content/";
    private static final String SCHEMA = "shbace-android-content-v1";
    private static final int CONNECT_TIMEOUT_MS = 15000;
    private static final int READ_TIMEOUT_MS = 30000;
    private static final long MAX_MANIFEST_BYTES = 2L * 1024L * 1024L;
    private static final long MAX_FILE_BYTES = 80L * 1024L * 1024L;
    private static final long MAX_TOTAL_BYTES = 512L * 1024L * 1024L;
    private static final int MAX_FILES = 500;
    private static final long MAX_TEXT_BYTES = 16L * 1024L * 1024L;
    private static final long MAX_INLINE_ASSET_BYTES = 3L * 1024L * 1024L;

    private final Activity activity;
    private final WebView webView;
    private final File root;
    private final File versionsDir;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private volatile boolean syncing = false;

    RemoteContentManager(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
        this.root = new File(activity.getFilesDir(), "shbace-remote-content");
        this.versionsDir = new File(root, "versions");
        if (!versionsDir.exists()) versionsDir.mkdirs();
    }

    synchronized boolean startSync(String manifestUrl) {
        if (syncing || executor.isShutdown()) return false;
        if (!isAllowedManifestUrl(manifestUrl)) {
            postResult(errorJson("Remote content manifest URL is not allowed."));
            return false;
        }
        syncing = true;
        executor.execute(new Runnable() {
            @Override public void run() {
                String result;
                try {
                    result = syncNow();
                } catch (Throwable error) {
                    Log.e(TAG, "Remote content sync failed", error);
                    result = errorJson(error.getMessage() == null ? "Content update failed." : error.getMessage());
                } finally {
                    syncing = false;
                }
                postResult(result);
            }
        });
        return true;
    }

    String getManifest() {
        try {
            File file = new File(root, "current-manifest.json");
            if (!file.isFile() || file.length() > MAX_MANIFEST_BYTES) return "";
            return new String(readFile(file, MAX_MANIFEST_BYTES), java.nio.charset.StandardCharsets.UTF_8);
        } catch (Throwable error) {
            Log.w(TAG, "Could not read installed content manifest", error);
            return "";
        }
    }

    String getState() {
        JSONObject state = new JSONObject();
        try {
            JSONObject manifest = parseCurrentManifest();
            long lastSync = activity.getSharedPreferences("shbace_remote_content", 0).getLong("last_sync", 0L);
            state.put("installed", manifest != null);
            state.put("syncing", syncing);
            state.put("lastSync", lastSync);
            if (manifest != null) {
                state.put("version", manifest.optString("version", ""));
                JSONObject lastKnownGood = readManifestFile("previous-manifest.json");
                state.put("lastKnownGoodVersion", lastKnownGood == null ? "" : lastKnownGood.optString("version", ""));
                state.put("canRollback", lastKnownGood != null && verifyInstalledVersion(lastKnownGood));
                JSONArray files = manifest.optJSONArray("files");
                state.put("fileCount", files == null ? 0 : files.length());
                state.put("totalBytes", manifest.optLong("totalBytes", 0L));
            }
            File[] dirs = versionsDir.listFiles();
            state.put("retainedVersions", dirs == null ? 0 : dirs.length);
        } catch (Throwable error) {
            try { state.put("error", error.getMessage()); } catch (Throwable ignored) {}
        }
        return state.toString();
    }

    String readText(String relativePath) {
        try {
            File file = resolveCurrentFile(relativePath);
            if (file == null || !file.isFile() || file.length() > MAX_TEXT_BYTES) return "";
            return new String(readFile(file, MAX_TEXT_BYTES), java.nio.charset.StandardCharsets.UTF_8);
        } catch (Throwable error) {
            Log.w(TAG, "Could not read remote content text: " + relativePath, error);
            return "";
        }
    }

    String readBase64(String relativePath) {
        try {
            File file = resolveCurrentFile(relativePath);
            if (file == null || !file.isFile() || file.length() > MAX_INLINE_ASSET_BYTES) return "";
            return Base64.encodeToString(readFile(file, MAX_INLINE_ASSET_BYTES), Base64.NO_WRAP);
        } catch (Throwable error) {
            Log.w(TAG, "Could not read remote content asset: " + relativePath, error);
            return "";
        }
    }

    File getVerifiedFile(String relativePath) {
        try {
            File file = resolveCurrentFile(relativePath);
            return file != null && file.isFile() ? file : null;
        } catch (Throwable error) {
            Log.w(TAG, "Could not resolve verified remote content file: " + relativePath, error);
            return null;
        }
    }

    private String syncNow() throws Exception {
        byte[] manifestBytes = downloadBytes(new URL(MANIFEST_URL), MAX_MANIFEST_BYTES);
        JSONObject manifest = new JSONObject(new String(manifestBytes, java.nio.charset.StandardCharsets.UTF_8));
        validateManifest(manifest);

        JSONObject previous = parseCurrentManifest();
        int candidateContentCode = manifest.getInt("contentVersionCode");
        if (previous != null) {
            int installedContentCode = previous.optInt("contentVersionCode", 0);
            if (candidateContentCode < installedContentCode) {
                throw new IllegalArgumentException("A content downgrade was blocked.");
            }
            if (candidateContentCode == installedContentCode &&
                    !manifest.getString("version").equals(previous.optString("version"))) {
                throw new IllegalArgumentException("Content version code must increase for every new package.");
            }
        }
        String version = manifest.getString("version");
        JSONArray newFiles = manifest.getJSONArray("files");
        Map<String, JSONObject> oldByPath = indexFiles(previous == null ? null : previous.optJSONArray("files"));
        Map<String, JSONObject> newByPath = indexFiles(newFiles);
        long totalBytes = 0L;
        int changedCount = 0;
        int unchangedCount = 0;
        long downloadedBytes = 0L;
        for (int i = 0; i < newFiles.length(); i++) {
            JSONObject item = newFiles.getJSONObject(i);
            totalBytes += item.getLong("bytes");
            JSONObject old = oldByPath.get(item.getString("path"));
            File existing = previous == null ? null : fileInVersion(previous.optString("version", ""), item.getString("path"));
            boolean canReuse = old != null && old.optString("sha256").equalsIgnoreCase(item.getString("sha256"))
                    && existing != null && existing.isFile() && existing.length() == item.getLong("bytes");
            if (canReuse) unchangedCount++;
            else changedCount++;
        }

        if (previous != null && version.equals(previous.optString("version"))) {
            if (changedCount != 0 || newByPath.size() != oldByPath.size()) {
                throw new IllegalArgumentException("The content manifest changed without a version increase.");
            }
            activity.getSharedPreferences("shbace_remote_content", 0).edit()
                    .putLong("last_sync", System.currentTimeMillis()).apply();
            return successJson(version, 0, 0, 0L, unchangedCount, "up-to-date");
        }

        File staging = new File(root, "staging-" + version);
        deleteRecursively(staging);
        if (!staging.mkdirs()) throw new IllegalStateException("Could not create update staging folder.");
        boolean committed = false;
        try {
            for (int i = 0; i < newFiles.length(); i++) {
                JSONObject item = newFiles.getJSONObject(i);
                String path = item.getString("path");
                long expectedBytes = item.getLong("bytes");
                String expectedHash = item.getString("sha256").toLowerCase(java.util.Locale.US);
                File target = safeChild(staging, path);
                File parent = target.getParentFile();
                if (parent != null && !parent.exists() && !parent.mkdirs()) {
                    throw new IllegalStateException("Could not create content folder for " + path);
                }

                JSONObject old = oldByPath.get(path);
                File oldFile = previous == null ? null : fileInVersion(previous.optString("version", ""), path);
                boolean canReuse = old != null && old.optString("sha256").equalsIgnoreCase(expectedHash)
                        && oldFile != null && oldFile.isFile() && oldFile.length() == expectedBytes;
                if (canReuse) {
                    copyFile(oldFile, target);
                } else {
                    URL fileUrl = new URL(CONTENT_BASE + encodePath(path));
                    DownloadResult downloaded = downloadVerified(fileUrl, target, expectedBytes, expectedHash);
                    downloadedBytes += downloaded.bytes;
                }
            }

            File finalVersionDir = new File(versionsDir, version);
            deleteRecursively(finalVersionDir);
            if (!staging.renameTo(finalVersionDir)) {
                throw new IllegalStateException("Could not activate the verified content package.");
            }

            File manifestFile = new File(root, "current-manifest.json");
            if (previous != null) {
                writeAtomic(new File(root, "previous-manifest.json"),
                        previous.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            }
            writeAtomic(manifestFile, manifest.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            activity.getSharedPreferences("shbace_remote_content", 0).edit()
                    .putLong("last_sync", System.currentTimeMillis()).apply();
            cleanupOldVersions(version);
            committed = true;

            int removed = Math.max(0, oldByPath.size() - newByPath.size());
            return successJson(version, changedCount, removed, downloadedBytes, unchangedCount, "updated");
        } finally {
            if (!committed) deleteRecursively(staging);
        }
    }

    private void validateManifest(JSONObject manifest) throws Exception {
        if (!SCHEMA.equals(manifest.optString("schema"))) {
            throw new IllegalArgumentException("Unsupported remote content manifest schema.");
        }
        String version = manifest.optString("version", "");
        if (!version.matches("[A-Za-z0-9._-]{1,64}")) {
            throw new IllegalArgumentException("Invalid remote content version.");
        }
        int contentVersionCode = manifest.optInt("contentVersionCode", -1);
        if (contentVersionCode < 1) throw new IllegalArgumentException("Missing or invalid contentVersionCode.");
        int minAppVersionCode = manifest.optInt("minAppVersionCode", 0);
        if (minAppVersionCode < 0) throw new IllegalArgumentException("Invalid minAppVersionCode.");
        try {
            android.content.pm.PackageInfo packageInfo = activity.getPackageManager()
                    .getPackageInfo(activity.getPackageName(), 0);
            long installedAppCode = android.os.Build.VERSION.SDK_INT >= 28
                    ? packageInfo.getLongVersionCode() : packageInfo.versionCode;
            if (installedAppCode < minAppVersionCode) {
                throw new IllegalArgumentException("This content package requires a newer SHBACE Medical app.");
            }
        } catch (android.content.pm.PackageManager.NameNotFoundException error) {
            throw new IllegalStateException("Could not verify the installed app version.", error);
        }
        String catalogPath = manifest.optString("catalogPath", "");
        if (catalogPath.length() > 0 && !validPath(catalogPath)) {
            throw new IllegalArgumentException("Invalid catalog path.");
        }
        JSONArray files = manifest.optJSONArray("files");
        if (files == null || files.length() > MAX_FILES) {
            throw new IllegalArgumentException("Manifest file list is missing or too large.");
        }
        Set<String> seen = new HashSet<>();
        long total = 0L;
        for (int i = 0; i < files.length(); i++) {
            JSONObject file = files.getJSONObject(i);
            String path = file.optString("path", "");
            String hash = file.optString("sha256", "");
            long bytes = file.optLong("bytes", -1L);
            if (!validPath(path) || !seen.add(path)) throw new IllegalArgumentException("Invalid or duplicate content path: " + path);
            if (!hash.matches("(?i)[a-f0-9]{64}")) throw new IllegalArgumentException("Invalid SHA-256 for " + path);
            if (bytes < 0L || bytes > MAX_FILE_BYTES) throw new IllegalArgumentException("Content file is too large: " + path);
            total += bytes;
            if (total > MAX_TOTAL_BYTES) throw new IllegalArgumentException("Remote content package exceeds the storage limit.");
        }
        if (catalogPath.length() > 0 && !seen.contains(catalogPath)) {
            throw new IllegalArgumentException("The catalog file is not included in the manifest.");
        }
        manifest.put("totalBytes", total);
    }

    private Map<String, JSONObject> indexFiles(JSONArray files) throws Exception {
        Map<String, JSONObject> map = new HashMap<>();
        if (files == null) return map;
        for (int i = 0; i < files.length(); i++) {
            JSONObject file = files.getJSONObject(i);
            map.put(file.getString("path"), file);
        }
        return map;
    }

    private File resolveCurrentFile(String relativePath) throws Exception {
        if (!validPath(relativePath)) return null;
        JSONObject manifest = parseCurrentManifest();
        if (manifest == null) return null;
        JSONArray files = manifest.optJSONArray("files");
        if (files == null) return null;
        boolean listed = false;
        for (int i = 0; i < files.length(); i++) {
            JSONObject item = files.optJSONObject(i);
            if (item != null && relativePath.equals(item.optString("path"))) { listed = true; break; }
        }
        return listed ? fileInVersion(manifest.optString("version", ""), relativePath) : null;
    }

    private File fileInVersion(String version, String path) throws Exception {
        if (!version.matches("[A-Za-z0-9._-]{1,64}") || !validPath(path)) return null;
        return safeChild(new File(versionsDir, version), path);
    }

    private JSONObject parseCurrentManifest() {
        return readManifestFile("current-manifest.json");
    }

    private JSONObject readManifestFile(String name) {
        try {
            File file = new File(root, name);
            if (!file.isFile() || file.length() > MAX_MANIFEST_BYTES) return null;
            return new JSONObject(new String(readFile(file, MAX_MANIFEST_BYTES),
                    java.nio.charset.StandardCharsets.UTF_8));
        } catch (Throwable ignored) { return null; }
    }

    boolean restorePreviousContent() {
        if (syncing) return false;
        try {
            JSONObject previous = readManifestFile("previous-manifest.json");
            JSONObject current = parseCurrentManifest();
            if (previous == null || !verifyInstalledVersion(previous)) return false;
            if (current != null) {
                writeAtomic(new File(root, "previous-manifest.json"),
                        current.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            }
            writeAtomic(new File(root, "current-manifest.json"),
                    previous.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return true;
        } catch (Throwable error) {
            Log.e(TAG, "Could not restore last-known-good content", error);
            return false;
        }
    }

    private boolean verifyInstalledVersion(JSONObject manifest) {
        try {
            JSONArray files = manifest.optJSONArray("files");
            if (files == null || files.length() > MAX_FILES) return false;
            String version = manifest.optString("version", "");
            for (int i = 0; i < files.length(); i++) {
                JSONObject item = files.getJSONObject(i);
                File file = fileInVersion(version, item.getString("path"));
                if (file == null || !file.isFile() || file.length() != item.getLong("bytes")) return false;
                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                try (InputStream input = new FileInputStream(file)) {
                    byte[] buffer = new byte[32768];
                    int read;
                    while ((read = input.read(buffer)) != -1) digest.update(buffer, 0, read);
                }
                if (!toHex(digest.digest()).equalsIgnoreCase(item.getString("sha256"))) return false;
            }
            return true;
        } catch (Throwable error) {
            Log.w(TAG, "Last-known-good content failed integrity verification", error);
            return false;
        }
    }

    private static boolean validPath(String path) {
        if (path == null || path.length() == 0 || path.length() > 240) return false;
        if (path.startsWith("/") || path.startsWith("\\") || path.contains("\\\\") || path.contains("//")) return false;
        if (!path.matches("[A-Za-z0-9._/-]+")) return false;
        String[] parts = path.split("/");
        for (String part : parts) if (part.length() == 0 || ".".equals(part) || "..".equals(part)) return false;
        return true;
    }

    private static boolean isAllowedManifestUrl(String value) {
        return MANIFEST_URL.equals(value);
    }

    private static String encodePath(String path) {
        String[] parts = path.split("/");
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < parts.length; i++) {
            if (i > 0) out.append('/');
            out.append(java.net.URLEncoder.encode(parts[i], java.nio.charset.StandardCharsets.UTF_8)
                    .replace("+", "%20"));
        }
        return out.toString();
    }

    private static byte[] downloadBytes(URL url, long maxBytes) throws Exception {
        HttpURLConnection connection = open(url);
        try {
            if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                throw new IllegalStateException("Content server returned HTTP " + connection.getResponseCode());
            }
            try (InputStream input = connection.getInputStream()) {
                return readStream(input, maxBytes);
            }
        } finally { connection.disconnect(); }
    }

    private static HttpURLConnection open(URL url) throws Exception {
        if (!"https".equalsIgnoreCase(url.getProtocol())
                || !"raw.githubusercontent.com".equalsIgnoreCase(url.getHost())) {
            throw new IllegalArgumentException("Remote content must be served by the approved HTTPS host.");
        }
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
        connection.setReadTimeout(READ_TIMEOUT_MS);
        connection.setInstanceFollowRedirects(false);
        connection.setRequestProperty("Accept", "application/json, application/octet-stream");
        connection.setRequestProperty("Cache-Control", "no-cache");
        connection.setRequestProperty("User-Agent", "SHBACE-Medical-Android-Content-Updater");
        return connection;
    }

    private static final class DownloadResult {
        final long bytes;
        DownloadResult(long bytes) { this.bytes = bytes; }
    }

    private static DownloadResult downloadVerified(URL url, File destination, long expectedBytes,
                                                   String expectedHash) throws Exception {
        HttpURLConnection connection = open(url);
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        long bytes = 0L;
        try {
            if (connection.getResponseCode() != HttpURLConnection.HTTP_OK) {
                throw new IllegalStateException("Could not download " + destination.getName()
                        + " (HTTP " + connection.getResponseCode() + ").");
            }
            try (InputStream input = connection.getInputStream();
                 OutputStream output = new FileOutputStream(destination)) {
                byte[] buffer = new byte[32768];
                int read;
                while ((read = input.read(buffer)) != -1) {
                    bytes += read;
                    if (bytes > MAX_FILE_BYTES || bytes > expectedBytes) {
                        throw new IllegalStateException("Downloaded file exceeds its declared size.");
                    }
                    digest.update(buffer, 0, read);
                    output.write(buffer, 0, read);
                }
                output.flush();
            }
        } finally { connection.disconnect(); }
        String actualHash = toHex(digest.digest());
        if (bytes != expectedBytes || !actualHash.equalsIgnoreCase(expectedHash)) {
            destination.delete();
            throw new IllegalStateException("Integrity verification failed for " + destination.getName() + ".");
        }
        return new DownloadResult(bytes);
    }

    private static byte[] readFile(File file, long maxBytes) throws Exception {
        try (InputStream input = new FileInputStream(file)) { return readStream(input, maxBytes); }
    }

    private static byte[] readStream(InputStream input, long maxBytes) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[32768];
        int read;
        long count = 0L;
        while ((read = input.read(buffer)) != -1) {
            count += read;
            if (count > maxBytes) throw new IllegalStateException("Remote content file exceeds the allowed size.");
            output.write(buffer, 0, read);
        }
        return output.toByteArray();
    }

    private static void copyFile(File source, File destination) throws Exception {
        try (InputStream input = new FileInputStream(source);
             OutputStream output = new FileOutputStream(destination)) {
            byte[] buffer = new byte[32768];
            int read;
            while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
            output.flush();
        }
    }

    private static void writeAtomic(File destination, byte[] bytes) throws Exception {
        File parent = destination.getParentFile();
        if (parent != null && !parent.exists() && !parent.mkdirs()) {
            throw new IllegalStateException("Could not create internal content folder.");
        }
        File temporary = new File(destination.getParentFile(), destination.getName() + ".tmp");
        try (OutputStream output = new FileOutputStream(temporary)) {
            output.write(bytes);
            output.flush();
        }
        File backup = new File(destination.getParentFile(), destination.getName() + ".previous");
        if (backup.exists()) backup.delete();
        boolean hadPrevious = destination.exists();
        if (hadPrevious && !destination.renameTo(backup)) {
            temporary.delete();
            throw new IllegalStateException("Could not stage the previous content manifest.");
        }
        if (!temporary.renameTo(destination)) {
            temporary.delete();
            if (hadPrevious) backup.renameTo(destination);
            throw new IllegalStateException("Could not finalize the installed content manifest.");
        }
        if (backup.exists()) backup.delete();
    }

    private static File safeChild(File parent, String relativePath) throws Exception {
        if (!validPath(relativePath)) throw new IllegalArgumentException("Invalid content path.");
        File child = new File(parent, relativePath);
        String parentPath = parent.getCanonicalPath() + File.separator;
        if (!child.getCanonicalPath().startsWith(parentPath)) throw new IllegalArgumentException("Invalid content path.");
        return child;
    }

    private void cleanupOldVersions(String currentVersion) {
        File[] dirs = versionsDir.listFiles();
        if (dirs == null || dirs.length <= 2) return;
        List<File> list = new ArrayList<>(Arrays.asList(dirs));
        Collections.sort(list, new Comparator<File>() {
            @Override public int compare(File a, File b) { return Long.compare(b.lastModified(), a.lastModified()); }
        });
        int keptPrevious = 0;
        for (File dir : list) {
            if (dir.getName().equals(currentVersion)) continue;
            if (keptPrevious++ >= 1) deleteRecursively(dir);
        }
    }

    private static void deleteRecursively(File file) {
        if (file == null || !file.exists()) return;
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) for (File child : children) deleteRecursively(child);
        }
        // Best effort cleanup; failure does not invalidate the current installed package.
        file.delete();
    }

    private static String toHex(byte[] bytes) {
        StringBuilder out = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) out.append(String.format(java.util.Locale.US, "%02x", b & 0xff));
        return out.toString();
    }

    private static String successJson(String version, int updated, int removed, long bytes,
                                      int unchanged, String status) {
        JSONObject result = new JSONObject();
        try {
            result.put("ok", true);
            result.put("version", version);
            result.put("updated", updated);
            result.put("removed", removed);
            result.put("bytes", bytes);
            result.put("unchanged", unchanged);
            result.put("status", status);
        } catch (Throwable ignored) {}
        return result.toString();
    }

    private static String errorJson(String message) {
        JSONObject result = new JSONObject();
        try { result.put("ok", false); result.put("error", message == null ? "Unknown update error." : message); }
        catch (Throwable ignored) {}
        return result.toString();
    }

    private void postResult(final String resultJson) {
        try {
            webView.post(new Runnable() {
                @Override public void run() {
                    String js = "if(window.__shbRemoteContentSyncComplete){window.__shbRemoteContentSyncComplete("
                            + JSONObject.quote(resultJson) + ");}";
                    webView.evaluateJavascript(js, null);
                }
            });
        } catch (Throwable error) {
            Log.w(TAG, "Could not deliver content update result to WebView", error);
        }
    }

    void shutdown() {
        try { executor.shutdownNow(); } catch (Throwable ignored) {}
    }
}
