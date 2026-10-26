CREATE TABLE IF NOT EXISTS app_data (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT OR IGNORE INTO app_data (id, value, updated_at)
VALUES (1, '{"courses":[{"id":"mbbs","name":"MBBS","description":"Bachelor of Medicine and Bachelor of Surgery","years":[]},{"id":"bds","name":"BDS","description":"Bachelor of Dental Surgery","years":[]},{"id":"other","name":"OTHER","description":"Other learning programmes","years":[]}]}', CURRENT_TIMESTAMP);
