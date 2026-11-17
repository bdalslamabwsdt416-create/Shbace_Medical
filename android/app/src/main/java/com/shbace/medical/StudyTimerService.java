package com.shbace.medical;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.os.SystemClock;
import android.util.Log;
import android.widget.RemoteViews;

import androidx.core.app.NotificationCompat;

/** The Focus Session notification contains only a native Chronometer in collapsed and expanded layouts. */
public final class StudyTimerService extends Service {
    public static final String ACTION_UPDATE = "com.shbace.medical.action.STUDY_TIMER_UPDATE";
    public static final String EXTRA_ELAPSED = "elapsed_ms";
    public static final String EXTRA_RUNNING = "running";
    private static final String CHANNEL_ID = "study-timer";
    private static final int NOTIFICATION_ID = 7311;
    private static final String TAG = "ShbaceStudyTimer";
    private static final String PREFS = "shbace_native_study_clock_v1";
    private static final String KEY_ELAPSED = "accumulated_ms";
    private static final String KEY_RUNNING = "running";
    private static final String KEY_STARTED = "started_elapsed_realtime";

    private long accumulatedMs = 0L;
    private long startedAtElapsedRealtime = 0L;
    private boolean running = false;

    @Override public void onCreate() { super.onCreate(); createChannel(); restoreState(); }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_UPDATE.equals(intent.getAction())) {
            long elapsed = Math.max(0L, intent.getLongExtra(EXTRA_ELAPSED, 0L));
            setClockState(elapsed, intent.getBooleanExtra(EXTRA_RUNNING, false));
        } else {
            restoreState();
        }
        try { startForeground(NOTIFICATION_ID, buildNotification()); }
        catch (Throwable t) { Log.e(TAG, "Could not display foreground study timer", t); stopSelf(startId); }
        return START_STICKY;
    }

    private void setClockState(long elapsed, boolean active) {
        accumulatedMs = elapsed;
        running = active;
        startedAtElapsedRealtime = StudyTimerClock.runningStart(active, SystemClock.elapsedRealtime());
        persistState();
    }

    private void restoreState() {
        android.content.SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
        accumulatedMs = Math.max(0L, p.getLong(KEY_ELAPSED, 0L));
        running = p.getBoolean(KEY_RUNNING, false);
        startedAtElapsedRealtime = Math.max(0L, p.getLong(KEY_STARTED, 0L));
        if (running && startedAtElapsedRealtime <= 0L) { running = false; startedAtElapsedRealtime = 0L; }
    }

    private void persistState() {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().putLong(KEY_ELAPSED, accumulatedMs)
                .putBoolean(KEY_RUNNING, running).putLong(KEY_STARTED, startedAtElapsedRealtime).apply();
    }

    private long elapsedNow() {
        return StudyTimerClock.elapsedNow(accumulatedMs, startedAtElapsedRealtime,
                SystemClock.elapsedRealtime(), running);
    }

    private String formatClock(long millis) {
        long sec = Math.max(0L, millis / 1000L), h = sec / 3600L, m = (sec % 3600L) / 60L, s = sec % 60L;
        return h > 0L ? String.format(java.util.Locale.US, "%d:%02d:%02d", h, m, s)
                : String.format(java.util.Locale.US, "%02d:%02d", m, s);
    }

    private RemoteViews clockView(long elapsed) {
        RemoteViews view = new RemoteViews(getPackageName(), R.layout.notification_study_timer);
        long base = SystemClock.elapsedRealtime() - Math.max(0L, elapsed);
        view.setChronometer(R.id.study_timer_chronometer, base, "%s", running);
        if (!running) view.setTextViewText(R.id.study_timer_chronometer, formatClock(elapsed));
        view.setContentDescription(R.id.study_timer_chronometer, "Study time " + formatClock(elapsed));
        return view;
    }

    private Notification buildNotification() {
        long elapsed = elapsedNow();
        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tap = PendingIntent.getActivity(this, NOTIFICATION_ID, open,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_timer)
                .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
                .setCustomContentView(clockView(elapsed))
                .setCustomBigContentView(clockView(elapsed))
                .setContentIntent(tap)
                .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
                .setColor(0xFF1766B4)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .setShowWhen(false)
                .build();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Study Timer", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Ongoing Focus Session clock.");
        channel.setShowBadge(false);
        channel.setSound(null, null);
        channel.enableVibration(false);
        manager.createNotificationChannel(channel);
    }

    @Override public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit().clear().apply();
        super.onDestroy();
    }
}