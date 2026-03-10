# Making the app shared and deployable

This guide gets you to a **public URL** and **shared storage** so everyone who opens the app sees the same props and can add new ones.

You’ll do two things:

1. **Supabase** – database + photo storage so data is saved and shared.
2. **Vercel** (or similar) – host the app so anyone can open it with a link.

---

## Part 1: Supabase (shared data and photos)

### 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in (free account is fine).
2. Click **New project**, pick an organization (or create one), name it (e.g. `macguffin-propstagram`), set a database password, and choose a region. Click **Create project** and wait for it to finish.

### 2. Create the `props` table

1. In the Supabase dashboard, open **SQL Editor**.
2. Click **New query** and paste this SQL, then run it:

```sql
create table if not exists public.props (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text not null,
  category text not null,
  job text not null,
  quantity int not null default 1,
  photo text,
  latitude double precision,
  longitude double precision,
  map_x double precision,
  map_y double precision,
  shelf_index int,
  length text,
  width text,
  created_at timestamptz not null default now()
);

-- Allow anyone to read and insert (no auth for now)
alter table public.props enable row level security;

create policy "Allow public read"
  on public.props for select
  using (true);

create policy "Allow public insert"
  on public.props for insert
  with check (true);

create policy "Allow public delete"
  on public.props for delete
  using (true);

create policy "Allow public update"
  on public.props for update
  using (true)
  with check (true);
```

**If you already have a `props` table**, add map columns in the SQL Editor:

```sql
alter table public.props
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists map_x double precision,
  add column if not exists map_y double precision,
  add column if not exists shelf_index int,
  add column if not exists length text,
  add column if not exists width text;
```

`shelf_index` is which shelf the prop is on (0–N on the floor plan). `length` and `width` are optional dimensions (e.g. "24 in", "18 cm"). Replace `public/prop-room-map.svg` with your own floor plan to use it.

### 2b. Create the `jobs` and `sections` tables (shared job and category lists)

Run this in the SQL Editor so everyone sees the same jobs and sections:

```sql
-- Jobs: one row per job name
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.jobs enable row level security;

create policy "Allow public read jobs"
  on public.jobs for select using (true);

create policy "Allow public insert jobs"
  on public.jobs for insert with check (true);

-- Sections (categories): one row per section, sort_order keeps display order
create table if not exists public.sections (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.sections enable row level security;

create policy "Allow public read sections"
  on public.sections for select using (true);

create policy "Allow public insert sections"
  on public.sections for insert with check (true);

-- Seed initial job
insert into public.jobs (name) values ('General Inventory')
on conflict (name) do nothing;

-- Seed initial sections (order matches the app tabs)
insert into public.sections (name, sort_order) values
  ('White Plateware', 1),
  ('Earthtone Plateware', 2),
  ('Colored Plateware', 3),
  ('Earthtone Smalls', 4),
  ('White Smalls', 5),
  ('Metal Smalls', 6),
  ('Copper', 7),
  ('Pots/Pans', 8),
  ('Utensils', 9),
  ('Miscellaneous', 10),
  ('Surfaces', 11)
on conflict (name) do nothing;
```

### 3. Create the storage bucket for photos

1. Go to **Storage** in the left sidebar.
2. Click **New bucket**.
3. Name: `prop-photos`.
4. Leave **Public bucket** **on** (so photo URLs work for everyone).
5. Click **Create bucket**.
6. Open the `prop-photos` bucket, go to **Policies**, and add a policy so anyone can upload and read:

   - **New policy** → “For full customization”.
   - Policy name: `Allow public upload and read`
   - Allowed operations: **SELECT** and **INSERT**.
   - Target roles: leave default (or `public`).
   - With expression: `true` for both.

   Or run in SQL Editor:

```sql
-- Allow public to upload and read prop photos
insert into storage.buckets (id, name, public)
values ('prop-photos', 'prop-photos', true)
on conflict (id) do update set public = true;

create policy "Allow public upload"
  on storage.objects for insert
  with check (bucket_id = 'prop-photos');

create policy "Allow public read"
  on storage.objects for select
  using (bucket_id = 'prop-photos');
```

### 4. Add your Supabase keys to the app

1. In Supabase, go to **Project Settings** (gear icon). Under **Integrations** (or in the main settings list), open **API Keys**.
2. Copy **Project URL** and the **anon public** key (sometimes labeled “anon” or “public” – the one that’s safe to use in the browser; not the “service_role” key).
3. In your project folder, copy the example env file and fill in the values:

   ```bash
   cp .env.example .env.local
   ```

4. Edit `.env.local` and set:

   ```
   VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

5. Restart the dev server (`npm run dev`). The app will now load and save props from Supabase and upload photos to `prop-photos`.

---

## Part 2: Deploy so others can access the app (Vercel)

### 1. Push your code to GitHub

1. Create a new repo on [github.com](https://github.com).
2. In your project folder, run (if you haven’t already):

   ```bash
   git init
   git add .
   git commit -m "Add Supabase and shared storage"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

### 2. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (e.g. with GitHub).
2. Click **Add New** → **Project** and import your GitHub repo.
3. Leave **Build Command** as `npm run build` and **Output Directory** as `dist`.
4. Under **Environment Variables**, add the same two you use locally:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
5. Click **Deploy**. When it’s done, Vercel gives you a URL like `https://your-project.vercel.app`.

Share that URL; anyone who opens it will see the same props and can add new ones (stored in Supabase).

---

## Summary

| Step | What it does |
|------|----------------|
| Supabase project | Hosts your database and file storage |
| `props` table | Stores every prop everyone adds |
| `prop-photos` bucket | Stores uploaded photos; app uses public URLs |
| `.env.local` | Lets the app talk to your Supabase project (never commit this file) |
| Vercel deploy | Puts the app on a public URL; add the same env vars there |

If you skip Supabase (no `.env.local`), the app still runs locally but props stay in memory and aren’t shared. Once Supabase is set up and env vars are added (locally and on Vercel), the app is shared and persistent for everyone.
