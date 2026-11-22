#!/usr/bin/env bash
set -euo pipefail

PSQL=(psql -v ON_ERROR_STOP=1 -h localhost -U shbace_test -d shbace_analytics_test)

install_id="dddddddd-dddd-4ddd-8ddd-dddddddddddd"
event_id="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"

# Hold the first install row uncommitted. The event insert below uses the
# schema's DEFERRABLE FK, then its install upsert must wait and return the
# concurrently committed install row.
"${PSQL[@]}" -c "BEGIN;
  INSERT INTO pwa_analytics_installs (install_id, first_seen_at, last_active_at, source_host)
  VALUES ('${install_id}', NOW(), NOW(), 'shbace-medical-ios.vercel.app')
  ON CONFLICT (install_id) DO UPDATE SET last_active_at = GREATEST(pwa_analytics_installs.last_active_at, EXCLUDED.last_active_at);
  SELECT pg_sleep(2);
  COMMIT;" >/tmp/shbace-analytics-lock.log &
lock_pid=$!
trap 'kill "$lock_pid" 2>/dev/null || true' EXIT
sleep 0.25

"${PSQL[@]}" <<SQL
WITH inserted_event AS (
  INSERT INTO pwa_analytics_events (event_id, install_id, event_date, occurred_at)
  VALUES ('${event_id}'::uuid, '${install_id}'::uuid, (NOW() AT TIME ZONE 'UTC')::date, NOW())
  ON CONFLICT DO NOTHING
  RETURNING install_id, occurred_at, event_id
), upsert_install AS (
  INSERT INTO pwa_analytics_installs (install_id, first_seen_at, last_active_at, source_host)
  SELECT install_id, occurred_at, occurred_at, 'shbace-medical-chrome.vercel.app' FROM inserted_event
  ON CONFLICT (install_id) DO UPDATE
    SET last_active_at = GREATEST(COALESCE(pwa_analytics_installs.last_active_at, EXCLUDED.last_active_at), EXCLUDED.last_active_at)
  RETURNING install_id
), pruned_events AS (
  DELETE FROM pwa_analytics_events
  WHERE occurred_at < NOW() - INTERVAL '12 months'
    AND EXISTS (SELECT 1 FROM inserted_event)
  RETURNING event_id
)
SELECT 1 / (COUNT(*) = 1)::int FROM inserted_event;

SELECT 1 / ((SELECT COUNT(*) FROM pwa_analytics_installs WHERE install_id = '${install_id}') = 1)::int;
SELECT 1 / ((SELECT source_host FROM pwa_analytics_installs WHERE install_id = '${install_id}') = 'shbace-medical-ios.vercel.app')::int;
SELECT 1 / ((SELECT COUNT(*) FROM pwa_analytics_events WHERE install_id = '${install_id}' AND event_id = '${event_id}') = 1)::int;
SQL

wait "$lock_pid"
trap - EXIT
echo "Concurrent first-install ingestion passed."

# Verify the PostgreSQL rate limiter serializes concurrent Serverless instances.
# The shared scope is fixed test metadata and contains no client/device identifier.
rate_scope="ci-ingest-concurrent"
rate_log="$(mktemp)"
rate_pids=()
trap 'kill "$lock_pid" 2>/dev/null || true; rm -f "$rate_log"' EXIT
for i in $(seq 1 12); do
  "${PSQL[@]}" -At -c "SELECT allowed FROM consume_shbace_analytics_rate_limit('${rate_scope}', NOW(), 60, 5, 5000);" >>"$rate_log" &
  rate_pids+=("$!")
done
for pid in "${rate_pids[@]}"; do wait "$pid"; done
accepted="$(grep -c '^t$' "$rate_log" || true)"
if [[ "$accepted" -ne 5 ]]; then
  cat "$rate_log"
  echo "Expected exactly 5 accepted concurrent requests, got $accepted." >&2
  exit 1
fi
"${PSQL[@]}" -c "SELECT reset_shbace_analytics_rate_limit('${rate_scope}');"
echo "PostgreSQL distributed rate-limit concurrency passed (5/12 accepted)."
