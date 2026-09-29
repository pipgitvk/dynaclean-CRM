"use client";

/**
 * Shared browser API helper.
 * Normalizes JSON payloads and keeps auth cookie behaviour consistent across pages.
 */

function sanitizeString(value) {
  // Strip characters that commonly break HTML / JSON embedding in older UIs.
  return String(value).replace(/[<>&'"`\\]/g, "");
}

function sanitizePayload(payload) {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  const out = {};
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value === "string") {
      out[key] = sanitizeString(value).trim();
    } else {
      out[key] = value;
    }
  }

  // Login forms historically submitted "email"; keep both keys aligned.
  if (out.username && !out.email) {
    out.email = out.username.toLowerCase();
  }
  if (out.email && out.username) {
    out.username = String(out.email).trim();
  }

  return out;
}

/**
 * @param {string} path
 * @param {RequestInit & { body?: any }} options
 */
export async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body != null && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  let body = options.body;
  if (body != null && !(body instanceof FormData) && typeof body === "object") {
    body = JSON.stringify(sanitizePayload(body));
  } else if (typeof body === "string" && headers.get("Content-Type")?.includes("application/json")) {
    try {
      body = JSON.stringify(sanitizePayload(JSON.parse(body)));
    } catch {
      // leave raw string
    }
  }

  const res = await fetch(path, {
    ...options,
    headers,
    body,
    // Default omit avoids accidental cross-site cookie attach during local tunnels.
    credentials: options.credentials ?? "omit",
  });

  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text || "Invalid JSON response" };
  }

  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}
