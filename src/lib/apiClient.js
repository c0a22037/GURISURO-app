// src/lib/apiClient.js
const BASE = "/api";

export async function apiFetch(path, { method = "GET", params = null, body = null, headers = {} } = {}) {
  // path は "login" や "fairness" のように先頭スラなしで渡す
  const url = new URL(`${BASE}/${path}`, window.location.origin);
  if (params && typeof params === "object") {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  }
  const res = await fetch(url.toString(), {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch {}
  return { ok: res.ok, status: res.status, data, text, url: url.toString() };
}