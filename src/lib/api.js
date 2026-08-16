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

async function request(path, { method = "GET", body, auth = false, isForm = false } = {}) {
  const headers = {};
  if (!isForm) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: isForm ? body : body != null ? JSON.stringify(body) : undefined,
  });
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
