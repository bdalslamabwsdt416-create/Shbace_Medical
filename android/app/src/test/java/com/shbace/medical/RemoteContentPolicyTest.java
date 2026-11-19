package com.shbace.medical;

import org.junit.Test;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

public class RemoteContentPolicyTest {
    private static void reject(Runnable action) {
        try {
            action.run();
            fail("Expected remote content policy to reject the candidate.");
        } catch (IllegalArgumentException expected) {
            // Expected policy rejection.
        }
    }

    @Test
    public void acceptsForwardUpgradeOnCompatibleApk() {
        RemoteContentPolicy.validateCandidate(4L, "1.0.4", 18L, 18L, 3L, "1.0.3");
    }

    @Test
    public void rejectsOlderContentCodeEvenWhenVersionNameDiffers() {
        reject(() -> RemoteContentPolicy.validateCandidate(2L, "1.0.4", 18L, 18L, 3L, "1.0.3"));
    }

    @Test
    public void rejectsReusingContentCodeForAnotherVersionName() {
        reject(() -> RemoteContentPolicy.validateCandidate(3L, "1.0.4", 18L, 18L, 3L, "1.0.3"));
    }

    @Test
    public void rejectsChangingContentWithoutIncreasingVersionName() {
        reject(() -> RemoteContentPolicy.validateCandidate(4L, "1.0.3", 18L, 18L, 3L, "1.0.3"));
    }

    @Test
    public void rejectsPackageForOlderApk() {
        reject(() -> RemoteContentPolicy.validateCandidate(4L, "1.0.4", 19L, 18L, 3L, "1.0.3"));
    }

    @Test
    public void rejectsMissingContentVersionCode() {
        reject(() -> RemoteContentPolicy.validateCandidate(0L, "1.0.4", 18L, 18L, 3L, "1.0.3"));
    }

    @Test
    public void recognizesOnlyExactVersionCodeAndNameAsAlreadyInstalled() {
        assertTrue(RemoteContentPolicy.isSameInstalledVersion(3L, "1.0.3", 3L, "1.0.3"));
        assertFalse(RemoteContentPolicy.isSameInstalledVersion(4L, "1.0.4", 3L, "1.0.3"));
        assertFalse(RemoteContentPolicy.isSameInstalledVersion(3L, "1.0.4", 3L, "1.0.3"));
    }

    @Test
    public void upgradesSafelyFromLegacyManifestWithoutContentVersionCode() {
        RemoteContentPolicy.validateCandidate(3L, "1.0.3", 18L, 18L, 0L, "1.0.2");
    }
}
