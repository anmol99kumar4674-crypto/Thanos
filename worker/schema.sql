CREATE TABLE IF NOT EXISTS app_data (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO app_data (id, value, updated_at)
VALUES (1, '{"courses":[{"id":"mbbs","name":"MBBS","description":"Bachelor of Medicine and Bachelor of Surgery","years":[]},{"id":"bds","name":"BDS","description":"Bachelor of Dental Surgery","years":[]},{"id":"other","name":"OTHER","description":"Other learning programmes","years":[]}]}', CURRENT_TIMESTAMP);


-- Student visit analytics. Name/course login is for basic identification only.
CREATE TABLE IF NOT EXISTS student_visits (
  session_id TEXT PRIMARY KEY,
  student_name TEXT NOT NULL,
  course TEXT NOT NULL,
  started_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  ended_at TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active'
);
CREATE INDEX IF NOT EXISTS idx_student_visits_started_at ON student_visits(started_at);
CREATE INDEX IF NOT EXISTS idx_student_visits_student_name ON student_visits(student_name);
