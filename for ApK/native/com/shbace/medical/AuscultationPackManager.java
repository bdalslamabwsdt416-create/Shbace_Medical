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
import java.io.RandomAccessFile;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Separate, versioned private storage for Medara-derived auscultation packs.
 * This manager never reads or writes student QBank/localStorage data and does not
 * share the generic Shbace remote-learning-content manifest or version pointer.
 */
final class AuscultationPackManager {
    private static final String TAG = "ShbaceAuscultation";
    private static final String BASE_URL =
            "https://raw.githubusercontent.com/bdalslamabwsdt416-create/Shbace_Medical/main/for%20ApK/android-content/auscultation/";
    private static final long MAX_MANIFEST_BYTES = 2L * 1024L * 1024L;
    private static final long MAX_FILE_BYTES = 24L * 1024L * 1024L;
    private static final long MAX_TOTAL_BYTES = 40L * 1024L * 1024L;
    private static final int MAX_FILES = 120;
    private static final int MAX_READ_CHUNK_BYTES = 256 * 1024;
    private static final int CONNECT_TIMEOUT_MS = 15000;
    private static final int READ_TIMEOUT_MS = 30000;

    private final Activity activity;
    private final WebView webView;
    private final File root;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Map<String, Boolean> downloading = new HashMap<>();
    private final Map<String, Long> progressBytes = new HashMap<>();
    private final Map<String, Long> progressTotals = new HashMap<>();
    private final Map<String, String> lastErrors = new HashMap<>();
    private volatile boolean closed = false;

    AuscultationPackManager(Activity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
        this.root = new File(activity.getFilesDir(), "shbace-auscultation");
        if (!root.exists()) root.mkdirs();
    }

    synchronized boolean startDownload(String rawSystem) {
        final String system = normalizeSystem(rawSystem);
        if (system == null || closed || executor.isShutdown()) return false;
        if (Boolean.TRUE.equals(downloading.get(system))) return false;
        downloading.put(system, true);
        progressBytes.put(system, 0L);
        progressTotals.put(system, 0L);
        lastErrors.remove(system);
        postEvent("shbace-auscultation-pack-progress", eventJson(system, "starting", 0L, 0L, ""));
        executor.execute(new Runnable() {
            @Override public void run() {
                String error = "";
                try {
                    downloadNow(system);
                } catch (Throwable failure) {
                    error = String.valueOf(failure.getMessage() == null ? failure : failure.getMessage());
                    Log.e(TAG, "Auscultation pack download failed: " + system, failure);
                    synchronized (AuscultationPackManager.this) {
                        lastErrors.put(system, error);
                    }
                } finally {
                    synchronized (AuscultationPackManager.this) {
                        downloading.put(system, false);
                    }
                    String status = error.length() == 0 ? "installed" : "error";
                    postEvent("shbace-auscultation-pack-result",
                            eventJson(system, status, getProgress(system), getTotal(system), error));
                }
            }
        });
        return true;
    }

    synchronized String getState(String rawSystem) {
        String system = normalizeSystem(rawSystem);
        if (system == null) return "{\"installed\":false,\"error\":\"Unsupported system\"}";
        try {
            JSONObject state = new JSONObject();
            JSONObject manifest = readCurrentManifest(system);
            boolean installed = manifest != null && packageFilesPresent(system, manifest);
            state.put("system", system);
            state.put("installed", installed);
            state.put("downloading", Boolean.TRUE.equals(downloading.get(system)));
            state.put("downloadedBytes", getProgress(system));
            state.put("totalBytes", getTotal(system));
            state.put("error", lastErrors.containsKey(system) ? lastErrors.get(system) : "");
            if (manifest != null) {
                state.put("version", manifest.optString("version", ""));
                state.put("uniqueSoundCount", manifest.optInt("uniqueSoundCount", 0));
                state.put("audioFileCount", manifest.optInt("audioFileCount", 0));
                state.put("fileCount", manifest.optInt("fileCount", 0));
                state.put("packageBytes", manifest.optLong("totalBytes", 0L));
            }
            return state.toString();
        } catch (Throwable error) {
            Log.w(TAG, "Could not read auscultation state for " + system, error);
            return "{\"system\":\"" + system + "\",\"installed\":false,\"downloading\":false}";
        }
    }

    synchronized long getFileSize(String rawSystem, String relativePath) {
        try {
            String system = normalizeSystem(rawSystem);
            if (system == null || !validPath(relativePath)) return -1L;
            JSONObject manifest = readCurrentManifest(system);
            if (manifest == null) return -1L;
            JSONObject item = findFile(manifest.optJSONArray("files"), relativePath);
            if (item == null) return -1L;
            File file = installedFile(system, manifest.optString("version", ""), relativePath);
            if (file == null || !file.isFile()) return -1L;
            long expected = item.optLong("bytes", -1L);
            return expected >= 0L && file.length() == expected ? expected : -1L;
        } catch (Throwable error) {
            Log.w(TAG, "Auscultation file size lookup failed: " + relativePath, error);
            return -1L;
        }
    }

    String readBase64Chunk(String rawSystem, String relativePath, long offset, int maxBytes) {
        try {
            String system = normalizeSystem(rawSystem);
            if (system == null || offset < 0L || maxBytes < 1 || maxBytes > MAX_READ_CHUNK_BYTES) return "";
            JSONObject manifest = readCurrentManifest(system);
            if (manifest == null) return "";
            JSONObject item = findFile(manifest.optJSONArray("files"), relativePath);
            if (item == null) return "";
            File file = installedFile(system, manifest.optString("version", ""), relativePath);
            if (file == null || !file.isFile() || file.length() != item.optLong("bytes", -1L) ||
                    offset >= file.length()) return "";
            int wanted = (int) Math.min((long) maxBytes, file.length() - offset);
            byte[] bytes = new byte[wanted];
            try (RandomAccessFile input = new RandomAccessFile(file, "r")) {
                input.seek(offset);
                input.readFully(bytes);
            }
            return Base64.encodeToString(bytes, Base64.NO_WRAP);
        } catch (Throwable error) {
            Log.w(TAG, "Could not read auscultation chunk: " + relativePath, error);
            return "";
        }
    }

    synchronized void shutdown() {
        closed = true;
        executor.shutdownNow();
    }

    private void downloadNow(String system) throws Exception {
        URL manifestUrl = new URL(BASE_URL + system + "/manifest.json");
        byte[] manifestBytes = downloadBytes(manifestUrl, MAX_MANIFEST_BYTES);
        JSONObject manifest = new JSONObject(new String(manifestBytes, java.nio.charset.StandardCharsets.UTF_8));
        validateManifest(system, manifest);
        String version = manifest.getString("version");
        JSONArray files = manifest.getJSONArray("files");
        long total = manifest.getLong("totalBytes");
        synchronized (this) { progressTotals.put(system, total); }
        File systemRoot = new File(root, system);
        File versions = new File(systemRoot, "versions");
        if (!versions.exists() && !versions.mkdirs()) throw new IllegalStateException("Could not create pack storage.");
        File finalDir = safeChild(versions, version);
        if (finalDir.isDirectory() && packageFilesPresent(system, manifest)) {
            writeCurrentManifest(system, manifest);
            synchronized (this) { progressBytes.put(system, total); }
            postProgress(system, "verified", total, total, "");
            return;
        }
        File staging = new File(systemRoot, "staging-" + version + "-" + System.currentTimeMillis());
        if (!staging.mkdirs()) throw new IllegalStateException("Could not create a staging folder.");
        boolean committed = false;
        long downloaded = 0L;
        try {
            for (int i = 0; i < files.length(); i++) {
                JSONObject item = files.getJSONObject(i);
                String path = item.getString("path");
                long expectedBytes = item.getLong("bytes");
                String expectedHash = item.getString("sha256");
                File target = safeChild(staging, path);
                File parent = target.getParentFile();
                if (parent != null && !parent.exists() && !parent.mkdirs()) {
                    throw new IllegalStateException("Could not create folder for " + path);
                }
                URL fileUrl = new URL(BASE_URL + system + "/" + encodePath(path));
                long current = downloadVerified(fileUrl, target, expectedBytes, expectedHash);
                downloaded += current;
                synchronized (this) { progressBytes.put(system, downloaded); }
                postProgress(system, "downloading", downloaded, total, "");
            }
            File storedManifest = new File(staging, "package-manifest.json");
            writeAtomic(storedManifest, manifest.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
            verifyStagedPackage(system, staging, manifest);
            if (finalDir.exists()) deleteTree(finalDir);
            if (!staging.renameTo(finalDir)) throw new IllegalStateException("Could not install the verified heart package.");
            writeCurrentManifest(system, manifest);
            synchronized (this) { progressBytes.put(system, total); }
            committed = true;
            postProgress(system, "verified", total, total, "");
        } finally {
            if (!committed && staging.exists()) deleteTree(staging);
        }
    }

    private void validateManifest(String system, JSONObject manifest) throws Exception {
        if (!"shbace-auscultation-pack-v1".equals(manifest.optString("schema"))) {
            throw new IllegalArgumentException("Unsupported auscultation package manifest.");
        }
        if (!("auscultation-" + system).equals(manifest.optString("packageId")) ||
                !system.equals(manifest.optString("system"))) {
            throw new IllegalArgumentException("The package does not match the selected system.");
        }
        String version = manifest.optString("version", "");
        if (!version.matches("[A-Fa-f0-9]{64}")) throw new IllegalArgumentException("Invalid package version hash.");
        JSONArray files = manifest.optJSONArray("files");
        if (files == null || files.length() == 0 || files.length() > MAX_FILES) {
            throw new IllegalArgumentException("Invalid package file list.");
        }
        long total = 0L;
        int audioFiles = 0;
        boolean hasCatalog = false;
        boolean hasThoraxBin = false;
        boolean hasThoraxJson = false;
        if (system.equals("heart") &&
                (manifest.optInt("uniqueSoundCount", -1) != 77 || manifest.optInt("audioFileCount", -1) != 77)) {
            throw new IllegalArgumentException("Heart package must contain exactly 77 primary recordings.");
        }
        for (int i = 0; i < files.length(); i++) {
            JSONObject file = files.getJSONObject(i);
            String path = file.optString("path", "");
            long bytes = file.optLong("bytes", -1L);
            String hash = file.optString("sha256", "");
            if (!validPath(path) || bytes < 0L || bytes > MAX_FILE_BYTES ||
                    !hash.matches("[A-Fa-f0-9]{64}")) {
                throw new IllegalArgumentException("Invalid package file entry: " + path);
            }
            total += bytes;
            if (path.toLowerCase(java.util.Locale.US).endsWith(".mp3")) audioFiles++;
            if ("audio-catalog.json".equals(path)) hasCatalog = true;
            if ("assets/models/thorax.bin".equals(path)) hasThoraxBin = true;
            if ("assets/models/thorax.json".equals(path)) hasThoraxJson = true;
            for (int j = 0; j < i; j++) {
                if (path.equals(files.getJSONObject(j).optString("path"))) {
                    throw new IllegalArgumentException("Duplicate package path: " + path);
                }
            }
        }
        if (total > MAX_TOTAL_BYTES || total != manifest.optLong("totalBytes", -1L)) {
            throw new IllegalArgumentException("Package byte total is invalid or exceeds the limit.");
        }
        if (audioFiles != manifest.optInt("audioFileCount", -1)) {
            throw new IllegalArgumentException("Audio recording count does not match the manifest.");
        }
        if (!hasCatalog || !hasThoraxBin || !hasThoraxJson) {
            throw new IllegalArgumentException("The package is missing the sound catalogue or thorax model.");
        }
        if (system.equals("heart") &&
                (!containsPath(files, "assets/models/valve-heart.bin") ||
                 !containsPath(files, "assets/models/valve-heart.json"))) {
            throw new IllegalArgumentException("The detailed cardiac model is missing.");
        }
    }

    private void verifyStagedPackage(String system, File staging, JSONObject manifest) throws Exception {
        JSONArray files = manifest.getJSONArray("files");
        for (int i = 0; i < files.length(); i++) {
            JSONObject item = files.getJSONObject(i);
            File file = safeChild(staging, item.getString("path"));
            if (!file.isFile() || file.length() != item.getLong("bytes")) {
                throw new IllegalStateException("Staged pack file is missing or truncated: " + item.getString("path"));
            }
        }
        File catalogFile = safeChild(staging, "audio-catalog.json");
        JSONObject notUsed = null;
        JSONArray catalog = new JSONArray(new String(readFile(catalogFile, 4L * 1024L * 1024L),
                java.nio.charset.StandardCharsets.UTF_8));
        int expected = manifest.optInt("uniqueSoundCount", -1);
        if (catalog.length() != expected) throw new IllegalStateException("Installed sound catalogue count is incorrect.");
        java.util.HashSet<String> titles = new java.util.HashSet<>();
        for (int i = 0; i < catalog.length(); i++) {
            JSONObject entry = catalog.getJSONObject(i);
            if (!system.equals(entry.optString("system")) || !titles.add(entry.optString("title"))) {
                throw new IllegalStateException("The catalogue contains a duplicate or wrong-system sound.");
            }
            String path = "audio-library/" + entry.optString("path", "");
            if (findFile(files, path) == null) {
                throw new IllegalStateException("A catalogue audio file is not included in the package: " + path);
            }
        }
    }

    private long downloadVerified(URL url, File target, long expectedBytes, String expectedHash) throws Exception {
        HttpURLConnection connection = null;
        File part = new File(target.getParentFile(), target.getName() + ".part");
        try {
            connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
            connection.setReadTimeout(READ_TIMEOUT_MS);
            connection.setRequestProperty("Cache-Control", "no-cache");
            connection.setRequestProperty("Accept", "application/octet-stream");
            connection.setInstanceFollowRedirects(true);
            int code = connection.getResponseCode();
            if (code < 200 || code >= 300) throw new IllegalStateException("Download failed with HTTP " + code + ": " + url);
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            long count = 0L;
            try (InputStream input = connection.getInputStream();
                 FileOutputStream output = new FileOutputStream(part)) {
                byte[] buffer = new byte[32768];
                int read;
                while ((read = input.read(buffer)) != -1) {
                    count += read;
                    if (count > expectedBytes || count > MAX_FILE_BYTES) {
                        throw new IllegalStateException("Downloaded file is larger than its manifest entry.");
                    }
                    digest.update(buffer, 0, read);
                    output.write(buffer, 0, read);
                }
                output.getFD().sync();
            }
            if (count != expectedBytes || !toHex(digest.digest()).equalsIgnoreCase(expectedHash)) {
                throw new IllegalStateException("SHA-256 or byte-count verification failed: " + url);
            }
            if (!part.renameTo(target)) throw new IllegalStateException("Could not finalize downloaded file: " + target.getName());
            return count;
        } finally {
            if (connection != null) connection.disconnect();
            if (part.exists()) part.delete();
        }
    }

    private byte[] downloadBytes(URL url, long limit) throws Exception {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(CONNECT_TIMEOUT_MS);
            connection.setReadTimeout(READ_TIMEOUT_MS);
            connection.setRequestProperty("Cache-Control", "no-cache");
            connection.setInstanceFollowRedirects(true);
            int code = connection.getResponseCode();
            if (code < 200 || code >= 300) throw new IllegalStateException("Package manifest request failed: HTTP " + code);
            try (InputStream input = connection.getInputStream();
                 ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192];
                int read;
                while ((read = input.read(buffer)) != -1) {
                    if (output.size() + read > limit) throw new IllegalStateException("Package manifest is too large.");
                    output.write(buffer, 0, read);
                }
                return output.toByteArray();
            }
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private JSONObject readCurrentManifest(String system) {
        try {
            File file = new File(new File(root, system), "current-manifest.json");
            if (!file.isFile() || file.length() > MAX_MANIFEST_BYTES) return null;
            return new JSONObject(new String(readFile(file, MAX_MANIFEST_BYTES),
                    java.nio.charset.StandardCharsets.UTF_8));
        } catch (Throwable ignored) { return null; }
    }

    private boolean packageFilesPresent(String system, JSONObject manifest) {
        try {
            JSONArray files = manifest.getJSONArray("files");
            String version = manifest.getString("version");
            for (int i = 0; i < files.length(); i++) {
                JSONObject item = files.getJSONObject(i);
                File file = installedFile(system, version, item.getString("path"));
                if (file == null || !file.isFile() || file.length() != item.getLong("bytes")) return false;
            }
            return true;
        } catch (Throwable ignored) { return false; }
    }

    private File installedFile(String system, String version, String relativePath) throws Exception {
        if (!version.matches("[A-Fa-f0-9]{64}") || !validPath(relativePath)) return null;
        return safeChild(new File(new File(new File(root, system), "versions"), version), relativePath);
    }

    private void writeCurrentManifest(String system, JSONObject manifest) throws Exception {
        File dir = new File(root, system);
        if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("Could not create package storage.");
        writeAtomic(new File(dir, "current-manifest.json"),
                manifest.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
        activity.getSharedPreferences("shbace_auscultation_packs", 0).edit()
                .putString(system + "_version", manifest.optString("version", ""))
                .putLong(system + "_installed_at", System.currentTimeMillis()).apply();
    }

    private static JSONObject findFile(JSONArray files, String path) throws Exception {
        if (files == null) return null;
        for (int i = 0; i < files.length(); i++) {
            JSONObject item = files.getJSONObject(i);
            if (path.equals(item.optString("path"))) return item;
        }
        return null;
    }

    private static boolean containsPath(JSONArray files, String path) throws Exception {
        return findFile(files, path) != null;
    }

    private static boolean validPath(String path) {
        if (path == null || path.length() == 0 || path.length() > 240 ||
                path.startsWith("/") || path.startsWith("\\") || path.contains("\\") ||
                path.contains(":") || path.contains("?") || path.contains("#") || path.contains("%")) return false;
        String[] parts = path.split("/");
        for (String part : parts) {
            if (part.length() == 0 || part.equals(".") || part.equals("..")) return false;
            for (int i = 0; i < part.length(); i++) {
                if (Character.isISOControl(part.charAt(i))) return false;
            }
        }
        return true;
    }

    private static File safeChild(File parent, String relativePath) throws Exception {
        if (!validPath(relativePath)) throw new IllegalArgumentException("Invalid package path.");
        File child = new File(parent, relativePath);
        String base = parent.getCanonicalPath() + File.separator;
        if (!child.getCanonicalPath().startsWith(base)) throw new IllegalArgumentException("Package path escapes its storage root.");
        return child;
    }

    private static byte[] readFile(File file, long limit) throws Exception {
        if (!file.isFile() || file.length() > limit) throw new IllegalArgumentException("File is missing or too large.");
        try (InputStream input = new FileInputStream(file);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[32768];
            int read;
            while ((read = input.read(buffer)) != -1) {
                if (output.size() + read > limit) throw new IllegalArgumentException("File exceeds read limit.");
                output.write(buffer, 0, read);
            }
            return output.toByteArray();
        }
    }

    private static void writeAtomic(File file, byte[] bytes) throws Exception {
        File parent = file.getParentFile();
        if (parent != null && !parent.exists() && !parent.mkdirs()) throw new IllegalStateException("Could not create manifest folder.");
        File temp = new File(parent, file.getName() + ".tmp");
        try (FileOutputStream output = new FileOutputStream(temp)) {
            output.write(bytes);
            output.getFD().sync();
        }
        if (file.exists() && !file.delete()) throw new IllegalStateException("Could not replace current package manifest.");
        if (!temp.renameTo(file)) throw new IllegalStateException("Could not commit package manifest.");
    }

    private static void deleteTree(File file) {
        if (file == null || !file.exists()) return;
        File[] children = file.listFiles();
        if (children != null) for (File child : children) deleteTree(child);
        file.delete();
    }

    private static String normalizeSystem(String system) {
        if ("heart".equalsIgnoreCase(system)) return "heart";
        if ("lung".equalsIgnoreCase(system)) return "lung";
        return null;
    }

    private static String encodePath(String path) {
        String[] parts = path.split("/");
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < parts.length; i++) {
            if (i > 0) out.append('/');
            out.append(android.net.Uri.encode(parts[i]));
        }
        return out.toString();
    }

    private static String toHex(byte[] bytes) {
        StringBuilder out = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) out.append(String.format(java.util.Locale.US, "%02x", value & 0xff));
        return out.toString();
    }

    private synchronized long getProgress(String system) { return progressBytes.containsKey(system) ? progressBytes.get(system) : 0L; }
    private synchronized long getTotal(String system) { return progressTotals.containsKey(system) ? progressTotals.get(system) : 0L; }

    private synchronized String eventJson(String system, String status, long downloaded, long total, String error) {
        JSONObject value = new JSONObject();
        try {
            value.put("system", system);
            value.put("status", status);
            value.put("downloadedBytes", downloaded);
            value.put("totalBytes", total);
            value.put("error", error == null ? "" : error);
        } catch (Exception ignored) {}
        return value.toString();
    }

    private void postProgress(String system, String status, long downloaded, long total, String error) {
        postEvent("shbace-auscultation-pack-progress", eventJson(system, status, downloaded, total, error));
    }

    private void postEvent(final String name, final String detailJson) {
        if (webView == null || closed) return;
        webView.post(new Runnable() {
            @Override public void run() {
                String safeName = name.replaceAll("[^A-Za-z0-9_-]", "");
                webView.evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('" + safeName + "',{detail:" + detailJson + "}));",
                        null);
            }
        });
    }
}
