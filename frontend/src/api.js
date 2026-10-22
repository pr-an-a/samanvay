// Thin wrapper over fetch for the FastAPI backend (proxied at /api by Vite).

const BASE = "/api";
const TOKEN_KEY = "samanvay.token";
const USER_KEY = "samanvay.user";

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const session = {
  token: () => localStorage.getItem(TOKEN_KEY),
  user: () => JSON.parse(localStorage.getItem(USER_KEY) || "null"),
  save(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

function describe(detail) {
  if (!detail) return "Request failed";
  if (typeof detail === "string") return detail;
  // FastAPI validation errors: [{loc, msg}, ...]
  return detail.map((d) => `${d.loc?.slice(1).join(".")}: ${d.msg}`).join("; ");
}

export async function api(path, { method = "GET", body, raw = false } = {}) {
  const headers = {};
  if (session.token()) headers.Authorization = `Bearer ${session.token()}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (res.status === 401 && !path.startsWith("/auth/")) {
    session.clear();
    window.location.assign("/login");
    throw new ApiError(401, "Session expired");
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, describe(data.detail));
  }
  return raw ? res : res.json();
}

export function query(params) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.set(k, v);
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}
