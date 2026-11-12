package com.shbace.medical;

import org.junit.Test;

import static org.junit.Assert.assertEquals;

public class StudyTimerClockTest {
    @Test
    public void runningSyncStartsFromNowWithoutCountingElapsedTimeTwice() {
        long elapsedAtSync = 125_000L;
        long now = 900_000L;
        long startedAt = StudyTimerClock.runningStart(true, now);

        assertEquals(now, startedAt);
        assertEquals(elapsedAtSync, StudyTimerClock.elapsedNow(elapsedAtSync, startedAt, now, true));
        assertEquals(elapsedAtSync + 10_000L,
                StudyTimerClock.elapsedNow(elapsedAtSync, startedAt, now + 10_000L, true));
    }

    @Test
    public void pausedClockDoesNotContinueGrowing() {
        assertEquals(42_000L, StudyTimerClock.runningStart(false, 900_000L));
        assertEquals(42_000L, StudyTimerClock.elapsedNow(42_000L, 800_000L, 900_000L, false));
    }

    @Test
    public void invalidOrBackwardsStartTimeDoesNotCreateNegativeElapsedTime() {
        assertEquals(12_000L, StudyTimerClock.elapsedNow(12_000L, 0L, 90_000L, true));
        assertEquals(12_000L, StudyTimerClock.elapsedNow(12_000L, 50_000L, 40_000L, true));
    }

    @Test
    public void negativePersistedElapsedValueIsClampedToZero() {
        assertEquals(0L, StudyTimerClock.elapsedNow(-5L, 0L, 10L, false));
        assertEquals(2_000L, StudyTimerClock.elapsedNow(-5L, 1_000L, 3_000L, true));
    }
}
