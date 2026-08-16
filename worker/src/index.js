import { parseLogins, hashPassword, createSessionToken, requireEditor } from "./auth.js";
import { withCors, corsPreflight } from "./cors.js";

const CONDITIONS = ["Excellent", "Good", "Needs Repair", "Fragile"];
const STATUSES = ["In Stock", "Checked Out", "In Repair"];

function json(data, status = 200) {
  return withCors(
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
}

function errorResponse(message, status = 400) {
  return json({ error: message }, status);
}

async function readJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function listSimple(env, table, orderBy) {
  const { results } = await env.DB.prepare(`SELECT * FROM ${table} ORDER BY ${orderBy}`).all();
  return json(results);
}

/** Add-only editable list (sections, jobs, era_styles) — mirrors the app's existing "Add New X" pattern. */
async function addSimple(request, env, table, { hasSortOrder = false } = {}) {
  const auth = await requireEditor(request, env);
  if (!auth) return errorResponse("Unauthorized", 401);

  const body = await readJsonBody(request);
  const name = (body?.name || "").trim();
  if (!name) return errorResponse("name is required");

  const id = crypto.randomUUID();
  if (hasSortOrder) {
    const maxRow = await env.DB.prepare(`SELECT MAX(sort_order) as maxOrder FROM ${table}`).first();
    const nextOrder = (maxRow?.maxOrder ?? 0) + 1;
    await env.DB.prepare(
      `INSERT INTO ${table} (id, name, sort_order) VALUES (?, ?, ?) ON CONFLICT(name) DO NOTHING`
    )
      .bind(id, name, nextOrder)
      .run();
  } else {
    await env.DB.prepare(`INSERT INTO ${table} (id, name) VALUES (?, ?) ON CONFLICT(name) DO NOTHING`)
      .bind(id, name)
      .run();
  }
  const row = await env.DB.prepare(`SELECT * FROM ${table} WHERE name = ?`).bind(name).first();
  return json(row, 201);
}

function normalizePropPayload(body, existing = null) {
  const pick = (key, fallback) => (body[key] !== undefined ? body[key] : existing ? existing[key] : fallback);
  return {
    title: (pick("title", "") || "").toString().trim(),
    description: (pick("description", "") || "").toString().trim() || null,
    location: (pick("location", "") || "").toString().trim(),
    category: pick("category", null),
    job: (pick("job", "General Inventory") || "General Inventory").toString().trim() || "General Inventory",
    quantity: Math.max(1, Number(pick("quantity", 1)) || 1),
    photo: pick("photo", null) || null,
    length: (pick("length", "") || "").toString().trim() || null,
    width: (pick("width", "") || "").toString().trim() || null,
    code: (pick("code", "") || "").toString().trim() || null,
    color: pick("color", "[]") || "[]",
    condition: CONDITIONS.includes(pick("condition", null)) ? pick("condition", null) : null,
    era_style: (pick("era_style", "") || "").toString().trim() || null,
    status: STATUSES.includes(pick("status", null)) ? pick("status", null) : null,
    tags: pick("tags", "[]") || "[]",
  };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return corsPreflight();

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/api/auth-status" && request.method === "GET") {
        return json({ protected: parseLogins(env).length > 0 });
      }

      if (path === "/api/login" && request.method === "POST") {
        const body = await readJsonBody(request);
        const username = (body?.username || "").trim().toLowerCase();
        const password = body?.password || "";
        const match = parseLogins(env).find((l) => l.username === username);
        if (!match) return errorResponse("Wrong username or password", 401);
        const hash = await hashPassword(password);
        if (hash.toLowerCase() !== match.passwordHash) return errorResponse("Wrong username or password", 401);
        const token = await createSessionToken(env, { username: match.username, role: match.role });
        return json({ token, username: match.username, role: match.role });
      }

      if (path === "/api/props" && request.method === "GET") {
        const { results } = await env.DB.prepare("SELECT * FROM props ORDER BY created_at DESC").all();
        return json(results);
      }

      if (path === "/api/props" && request.method === "POST") {
        const auth = await requireEditor(request, env);
        if (!auth) return errorResponse("Unauthorized", 401);
        const body = await readJsonBody(request);
        if (!body) return errorResponse("Invalid body");
        const row = normalizePropPayload(body);
        if (!row.title || !row.location) return errorResponse("Title and location are required");

        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        await env.DB.prepare(
          `INSERT INTO props (id, title, description, location, category, job, quantity, photo, length, width, code, color, condition, era_style, status, tags, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            id, row.title, row.description, row.location, row.category, row.job, row.quantity, row.photo,
            row.length, row.width, row.code, row.color, row.condition, row.era_style, row.status, row.tags,
            now, now
          )
          .run();
        const created = await env.DB.prepare("SELECT * FROM props WHERE id = ?").bind(id).first();
        return json(created, 201);
      }

      const propMatch = path.match(/^\/api\/props\/([a-f0-9-]+)$/i);

      if (propMatch && request.method === "PATCH") {
        const auth = await requireEditor(request, env);
        if (!auth) return errorResponse("Unauthorized", 401);
        const id = propMatch[1];
        const existing = await env.DB.prepare("SELECT * FROM props WHERE id = ?").bind(id).first();
        if (!existing) return errorResponse("Not found", 404);
        const body = await readJsonBody(request);
        if (!body) return errorResponse("Invalid body");
        const row = normalizePropPayload(body, existing);
        if (!row.title || !row.location) return errorResponse("Title and location are required");

        const now = new Date().toISOString();
        await env.DB.prepare(
          `UPDATE props SET title=?, description=?, location=?, category=?, job=?, quantity=?, photo=?,
             length=?, width=?, code=?, color=?, condition=?, era_style=?, status=?, tags=?, updated_at=?
           WHERE id=?`
        )
          .bind(
            row.title, row.description, row.location, row.category, row.job, row.quantity, row.photo,
            row.length, row.width, row.code, row.color, row.condition, row.era_style, row.status, row.tags,
            now, id
          )
          .run();
        const updated = await env.DB.prepare("SELECT * FROM props WHERE id = ?").bind(id).first();
        return json(updated);
      }

      if (propMatch && request.method === "DELETE") {
        const auth = await requireEditor(request, env);
        if (!auth) return errorResponse("Unauthorized", 401);
        await env.DB.prepare("DELETE FROM props WHERE id = ?").bind(propMatch[1]).run();
        return json({ ok: true });
      }

      if (path === "/api/sections" && request.method === "GET") return listSimple(env, "sections", "sort_order");
      if (path === "/api/sections" && request.method === "POST")
        return addSimple(request, env, "sections", { hasSortOrder: true });

      if (path === "/api/jobs" && request.method === "GET") return listSimple(env, "jobs", "created_at");
      if (path === "/api/jobs" && request.method === "POST") return addSimple(request, env, "jobs");

      if (path === "/api/era-styles" && request.method === "GET") return listSimple(env, "era_styles", "sort_order");
      if (path === "/api/era-styles" && request.method === "POST")
        return addSimple(request, env, "era_styles", { hasSortOrder: true });

      if (path === "/api/photos" && request.method === "POST") {
        const auth = await requireEditor(request, env);
        if (!auth) return errorResponse("Unauthorized", 401);
        const formData = await request.formData().catch(() => null);
        const file = formData?.get("file");
        if (!file || typeof file === "string") return errorResponse("file is required");

        const ext = (file.name?.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
        const key = `props/${crypto.randomUUID()}.${ext}`;
        await env.PHOTOS.put(key, await file.arrayBuffer(), {
          httpMetadata: { contentType: file.type || "image/jpeg" },
        });
        const base = (env.PHOTOS_PUBLIC_BASE_URL || "").replace(/\/$/, "");
        return json({ url: `${base}/${key}` }, 201);
      }

      return errorResponse("Not found", 404);
    } catch (err) {
      return errorResponse(err?.message || "Internal error", 500);
    }
  },
};
