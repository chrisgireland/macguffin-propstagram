#!/usr/bin/env node
// One-time migration: copies props/sections/jobs from the live Supabase project
// into Cloudflare D1, and prop photos from Supabase Storage into R2.
//
// Run once locally, after the Worker + empty D1/R2 are provisioned and deployed
// (see the Cloudflare setup doc), and BEFORE pointing the frontend at the new API.
// The live Supabase-backed app is untouched — this script only reads from Supabase.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... CF_ACCOUNT_ID=... CF_API_TOKEN=... \
//   D1_DATABASE_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... \
//   R2_BUCKET_NAME=propstagram-photos R2_PUBLIC_BASE_URL=https://xxxx.r2.dev \
//   node scripts/migrate-to-cloudflare.mjs
//
// Safe to re-run: D1 writes upsert on conflict, R2 uploads overwrite the same
// deterministic key, so a partial failure can just be rerun.

import { createClient } from "@supabase/supabase-js";
import { AwsClient } from "aws4fetch";

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  CF_ACCOUNT_ID,
  CF_API_TOKEN,
  D1_DATABASE_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_BASE_URL,
} = process.env;

const required = {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  CF_ACCOUNT_ID,
  CF_API_TOKEN,
  D1_DATABASE_ID,
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME,
  R2_PUBLIC_BASE_URL,
};
const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const r2 = new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY });
const r2Endpoint = `https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}`;
const r2PublicBase = R2_PUBLIC_BASE_URL.replace(/\/$/, "");

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

async function d1Query(sql, params = []) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${CF_API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params }),
    }
  );
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(`D1 query failed: ${JSON.stringify(data.errors || data)}`);
  }
  return data.result?.[0]?.results ?? [];
}

async function migrateSections() {
  const { data, error } = await supabase.from("sections").select("id, name, sort_order, created_at");
  if (error) throw error;
  for (const row of data || []) {
    await d1Query(
      `INSERT INTO sections (id, name, sort_order, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET sort_order = excluded.sort_order`,
      [row.id, row.name, row.sort_order ?? 0, row.created_at || new Date().toISOString()]
    );
  }
  log(`Sections migrated: ${data?.length || 0}`);
}

async function migrateJobs() {
  const { data, error } = await supabase.from("jobs").select("id, name, created_at");
  if (error) throw error;
  for (const row of data || []) {
    await d1Query(
      `INSERT INTO jobs (id, name, created_at) VALUES (?, ?, ?) ON CONFLICT(name) DO NOTHING`,
      [row.id, row.name, row.created_at || new Date().toISOString()]
    );
  }
  log(`Jobs migrated: ${data?.length || 0}`);
}

function describeError(err) {
  // Node's fetch wraps network failures as a bare "fetch failed" with the real
  // reason in `.cause` — surface it so failures are actually diagnosable.
  const cause = err?.cause ? `: ${err.cause.code || err.cause.message || err.cause}` : "";
  return `${err.message}${cause}`;
}

async function withRetries(fn, { attempts = 3, delayMs = 500 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw lastErr;
}

async function uploadPhotoToR2(sourceUrl, key) {
  const buffer = await withRetries(async () => {
    const res = await fetch(sourceUrl);
    if (!res.ok) throw new Error(`Failed to download photo (${res.status}): ${sourceUrl}`);
    return res.arrayBuffer();
  });
  const putRes = await withRetries(() =>
    r2.fetch(`${r2Endpoint}/${key}`, {
      method: "PUT",
      body: buffer,
      headers: { "Content-Type": "image/jpeg" },
    })
  );
  if (!putRes.ok) throw new Error(`R2 upload failed for ${key}: ${putRes.status} ${await putRes.text()}`);
}

async function migrateProps() {
  const { data, error } = await supabase
    .from("props")
    .select("id, title, description, location, category, job, quantity, photo, length, width, code, created_at");
  if (error) throw error;

  const rows = data || [];
  const BATCH_SIZE = 10; // conservative concurrency — bursty parallel fetches to Supabase Storage were causing transient failures
  let migrated = 0;
  const failed = [];

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (row) => {
        try {
          let photoUrl = null;
          if (row.photo) {
            const extGuess = (row.photo.split(".").pop() || "jpg").split("?")[0].split("#")[0];
            const ext = /^[a-zA-Z0-9]{1,5}$/.test(extGuess) ? extGuess.toLowerCase() : "jpg";
            const key = `props/${row.id}.${ext}`;
            await uploadPhotoToR2(row.photo, key);
            photoUrl = `${r2PublicBase}/${key}`;
          }
          // New columns (color/condition/era_style/status/tags) are left at their D1
          // defaults for migrated rows — an editor fills them in later.
          await d1Query(
            `INSERT INTO props (id, title, description, location, category, job, quantity, photo, length, width, code, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
               title=excluded.title, description=excluded.description, location=excluded.location,
               category=excluded.category, job=excluded.job, quantity=excluded.quantity, photo=excluded.photo,
               length=excluded.length, width=excluded.width, code=excluded.code, updated_at=excluded.updated_at`,
            [
              row.id, row.title, row.description ?? null, row.location, row.category, row.job,
              row.quantity ?? 1, photoUrl, row.length ?? null, row.width ?? null, row.code ?? null,
              row.created_at || new Date().toISOString(), new Date().toISOString(),
            ]
          );
          migrated++;
          log(`Migrated prop ${row.id} (${row.title})`);
        } catch (err) {
          const message = describeError(err);
          failed.push({ id: row.id, error: message });
          log(`FAILED prop ${row.id}: ${message}`);
        }
      })
    );
  }

  log(`Props migration complete: ${migrated}/${rows.length} succeeded, ${failed.length} failed`);
  if (failed.length) {
    log("Failed prop IDs (rerun this script to retry):");
    for (const f of failed) log(`  ${f.id}: ${f.error}`);
  }
}

async function main() {
  log("Starting migration to Cloudflare (D1 + R2)...");
  await migrateSections();
  await migrateJobs();
  await migrateProps();
  log("Migration complete. Spot-check a few photo URLs and compare row counts before cutting over the frontend.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
