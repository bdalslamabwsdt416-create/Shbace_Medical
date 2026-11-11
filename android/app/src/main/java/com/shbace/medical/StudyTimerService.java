package com.shbace.medical;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.core.app.NotificationCompat;

/**
 * Foreground notification for a user-started Study Timer session.
 * The system chronometer keeps displaying elapsed time while the Activity/WebView is in background.
 */
public final class StudyTimerService extends Service {
    public static final String ACTION_UPDATE = "com.shbace.medical.action.STUDY_TIMER_UPDATE";
    public static final String EXTRA_ELAPSED = "elapsed_ms";
    public static final String EXTRA_RUNNING = "running";
    private static final String CHANNEL_ID = "study-timer";
    private static final int NOTIFICATION_ID = 7311;
    private static final String TAG = "ShbaceStudyTimer";

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || ACTION_UPDATE.equals(intent.getAction())) {
            long elapsed = intent == null ? 0L : Math.max(0L, intent.getLongExtra(EXTRA_ELAPSED, 0L));
            boolean running = intent != null && intent.getBooleanExtra(EXTRA_RUNNING, false);
            try {
                startForeground(NOTIFICATION_ID, buildNotification(elapsed, running));
            } catch (Throwable t) {
                Log.e(TAG, "Could not display foreground study timer", t);
                stopSelf(startId);
            }
        }
        return START_NOT_STICKY;
    }

    private Notification buildNotification(long elapsedMs, boolean running) {
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent content = PendingIntent.getActivity(this, 7311, open,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_shbace)
                .setContentTitle("Shbace Medical · Study Time")
                .setContentText(running ? "FOCUS SESSION · In progress" : "FOCUS SESSION · Paused")
                .setSubText(running ? "Your study clock is running" : "Timer paused")
                .setStyle(new NotificationCompat.BigTextStyle().bigText(
                        running ? "Your Focus Session is active. The elapsed time continues while Shbace Medical is in the background or your screen is locked."
                                : "Your Focus Session is paused. Open Shbace Medical to resume or save this session."))
                .setContentIntent(content)
                .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
                .setColor(0xFF35B9F2)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setShowWhen(true)
                .setWhen(System.currentTimeMillis() - Math.max(0L, elapsedMs))
                .setUsesChronometer(running)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);
        return b.build();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Study Timer", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Ongoing time for a Study Timer session that you started.");
        channel.setShowBadge(false);
        manager.createNotificationChannel(channel);
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}