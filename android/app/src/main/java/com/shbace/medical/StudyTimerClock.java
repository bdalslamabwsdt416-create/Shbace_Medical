package com.shbace.medical;

/**
 * Pure elapsed-realtime calculations shared by the foreground study timer.
 * Kept separate from Android APIs so the clock math can be regression-tested on the JVM.
 */
final class StudyTimerClock {
    private StudyTimerClock() {}

    static long runningStart(boolean running, long nowElapsedRealtime) {
        return running ? Math.max(0L, nowElapsedRealtime) : 0L;
    }

    static long elapsedNow(long accumulatedMs, long startedAtElapsedRealtime,
                           long nowElapsedRealtime, boolean running) {
        long accumulated = Math.max(0L, accumulatedMs);
        if (!running || startedAtElapsedRealtime <= 0L) return accumulated;
        long delta = Math.max(0L, nowElapsedRealtime - startedAtElapsedRealtime);
        return accumulated + delta;
    }
}
