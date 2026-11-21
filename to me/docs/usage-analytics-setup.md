# Basic Usage Analytics · Setup and approval boundary

## Current implementation status
The client, API handlers, SQL schema and Admin dashboard are part of this branch. No database has been provisioned, no Neon/Vercel integration has been connected, no environment secrets have been configured and no Production deployment has been made. In the absence of DATABASE_URL, the API fails closed with HTTP 503; the clients retain a small local pending queue.

The serverless PostgreSQL driver dependency does not create a database or provision paid infrastructure. Creating a database, connecting Vercel to it and setting secrets must be done only after explicit approval.

## Database configuration (approval required)
1. Create or select an approved PostgreSQL database.
2. Run scripts/usage-analytics-schema.sql using the provider SQL editor.
3. Set DATABASE_URL in Vercel Preview environment variables only, using a TLS-enabled pooled connection string.
4. Do not place this secret in GitHub, the repository, HTML, JavaScript, Android resources or build logs.

PWA and Android use different install and event tables. Each install has a random UUID. Each installation can record at most one activity event per UTC date, with database uniqueness constraints and event UUID idempotency. Event detail is pruned opportunistically on accepted ingestion and by a daily Vercel Cron cleanup at 03:00 UTC; records older than 12 months are deleted from both platform event tables. Install totals and first/last activity timestamps remain as aggregate installation records. The scheduled cleanup requires CRON_SECRET (at least 32 characters) and runs only after a Production deployment; it is not active in this branch or on Preview.

## Admin access (approval required)
Set the following Vercel Preview environment variables:
- ANALYTICS_ADMIN_PASSWORD: a unique password of at least 16 characters.
- ANALYTICS_SESSION_SECRET: a random secret of at least 32 bytes.
- ANALYTICS_ALLOWED_ORIGIN: the exact HTTPS origin used by the application, with no path.
- CRON_SECRET: a random secret of at least 32 characters; Vercel sends it as the Bearer token for the daily retention-cleanup request.

The Admin page is /admin/usage.html. API endpoints enforce an eight-hour signed HMAC session in a Secure, HttpOnly, SameSite=Strict cookie. No password or secret is embedded in frontend code. The login route applies a best-effort five-failure/15-minute cooldown in each warm function instance; a distributed rate limiter would require an additional approved service.

## Android endpoint activation
The APK loads assets from the local Capacitor origin, rather than the PWA origin. Android UUID persistence uses a dedicated SharedPreferences file named shbace_usage_analytics_v1. To enable upload after the official HTTPS Vercel hostname is known, set the public ANALYTICS_API_BASE_URL constant in ShbaceNative.java and then create a separately approved Android build. This branch does not bump versionCode or versionName and does not publish an APK. Until the origin is configured in a future build, Android activity events remain queued locally.

## Privacy and client behavior
Only the platform-specific endpoint, a random installation UUID, first-seen timestamp and last accepted daily activity timestamp are recorded. The application does not read or transmit student names, phone numbers, locations, question text, answers, scores, notes, bookmarks, saved questions or learning history. No raw IP or User-Agent is stored. The Admin page labels counts as installations/devices, not unique people.

PWA UUID: shbace_usage_analytics_install_id_v1 in LocalStorage. Android UUID: private SharedPreferences. Queue and consent notice use separate app-owned keys, not the study-data database. Pending events are limited to 30, attempted only once per UTC day, and retried on reconnect or when the app becomes visible.

## Preview verification
After approving the database and Preview environment variables, test:
1. First PWA launch creates one stable UUID and queues one daily activity event.
2. Repeated launches on the same UTC day do not enqueue duplicate events.
3. Offline launch keeps the bounded queue; reconnect submits pending events; replays are idempotent.
4. Admin login, unauthorized summary denial, expiry, and logout work.
5. PWA and Android counts remain distinct. Android upload testing requires the approved API origin in a later APK.
6. Verify 24-hour, 7-day and 30-day activity and the 30-day daily series.

Do not configure Production variables or promote this Preview as part of this change.
