-- Run manually only after the user approves a PostgreSQL/Neon database.
-- No student identity, study content, answers, scores, notes, bookmarks, raw IP or raw User-Agent columns.
-- PWA and Android remain physically separate so metrics cannot cross-contaminate.

CREATE TABLE IF NOT EXISTS pwa_analytics_installs (
  install_id UUID PRIMARY KEY,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_active_at TIMESTAMPTZ
);
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
