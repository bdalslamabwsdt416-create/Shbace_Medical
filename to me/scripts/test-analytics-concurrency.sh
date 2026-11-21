#!/usr/bin/env bash
set -euo pipefail

PSQL=(psql -v ON_ERROR_STOP=1 -h localhost -U shbace_test -d shbace_analytics_test)

install_id="dddddddd-dddd-4ddd-8ddd-dddddddddddd"
event_id="eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"

# Hold an uncommitted first-install insert so the ingestion statement below
# encounters a real concurrent unique-key conflict and must wait for commit.
"${PSQL[@]}" -c "BEGIN;
  INSERT INTO pwa_analytics_installs (install_id, first_seen_at, last_active_at)
  VALUES ('${install_id}', NOW(), NOW())
  ON CONFLICT (install_id) DO UPDATE SET install_id = EXCLUDED.install_id;
  SELECT pg_sleep(2);
  COMMIT;" >/tmp/shbace-analytics-lock.log &
lock_pid=$!
trap 'kill "$lock_pid" 2>/dev/null || true' EXIT
sleep 0.25

"${PSQL[@]}" <<SQL
WITH created_install AS (
  INSERT INTO pwa_analytics_installs (install_id, first_seen_at, last_active_at)
  VALUES ('${install_id}'::uuid, NOW(), NOW())
  ON CONFLICT (install_id) DO UPDATE SET install_id = EXCLUDED.install_id
  RETURNING install_id
), target_install AS (
  SELECT install_id FROM created_install
), inserted_event AS (
  INSERT INTO pwa_analytics_events (event_id, install_id, event_date, occurred_at)
  SELECT '${event_id}'::uuid, install_id, (NOW() AT TIME ZONE 'UTC')::date, NOW()
  FROM target_install
  ON CONFLICT DO NOTHING
  RETURNING install_id, occurred_at, event_id
), updated_install AS (
  UPDATE pwa_analytics_installs AS i
  SET last_active_at = GREATEST(COALESCE(i.last_active_at, e.occurred_at), e.occurred_at)
  FROM inserted_event AS e
  WHERE i.install_id = e.install_id
  RETURNING e.event_id
), pruned_events AS (
  DELETE FROM pwa_analytics_events
  WHERE occurred_at < NOW() - INTERVAL '12 months'
    AND EXISTS (SELECT 1 FROM inserted_event)
  RETURNING event_id
)
SELECT 1 / (COUNT(*) = 1)::int FROM updated_install;

SELECT 1 / ((SELECT COUNT(*) FROM pwa_analytics_installs WHERE install_id = '${install_id}') = 1)::int;
SELECT 1 / ((SELECT COUNT(*) FROM pwa_analytics_events WHERE install_id = '${install_id}' AND event_id = '${event_id}') = 1)::int;
SQL

wait "$lock_pid"
trap - EXIT
echo "Concurrent first-install ingestion passed."
