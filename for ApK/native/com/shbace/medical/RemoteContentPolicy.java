package com.shbace.medical;

/**
 * Monotonic policy for Android remote-content packages.
 * Content version codes are independent from the APK version code.
 */
final class RemoteContentPolicy {
    private RemoteContentPolicy() {}

    static void validateCandidate(long candidateContentVersionCode,
                                  String candidateVersion,
                                  long minimumAppVersionCode,
                                  long installedAppVersionCode,
                                  long installedContentVersionCode,
                                  String installedContentVersion) {
        if (candidateContentVersionCode < 1L) {
            throw new IllegalArgumentException("Remote contentVersionCode must be a positive integer.");
        }
        if (candidateVersion == null || candidateVersion.trim().isEmpty()) {
            throw new IllegalArgumentException("Remote content version is missing.");
        }
        if (minimumAppVersionCode < 1L) {
            throw new IllegalArgumentException("minAppVersionCode must be a positive integer.");
        }
        if (installedAppVersionCode < minimumAppVersionCode) {
            throw new IllegalArgumentException("This content package requires Android app versionCode "
                    + minimumAppVersionCode + " or newer.");
        }
        String installedVersion = installedContentVersion == null ? "" : installedContentVersion;
        if (installedContentVersionCode > 0L) {
            if (candidateContentVersionCode < installedContentVersionCode) {
                throw new IllegalArgumentException("Remote content downgrade rejected: installed content is newer.");
            }
            if (candidateContentVersionCode == installedContentVersionCode
                    && !candidateVersion.equals(installedVersion)) {
                throw new IllegalArgumentException("Remote contentVersionCode has already been used by another version.");
            }
            if (candidateContentVersionCode > installedContentVersionCode
                    && candidateVersion.equals(installedVersion)) {
                throw new IllegalArgumentException("The content version name must increase with contentVersionCode.");
            }
        } else if (!installedVersion.isEmpty() && candidateVersion.equals(installedVersion)) {
            throw new IllegalArgumentException("The content version name must increase from the legacy installed package.");
        }
    }

    static boolean isSameInstalledVersion(long candidateContentVersionCode,
                                          String candidateVersion,
                                          long installedContentVersionCode,
                                          String installedContentVersion) {
        return candidateContentVersionCode == installedContentVersionCode
                && candidateVersion != null
                && candidateVersion.equals(installedContentVersion == null ? "" : installedContentVersion);
    }
}
