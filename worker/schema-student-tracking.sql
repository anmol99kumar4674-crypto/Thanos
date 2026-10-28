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
