const API_URL = import.meta.env.VITE_API_URL;

const TOKEN_KEY = "propstagram_token";
const ROLE_KEY = "propstagram_role";

export function isApiConfigured() {
  return !!API_URL;
}

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || "";
}

export function getStoredRole() {
  const role = sessionStorage.getItem(ROLE_KEY);
  return role === "client" ? "client" : "editor";
}

export function setSession(token, role) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(ROLE_KEY, role === "client" ? "client" : "editor");
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(ROLE_KEY);
}

export function hasSession() {
  return !!getToken();
}

/** Fired when a request that carried a session token comes back without the server
 *  recognizing that token as still valid — the session died (expiry, clock skew, a
 *  tab left open across a sleep/idle gap) even though the UI still thought it was
 *  logged in. Some routes (e.g. GET /api/props) don't 401 on a bad token, they just
 *  silently downgrade to guest-level data — without this, the UI would keep showing
 *  editor chrome while quietly rendering a filtered-down, guest's-eye view of the
 *  data. AppWithAuth listens for this to clear the stale state and bounce back to
 *  login instead of leaving that mismatch invisible. */
export const SESSION_EXPIRED_EVENT = "propstagram:session-expired";

async function request(path, { method = "GET", body, auth = false, isForm = false } = {}) {
  const headers = {};
  if (!isForm) headers["Content-Type"] = "application/json";
  let sentToken = "";
  if (auth) {
    sentToken = getToken();
    if (sentToken) headers["Authorization"] = `Bearer ${sentToken}`;
  }
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: isForm ? body : body != null ? JSON.stringify(body) : undefined,
  });

  // The worker renews and returns a still-valid token on every request that carried
  // one (sliding its expiry forward), regardless of that route's outcome. So a sent
  // token coming back without a renewal means the server didn't recognize it as
  // valid — the one reliable signal that our session actually died server-side.
  if (sentToken) {
    const renewedToken = res.headers.get("X-Session-Token");
    if (renewedToken) {
      setSession(renewedToken, getStoredRole());
    } else {
      clearSession();
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

function safeParseArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseProp(row) {
  if (!row) return row;
  return { ...row, color: safeParseArray(row.color), tags: safeParseArray(row.tags) };
}

function serializePropPayload(payload) {
  return {
    ...payload,
    color: JSON.stringify(payload.color || []),
    tags: JSON.stringify(payload.tags || []),
  };
}

export async function fetchAuthStatus() {
  return request("/api/auth-status");
}

export async function login(username, password) {
  return request("/api/login", { method: "POST", body: { username, password } });
}

export async function fetchProps() {
  // auth:true attaches a token when one exists (editor session) but doesn't require
  // one — the Worker decides what to return based on whatever role, if any, it sees.
  const rows = await request("/api/props", { auth: true });
  return (rows || []).map(parseProp);
}

export async function createProp(payload) {
  const row = await request("/api/props", { method: "POST", body: serializePropPayload(payload), auth: true });
  return parseProp(row);
}

export async function updateProp(id, payload) {
  const row = await request(`/api/props/${id}`, {
    method: "PATCH",
    body: serializePropPayload(payload),
    auth: true,
  });
  return parseProp(row);
}

export async function deleteProp(id) {
  return request(`/api/props/${id}`, { method: "DELETE", auth: true });
}

export async function fetchJobs() {
  const rows = await request("/api/jobs");
  return (rows || []).map((r) => r.name);
}

export async function addJob(name) {
  return request("/api/jobs", { method: "POST", body: { name }, auth: true });
}

export async function fetchSections() {
  const rows = await request("/api/sections");
  return (rows || []).map((r) => r.name);
}

export async function addSection(name) {
  return request("/api/sections", { method: "POST", body: { name }, auth: true });
}

export async function fetchEraStyles() {
  const rows = await request("/api/era-styles");
  return (rows || []).map((r) => r.name);
}

export async function addEraStyle(name) {
  return request("/api/era-styles", { method: "POST", body: { name }, auth: true });
}

export async function uploadPhoto(file) {
  const formData = new FormData();
  formData.append("file", file);
  const data = await request("/api/photos", { method: "POST", body: formData, auth: true, isForm: true });
  return data.url;
}

// Shared lists — open routes, no auth: guests can create/add to lists without logging in.
export async function createList(name) {
  return request("/api/lists", { method: "POST", body: { name } });
}

export async function fetchListsByIds(ids) {
  if (!ids?.length) return [];
  return request(`/api/lists?ids=${encodeURIComponent(ids.join(","))}`);
}

export async function fetchList(id) {
  const data = await request(`/api/lists/${id}`);
  return { ...data, props: (data.props || []).map(parseProp) };
}

export async function renameList(id, name) {
  return request(`/api/lists/${id}`, { method: "PATCH", body: { name } });
}

export async function deleteList(id) {
  return request(`/api/lists/${id}`, { method: "DELETE" });
}

export async function addPropToList(listId, propId) {
  return request(`/api/lists/${listId}/items`, { method: "POST", body: { prop_id: propId } });
}
