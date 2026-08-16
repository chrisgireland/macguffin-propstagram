# Cloudflare setup (D1 + R2 + Worker API)

This replaces Supabase with Cloudflare: **D1** for the props/sections/jobs/era_styles data,
**R2** for photos, and a small **Worker** (`worker/`) as the API the Vercel-hosted frontend
talks to. None of these have Supabase's 7-day-inactivity auto-pause.

All of this needs your own Cloudflare account — these steps can't be run for you without
your login, so work through them in order.

---

## 0. Prerequisites

No global install needed — run Wrangler on-demand with `npx` (avoids the `npm install -g`
permission errors that are common on macOS when npm's global folder isn't user-writable):

```bash
cd worker
npm install
npx wrangler login
```

This opens a browser to authorize Wrangler against your Cloudflare account. Every `wrangler`
command below should be run the same way, prefixed with `npx`, from inside `worker/`.

---

## 1. Create the D1 database

```bash
npx wrangler d1 create propstagram
```

Copy the `database_id` it prints into `worker/wrangler.toml` (`database_id = "..."`).

Apply the schema:

```bash
npx wrangler d1 execute propstagram --file=migrations/0001_init.sql --remote
```

This creates `props`, `sections`, `jobs`, `era_styles`, and seeds `sections`/`jobs` with the
same starter rows the old Supabase project had.

---

## 2. Create the R2 bucket

```bash
npx wrangler r2 bucket create propstagram-photos
```

In the Cloudflare dashboard: **R2 → propstagram-photos → Settings → Public Development URL
→ Enable**. Copy the `https://pub-xxxxxxxx.r2.dev` URL it gives you into
`worker/wrangler.toml` as `PHOTOS_PUBLIC_BASE_URL`.

---

## 3. Set Worker secrets

**`LOGINS`** — reuse the exact value from your old `VITE_LOGINS` (same
`username:passwordHash:role,...` format, same hashes) so nobody's password changes:

```bash
npx wrangler secret put LOGINS
# paste the value, e.g.: editor:abc123...:editor,client:def456...:client
```

If you only ever used `VITE_PASSWORD_HASH` (single password), convert it to the `LOGINS`
format first: `editor:<that hash>:editor`.

**`SESSION_TOKEN_SECRET`** — a fresh random value, used to sign login sessions:

```bash
openssl rand -hex 32 | npx wrangler secret put SESSION_TOKEN_SECRET
```

If you don't want login protection at all, skip `npx wrangler secret put LOGINS` entirely —
the app falls back to no-login/everyone-is-editor, same as before.

---

## 4. Deploy the Worker

```bash
npx wrangler deploy
```

Note the URL it prints (`https://propstagram-api.<your-subdomain>.workers.dev`).

Smoke-test it:

```bash
curl https://propstagram-api.<your-subdomain>.workers.dev/api/props
# -> [] (empty array, since D1 has no props yet)

curl -X POST https://propstagram-api.<your-subdomain>.workers.dev/api/props \
  -H "Content-Type: application/json" -d '{"title":"test","location":"test"}'
# -> {"error":"Unauthorized"} (expected — no auth token sent)
```

---

## 5. Migrate existing data from Supabase

Only needed if you have real props/photos already in Supabase. Run this once, from the repo
root (not `worker/`):

```bash
SUPABASE_URL=https://xxxx.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=... \
CF_ACCOUNT_ID=... \
CF_API_TOKEN=... \
D1_DATABASE_ID=... \
R2_ACCESS_KEY_ID=... \
R2_SECRET_ACCESS_KEY=... \
R2_BUCKET_NAME=propstagram-photos \
R2_PUBLIC_BASE_URL=https://pub-xxxxxxxx.r2.dev \
npm run migrate:cloudflare
```

Where to find each value:
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — Supabase dashboard → Project Settings → API
  (the **service_role** key, not anon — this bypasses RLS to read everything).
- `CF_ACCOUNT_ID` — Cloudflare dashboard sidebar (or `npx wrangler whoami` from `worker/`).
- `CF_API_TOKEN` — Cloudflare dashboard → My Profile → API Tokens → create one scoped to
  "D1: Edit" for your account.
- `D1_DATABASE_ID` — same one you put in `wrangler.toml`.
- `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` — **separate** from the general API token:
  Cloudflare dashboard → R2 → Manage R2 API Tokens → create one with read/write access.
- `R2_BUCKET_NAME` / `R2_PUBLIC_BASE_URL` — from steps 2 above.

The script logs progress per prop and prints a summary at the end. It's safe to re-run if it
fails partway — it upserts, so already-migrated rows/photos aren't duplicated. Your live
Supabase project is only read from, never modified.

After it finishes, spot-check: compare the row count against Supabase, and open a couple of
the migrated photo URLs in a browser to confirm they load.

---

## 6. Point the frontend at the new API

In `.env.local` (and Vercel → Project Settings → Environment Variables):

```
VITE_API_URL=https://propstagram-api.<your-subdomain>.workers.dev
```

Remove `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_LOGINS`, and
`VITE_PASSWORD_HASH` — none of these are used anymore (login now lives on the Worker).

Restart the dev server, or redeploy on Vercel. Test locally against the deployed Worker
before promoting to production: add/edit/delete a prop, upload a photo, log in as both editor
and client, search, sort, the gallery/table toggle, and `#/browse` (append `#/browse` to the
site URL) with no login at all.

---

## 7. Cutover

Deploy to a Vercel preview first with the new env vars, verify end-to-end there, then promote
to production. Rollback is just reverting the Vercel env vars back to the Supabase ones and
redeploying — Supabase hasn't been touched by any of this.

Once production has run stably for a day or two, you can retire Supabase: take a final export
backup from the Supabase dashboard, then pause or delete the project.
