# Basic Usage Analytics · Setup and approval boundary

## Current implementation status

The client, API handlers, SQL schema, Admin dashboard and distributed quota controls are implemented. A dedicated Neon Free PostgreSQL 16 project has been provisioned for analytics in `aws-us-east-1`. The four PWA/Android tables and the shared rate-limit functions are installed. The To Me Vercel project has a TLS pooled `DATABASE_URL` stored as a **Sensitive Preview-only** environment variable; no Production database variable has been added.

The API fails closed with HTTP 503 when the database or the active distributed rate limiter is unavailable. Client queues remain bounded and retain events for a later retry.

### API origin for separately hosted PWA copies

The official To Me deployment leaves `SHBACE_ANALYTICS_API_BASE_URL` unset and uses its own same-origin API. A separately hosted copy built from the To Me source may set this **public build-time** variable to the exact HTTPS origin of the approved central analytics API. The To Me build script validates the origin and embeds it before the shared client loads. Add that PWA's exact origin to the API project's `ANALYTICS_ALLOWED_ORIGIN` allowlist. Never put a secret or URL path in this variable. The Computer, iOS and Chrome Android builds use the same public variable with the same validation rules.


## Database configuration

The database schema is in `scripts/usage-analytics-schema.sql`. It creates separate PWA and Android installation/event tables, plus `analytics_rate_limit_events` and two PostgreSQL functions for shared request quotas. Migrations are idempotent.

PWA and Android use different install and event tables. Each install has a random UUID. Each installation can record at most one activity event per UTC date, with database uniqueness constraints and event UUID idempotency. Event detail is pruned opportunistically on accepted ingestion and by a daily Vercel Cron cleanup at 03:00 UTC; records older than 12 months are deleted from both platform event tables. Install totals and first/last activity timestamps remain as aggregate installation records. The scheduled cleanup requires `CRON_SECRET` (at least 32 characters) and runs only after a Production deployment.

## Admin access and distributed rate limiting

Set the following Vercel environment variables for each environment that is intentionally enabled:

- `ANALYTICS_ADMIN_PASSWORD`: a unique password of at least 16 characters.
- `ANALYTICS_SESSION_SECRET`: a random secret of at least 32 bytes.
- `ANALYTICS_ALLOWED_ORIGIN`: comma-separated exact HTTPS origins, without paths. Never use wildcard origins.
- `CRON_SECRET`: a random secret of at least 32 characters; Vercel sends it as the Bearer token for the daily retention-cleanup request.

**PostgreSQL is the default distributed limiter.** It stores only fixed logical scopes (`ingest:pwa`, `ingest:android`, and `admin-login`) and timestamps. A PostgreSQL transaction-scoped advisory lock serializes requests across all Vercel Function instances before counting and inserting attempts. It enforces:
- 120 requests per rolling 60-second window and 5,000 per UTC day, separately for PWA and Android.
- Five Admin login attempts per rolling 15-minute window; a successful login clears that Admin scope.
- `Retry-After` for exhausted quotas, including the exact next UTC midnight for daily limits.

No IP address, forwarded-IP header, User-Agent, installation UUID or device fingerprint is collected or used in limiter scopes. Rate-limit rows older than 48 hours are pruned within the same locked function. A valid event request consumes its quota before the event-table idempotency check, so duplicate valid retries also consume quota.

**Optional Redis acceleration.** A fully configured Upstash REST service may be used instead by supplying `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `ANALYTICS_RATE_LIMIT_SECRET` (at least 32 bytes). When those three values form a valid configuration, Redis is the active limiter; if it becomes unavailable, the API fails closed rather than switching to a fresh quota store. Without a complete Redis configuration, the PostgreSQL limiter is used automatically. Redis is therefore optional, not a deployment prerequisite.

The Admin page is `/admin/usage.html`. API endpoints enforce an eight-hour signed HMAC session in a Secure, HttpOnly, SameSite=Strict cookie. No password or secret is embedded in frontend code. Login fails closed with HTTP 503 if the database/limiter or Admin secrets are missing.

These are global quotas, not per-user fairness controls: one abusive sender can consume a platform's shared allowance and temporarily cause legitimate clients on that platform to receive 429. This privacy-preserving design avoids IP/device identity but does not stop requests from reaching the Serverless Function. The PostgreSQL fallback also adds a serialized database operation per request; use Redis later if sustained traffic makes database contention or latency material. Vercel Hobby does not permit a custom header-key WAF rate limit, and the project does not enable IP/JA4-based WAF keys.

## Android endpoint activation
The APK loads assets from the local Capacitor origin (`https://localhost`), rather than the PWA origin. Android UUID persistence uses a dedicated SharedPreferences file named `shbace_usage_analytics_v1`. The native `ANALYTICS_API_BASE_URL` is configured to the official HTTPS analytics API origin (`https://shbacemedical-www.vercel.app`) in this PR. Android activity events will upload after an APK containing this source is built and installed. This PR does not bump `versionCode` or `versionName`, and the Release APK pipeline remains gated on the original approved signing key; the CI Debug APK is for internal validation only.

## Privacy and client behavior
Only the platform-specific endpoint, a random installation UUID, first-seen timestamp and last accepted daily activity timestamp are recorded. For PWA installations, the first accepted event stores the validated source hostname so the Admin page can attribute installations to one of the five published PWA links. Legacy rows with no source are attributed when they next send activity; a previously recorded hostname is never overwritten. Only the hostname is stored; the full URL, referrer, query string, raw IP and User-Agent are not stored. The application does not read or transmit student names, phone numbers, precise location, question text, answers, scores, notes, bookmarks, saved questions or learning history. The Admin page labels counts as installations/devices, not unique people.

PWA UUID: shbace_usage_analytics_install_id_v1 in LocalStorage. Android UUID: private SharedPreferences. Queue and consent notice use separate app-owned keys, not the study-data database. Pending events are limited to 30, attempted only once per UTC day, and retried on reconnect or when the app becomes visible.

## Preview verification
After configuring the Preview Admin secrets, test:
1. First PWA launch creates one stable UUID and queues one daily activity event.
2. Repeated launches on the same UTC day do not enqueue duplicate events.
3. Offline launch keeps the bounded queue; reconnect submits pending events; replays are idempotent.
4. Admin login, unauthorized summary denial, expiry, and logout work.
5. PWA and Android counts remain distinct. Android upload testing requires the approved API origin in a later APK.
6. Verify 24-hour, 7-day and 30-day activity and the 30-day daily series.

Do not configure Production variables or promote this Preview until all operational gates pass. Redis remains optional; the database-backed distributed limiter is the default.


## Separate iOS PWA integration and Safari limits
The independent `for Computer`, `for Chrome` and `for ios` builds now package the same canonical `js/54-usage-analytics.js` source from `to me` at build time; none maintains a forked analytics client. All use the same payload contract and PWA event endpoint. The iOS PWA build keeps its own `shbace-medical-offline-v2` Cache Storage namespace and `shbace-medical-offline-state-v1` IndexedDB database. Analytics identity and queue use separate app-owned LocalStorage keys and do not enter student study stores. The Service Worker only handles GET requests, so analytics POST requests bypass its cache strategy.

The `to me` PWA uses its same-origin API route. The independent `for Computer`, `for Chrome` and `for ios` builds package the canonical client from `to me` and support the build-time `SHBACE_ANALYTICS_API_BASE_URL` variable. For each independently hosted PWA, either route `/api/analytics/pwa-event` to the shared API or set that variable in its hosting project's build environment to the approved HTTPS API origin; each build validates and injects the public origin before the analytics script runs. Leave it unset until the API host is approved. Add every exact PWA origin to the comma-separated `ANALYTICS_ALLOWED_ORIGIN` allowlist on the API deployment. No endpoint hostname is hard-coded and no service is provisioned by this branch. If a route is unavailable (404) or temporarily denied, the client retains the event rather than deleting it.

Storage is origin-scoped. A Home Screen web app launched in standalone mode is separate from a Safari tab and is not subject to Safari tab's seven-day script-writable storage deletion rule. However, WebKit storage remains best-effort by default: the OS can evict an origin under overall storage pressure, and users can clear its website data. On iOS/iPadOS 17 and later, WebKit supports StorageManager.estimate(), persisted() and persist(); persistence requests are decided heuristically and are not a guarantee. Separate LocalStorage/IndexedDB namespaces prevent this analytics code from modifying student records, but they are not separate OS eviction boundaries: origin-level eviction can remove all website data for that origin. A normal app update on the same origin does not intentionally rotate the analytics UUID. Private browsing has different retention behavior. On iOS 26/iPadOS 26, users can choose whether an added Home Screen site opens as a web app; verify standalone launch when validating the installed PWA. Do not rely on Background Sync, Periodic Background Sync or a persistent background JavaScript process for iOS Safari/Home Screen PWAs. This implementation retries on the next online event or when the app becomes visible, and otherwise waits for the next foreground launch. The UUID is therefore stable across ordinary updates, but not after the user or OS removes the origin's storage. Real iPhone/iPad Safari and Home Screen validation remains required before claiming device-level compatibility.
