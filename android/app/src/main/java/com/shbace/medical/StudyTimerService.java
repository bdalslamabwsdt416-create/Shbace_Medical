package com.shbace.medical;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.os.Build;
import android.os.IBinder;
import android.os.SystemClock;
import android.util.Log;
import android.widget.RemoteViews;

import androidx.core.app.NotificationCompat;

/**
 * Foreground Study Timer notification.
 *
 * The visible notification content is one native Chronometer only. The service stores its
 * elapsed-time anchor in SharedPreferences so START_STICKY can restore it after process death.
 * RemoteViews.setChronometer is clock-driven by Android; this service does not post per-second updates.
 */
public final class StudyTimerService extends Service {
    public static final String ACTION_UPDATE = "com.shbace.medical.action.STUDY_TIMER_UPDATE";
    public static final String EXTRA_ELAPSED = "elapsed_ms";
    public static final String EXTRA_RUNNING = "running";

    private static final String CHANNEL_ID = "study-timer";
    private static final int NOTIFICATION_ID = 7311;
    private static final String TAG = "ShbaceStudyTimer";
    private static final String PREFS = "shbace_native_study_timer_v1";
    private static final String KEY_ACTIVE = "active";
    private static final String KEY_RUNNING = "running";
    private static final String KEY_ELAPSED = "elapsed_ms";
    private static final String KEY_START_UPTIME = "start_uptime_ms";

    @Override
    public void onCreate() {
        super.onCreate();
        createChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        long elapsedMs;
        boolean running;

        if (intent != null && ACTION_UPDATE.equals(intent.getAction())) {
            elapsedMs = Math.max(0L, intent.getLongExtra(EXTRA_ELAPSED, 0L));
            running = intent.getBooleanExtra(EXTRA_RUNNING, false);
            saveState(elapsedMs, running);
        } else {
            SharedPreferences state = getSharedPreferences(PREFS, MODE_PRIVATE);
            if (!state.getBoolean(KEY_ACTIVE, false)) {
                stopSelf(startId);
                return START_NOT_STICKY;
            }
            running = state.getBoolean(KEY_RUNNING, false);
            elapsedMs = Math.max(0L, state.getLong(KEY_ELAPSED, 0L));
            if (running) {
                long startUptime = state.getLong(KEY_START_UPTIME, 0L);
                if (startUptime > 0L) elapsedMs = Math.max(elapsedMs, SystemClock.elapsedRealtime() - startUptime);
            }
        }

        try {
            startForeground(NOTIFICATION_ID, buildNotification(elapsedMs, running));
        } catch (Throwable t) {
            Log.e(TAG, "Could not display foreground study timer", t);
            stopSelf(startId);
            return START_NOT_STICKY;
        }
        return START_STICKY;
    }

    private void saveState(long elapsedMs, boolean running) {
        long now = SystemClock.elapsedRealtime();
        long startUptime = running ? Math.max(0L, now - elapsedMs) : 0L;
        getSharedPreferences(PREFS, MODE_PRIVATE).edit()
                .putBoolean(KEY_ACTIVE, true)
                .putBoolean(KEY_RUNNING, running)
                .putLong(KEY_ELAPSED, elapsedMs)
                .putLong(KEY_START_UPTIME, startUptime)
                .apply();
    }

    /** Called only for an explicit Finish/stop action, not from onDestroy (which may follow process death). */
    public static void clearSavedState(Context context) {
        try {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply();
        } catch (Throwable ignored) { }
    }

    private Notification buildNotification(long elapsedMs, boolean running) {
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent content = PendingIntent.getActivity(this, NOTIFICATION_ID, open,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));

        RemoteViews clock = new RemoteViews(getPackageName(), R.layout.notification_study_timer);
        long base = Math.max(0L, SystemClock.elapsedRealtime() - Math.max(0L, elapsedMs));
        clock.setChronometer(R.id.study_timer_chronometer, base, null, running);
        clock.setContentDescription(R.id.study_timer_chronometer, "Study timer elapsed time");
        boolean night = (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK)
                == Configuration.UI_MODE_NIGHT_YES;
        clock.setTextColor(R.id.study_timer_chronometer, night ? 0xFF9AD9FF : 0xFF103A67);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_study_timer)
                .setContentIntent(content)
                .setCustomContentView(clock)
                .setCustomBigContentView(clock)
                .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
                .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
                .setColor(0xFF123B68)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setSilent(true)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .build();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Study Timer", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Ongoing elapsed time for a Focus Session started by the student.");
        channel.setShowBadge(false);
        channel.setSound(null, null);
        channel.enableVibration(false);
        channel.enableLights(false);
        manager.createNotificationChannel(channel);
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
