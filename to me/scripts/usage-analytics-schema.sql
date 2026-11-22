-- Run manually only after the user approves a PostgreSQL/Neon database.
-- No student identity, study content, answers, scores, notes, bookmarks, raw IP or raw User-Agent columns.
-- PWA and Android remain physically separate so metrics cannot cross-contaminate.

CREATE TABLE IF NOT EXISTS pwa_analytics_installs (
  install_id UUID PRIMARY KEY,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_active_at TIMESTAMPTZ,
  source_host TEXT
);
-- Existing rows remain NULL: their original PWA hostname was never recorded.
ALTER TABLE pwa_analytics_installs
  ADD COLUMN IF NOT EXISTS source_host TEXT;

CREATE TABLE IF NOT EXISTS pwa_analytics_events (
  event_id UUID PRIMARY KEY,
  install_id UUID NOT NULL REFERENCES pwa_analytics_installs(install_id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  event_date DATE NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT pwa_analytics_one_event_per_install_day UNIQUE (install_id, event_date)
);
CREATE INDEX IF NOT EXISTS pwa_analytics_events_occurred_at_idx ON pwa_analytics_events (occurred_at DESC);

CREATE TABLE IF NOT EXISTS android_analytics_installs (
  install_id UUID PRIMARY KEY,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_active_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS android_analytics_events (
  event_id UUID PRIMARY KEY,
  install_id UUID NOT NULL REFERENCES android_analytics_installs(install_id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
  event_date DATE NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT android_analytics_one_event_per_install_day UNIQUE (install_id, event_date)
);
CREATE INDEX IF NOT EXISTS android_analytics_events_occurred_at_idx ON android_analytics_events (occurred_at DESC);

-- Shared database-backed distributed rate limiting. Scopes contain only fixed
-- endpoint labels; never put IP addresses, install IDs, user agents or fingerprints here.
CREATE TABLE IF NOT EXISTS analytics_rate_limit_events (
  scope TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS analytics_rate_limit_events_scope_time_idx
  ON analytics_rate_limit_events (scope, attempted_at DESC);

CREATE OR REPLACE FUNCTION consume_shbace_analytics_rate_limit(
  p_scope TEXT,
  p_attempted_at TIMESTAMPTZ,
  p_window_seconds INTEGER,
  p_window_limit INTEGER,
  p_daily_limit INTEGER DEFAULT NULL
)
RETURNS TABLE (
  allowed BOOLEAN,
  window_count INTEGER,
  daily_count INTEGER,
  retry_after_seconds INTEGER,
  reason TEXT
)
LANGUAGE plpgsql
AS $analytics_rate_limit$
DECLARE
  v_window_count INTEGER;
  v_daily_count INTEGER;
  v_oldest TIMESTAMPTZ;
  v_day_start TIMESTAMPTZ;
  v_next_day TIMESTAMPTZ;
  v_retry INTEGER;
BEGIN
  IF p_scope IS NULL OR p_scope = '' OR p_window_seconds < 1 OR p_window_limit < 1
     OR (p_daily_limit IS NOT NULL AND p_daily_limit < 1) THEN
    RAISE EXCEPTION 'invalid analytics rate limit arguments';
  END IF;

  -- The transaction-scoped advisory lock serializes all app instances sharing this scope.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_scope, 0));

  DELETE FROM analytics_rate_limit_events
   WHERE scope = p_scope
     AND attempted_at < p_attempted_at - INTERVAL '48 hours';

  v_day_start := date_trunc('day', p_attempted_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  SELECT
    COUNT(*) FILTER (
      WHERE attempted_at > p_attempted_at - make_interval(secs => p_window_seconds)
    )::INTEGER,
    COUNT(*) FILTER (WHERE attempted_at >= v_day_start)::INTEGER,
    MIN(attempted_at) FILTER (
      WHERE attempted_at > p_attempted_at - make_interval(secs => p_window_seconds)
    )
  INTO v_window_count, v_daily_count, v_oldest
  FROM analytics_rate_limit_events
  WHERE scope = p_scope;

  IF v_window_count >= p_window_limit THEN
    v_retry := GREATEST(
      1,
      CEIL(EXTRACT(EPOCH FROM (
        v_oldest + make_interval(secs => p_window_seconds) - p_attempted_at
      )))::INTEGER
    );
    RETURN QUERY SELECT FALSE, v_window_count, v_daily_count, v_retry, 'minute_limit'::TEXT;
    RETURN;
  END IF;

  IF p_daily_limit IS NOT NULL AND v_daily_count >= p_daily_limit THEN
    v_next_day := v_day_start + INTERVAL '1 day';
    v_retry := GREATEST(
      1,
      CEIL(EXTRACT(EPOCH FROM (v_next_day - p_attempted_at)))::INTEGER
    );
    RETURN QUERY SELECT FALSE, v_window_count, v_daily_count, v_retry, 'daily_limit'::TEXT;
    RETURN;
  END IF;

  INSERT INTO analytics_rate_limit_events (scope, attempted_at)
  VALUES (p_scope, p_attempted_at);

  RETURN QUERY SELECT TRUE, v_window_count + 1, v_daily_count + 1, 0, NULL::TEXT;
END;
$analytics_rate_limit$;

CREATE OR REPLACE FUNCTION reset_shbace_analytics_rate_limit(p_scope TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $analytics_rate_limit_reset$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_scope, 0));
  DELETE FROM analytics_rate_limit_events WHERE scope = p_scope;
  RETURN TRUE;
END;
$analytics_rate_limit_reset$;
