-- Shared curated lists: pick specific props into a named list, share via link.
-- Open to anyone (including guests, no login) to create/add to, matching the
-- public-insert policy the old Supabase RLS setup had for these tables.

CREATE TABLE IF NOT EXISTS shared_lists (
  id TEXT PRIMARY KEY,
  name TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS shared_list_items (
  list_id TEXT NOT NULL,
  prop_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (list_id, prop_id)
);

CREATE INDEX IF NOT EXISTS idx_shared_list_items_list ON shared_list_items(list_id);
