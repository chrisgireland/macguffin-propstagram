const SESSION_TTL_MS = 30 * 60 * 1000; // backstop only — the frontend clears its token after 10 min idle

/** Parse the LOGINS secret (username:passwordHash:role,...), same format as the old VITE_LOGINS. */
export function parseLogins(env) {
  const raw = env.LOGINS || "";
  const entries = [];
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const firstColon = part.indexOf(":");
    const lastColon = part.lastIndexOf(":");
    if (firstColon === -1 || lastColon === -1 || firstColon === lastColon) continue;
    const username = part.slice(0, firstColon).trim().toLowerCase();
    const hash = part.slice(firstColon + 1, lastColon).trim().toLowerCase();
    const role = part.slice(lastColon + 1).trim().toLowerCase();
    if (username && hash && (role === "client" || role === "editor")) {
      entries.push({ username, passwordHash: hash, role });
    }
  }
  return entries;
}

export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

function base64UrlEncode(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str) {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/").padEnd(str.length + ((4 - (str.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function createSessionToken(env, { username, role }) {
  const payload = JSON.stringify({ username, role, exp: Date.now() + SESSION_TTL_MS });
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(payload));
  const key = await hmacKey(env.SESSION_TOKEN_SECRET);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  return `${payloadB64}.${base64UrlEncode(new Uint8Array(sig))}`;
}

export async function verifySessionToken(env, token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const [payloadB64, sigB64] = token.split(".");
  const key = await hmacKey(env.SESSION_TOKEN_SECRET);
  const expectedSig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  if (base64UrlEncode(new Uint8Array(expectedSig)) !== sigB64) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function getBearerToken(request) {
  const header = request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}

/** Returns the token payload if the request carries a valid editor session, else null. */
export async function requireEditor(request, env) {
  const payload = await verifySessionToken(env, getBearerToken(request));
  if (!payload || payload.role !== "editor") return null;
  return payload;
}

/** Returns 'editor' | 'client' | null (no/invalid/expired token — treated as anonymous/guest). */
export async function getRequestRole(request, env) {
  const payload = await verifySessionToken(env, getBearerToken(request));
  return payload?.role === "editor" || payload?.role === "client" ? payload.role : null;
}
