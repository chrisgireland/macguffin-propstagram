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

      // Shared lists are open (no auth) on every route — guests can create and
      // add to lists without logging in, matching the old Supabase public-insert
      // policy these tables had.
      if (path === "/api/lists" && request.method === "GET") {
        const idsParam = url.searchParams.get("ids") || "";
        const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
        if (!ids.length) return json([]);
        const placeholders = ids.map(() => "?").join(",");
        const { results: lists } = await env.DB.prepare(
          `SELECT id, name, created_at FROM shared_lists WHERE id IN (${placeholders})`
        ).bind(...ids).all();
        if (!lists.length) return json([]);
        const { results: items } = await env.DB.prepare(
          `SELECT sli.list_id, p.title FROM shared_list_items sli
           JOIN props p ON p.id = sli.prop_id
           WHERE sli.list_id IN (${placeholders})
           ORDER BY sli.sort_order, sli.rowid`
        ).bind(...ids).all();
        const titlesByList = new Map();
        for (const row of items) {
          if (!titlesByList.has(row.list_id)) titlesByList.set(row.list_id, []);
          titlesByList.get(row.list_id).push(row.title || "Untitled");
        }
        return json(lists.map((l) => ({ ...l, propTitles: titlesByList.get(l.id) || [] })));
      }

      if (path === "/api/lists" && request.method === "POST") {
        const body = await readJsonBody(request);
        const id = crypto.randomUUID();
        const name = (body?.name || "").trim() || null;
        const now = new Date().toISOString();
        await env.DB.prepare("INSERT INTO shared_lists (id, name, created_at) VALUES (?, ?, ?)")
          .bind(id, name, now)
          .run();
        return json({ id, name, created_at: now }, 201);
      }

      const listMatch = path.match(/^\/api\/lists\/([a-f0-9-]+)$/i);
      const listItemsMatch = path.match(/^\/api\/lists\/([a-f0-9-]+)\/items$/i);
      const listItemMatch = path.match(/^\/api\/lists\/([a-f0-9-]+)\/items\/([a-f0-9-]+)$/i);

      if (listMatch && request.method === "GET") {
        const id = listMatch[1];
        const list = await env.DB.prepare("SELECT id, name, created_at FROM shared_lists WHERE id = ?").bind(id).first();
        if (!list) return errorResponse("Not found", 404);
        const { results: props } = await env.DB.prepare(
          `SELECT p.* FROM shared_list_items sli
           JOIN props p ON p.id = sli.prop_id
           WHERE sli.list_id = ?
           ORDER BY sli.sort_order, sli.rowid`
        ).bind(id).all();
        return json({ ...list, props });
      }

      if (listMatch && request.method === "PATCH") {
        const id = listMatch[1];
        const existing = await env.DB.prepare("SELECT id FROM shared_lists WHERE id = ?").bind(id).first();
        if (!existing) return errorResponse("Not found", 404);
        const body = await readJsonBody(request);
        const name = (body?.name || "").trim() || null;
        await env.DB.prepare("UPDATE shared_lists SET name = ? WHERE id = ?").bind(name, id).run();
        return json({ id, name });
      }

      if (listMatch && request.method === "DELETE") {
        const id = listMatch[1];
        await env.DB.prepare("DELETE FROM shared_list_items WHERE list_id = ?").bind(id).run();
        await env.DB.prepare("DELETE FROM shared_lists WHERE id = ?").bind(id).run();
        return json({ ok: true });
      }

      if (listItemsMatch && request.method === "POST") {
        const listId = listItemsMatch[1];
        const list = await env.DB.prepare("SELECT id FROM shared_lists WHERE id = ?").bind(listId).first();
        if (!list) return errorResponse("List not found", 404);
        const body = await readJsonBody(request);
        const propId = body?.prop_id;
        if (!propId) return errorResponse("prop_id is required");
        const prop = await env.DB.prepare("SELECT id FROM props WHERE id = ?").bind(propId).first();
        if (!prop) return errorResponse("Prop not found", 404);
        const maxRow = await env.DB.prepare(
          "SELECT MAX(sort_order) as maxOrder FROM shared_list_items WHERE list_id = ?"
        ).bind(listId).first();
        const nextOrder = (maxRow?.maxOrder ?? -1) + 1;
        await env.DB.prepare(
          `INSERT INTO shared_list_items (list_id, prop_id, sort_order) VALUES (?, ?, ?)
           ON CONFLICT(list_id, prop_id) DO NOTHING`
        ).bind(listId, propId, nextOrder).run();
        return json({ ok: true }, 201);
      }

      if (listItemMatch && request.method === "DELETE") {
        const [, listId, propId] = listItemMatch;
        await env.DB.prepare("DELETE FROM shared_list_items WHERE list_id = ? AND prop_id = ?")
          .bind(listId, propId)
          .run();
        return json({ ok: true });
      }

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
