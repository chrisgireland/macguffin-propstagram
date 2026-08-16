-- Structured data for macguffin-propstagram, replacing the Supabase Postgres schema.
-- Run with: wrangler d1 execute propstagram --file=migrations/0001_init.sql --remote

CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- New editable list, same pattern as sections/jobs.
CREATE TABLE IF NOT EXISTS era_styles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS props (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT NOT NULL,
  category TEXT,
  job TEXT NOT NULL DEFAULT 'General Inventory',
  quantity INTEGER NOT NULL DEFAULT 1,
  photo TEXT,
  length TEXT,
  width TEXT,
  code TEXT,
  color TEXT NOT NULL DEFAULT '[]',      -- JSON array text, e.g. '["Red","Gold"]'
  condition TEXT,                          -- Excellent | Good | Needs Repair | Fragile
  era_style TEXT,                          -- free text, populated from era_styles.name via UI
  status TEXT,                             -- In Stock | Checked Out | In Repair
  tags TEXT NOT NULL DEFAULT '[]',         -- JSON array text, freeform
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_props_created_at ON props(created_at);

-- Seed data matches the current Supabase seed (see SHARED-SETUP.md) so a fresh
-- D1 looks identical to a fresh Supabase project.
INSERT INTO jobs (id, name) VALUES (lower(hex(randomblob(16))), 'General Inventory')
  ON CONFLICT(name) DO NOTHING;

INSERT INTO sections (id, name, sort_order) VALUES
  (lower(hex(randomblob(16))), 'White Plateware', 1),
  (lower(hex(randomblob(16))), 'Earthtone Plateware', 2),
  (lower(hex(randomblob(16))), 'Colored Plateware', 3),
  (lower(hex(randomblob(16))), 'Earthtone Smalls', 4),
  (lower(hex(randomblob(16))), 'White Smalls', 5),
  (lower(hex(randomblob(16))), 'Metal Smalls', 6),
  (lower(hex(randomblob(16))), 'Copper', 7),
  (lower(hex(randomblob(16))), 'Pots/Pans', 8),
  (lower(hex(randomblob(16))), 'Utensils', 9),
  (lower(hex(randomblob(16))), 'Miscellaneous', 10),
  (lower(hex(randomblob(16))), 'Surfaces', 11)
  ON CONFLICT(name) DO NOTHING;

-- era_styles starts empty; editors populate it via "Add New Era/Style" in the app.
