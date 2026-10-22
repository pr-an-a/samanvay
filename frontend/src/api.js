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

const SESSION_ENDED = "Your sign-in has expired and could not be renewed.";

function describe(detail) {
  if (!detail) return "Request failed";
  if (typeof detail === "string") return detail;
  // FastAPI validation errors: [{loc, msg}, ...]
  return detail.map((d) => `${d.loc?.slice(1).join(".")}: ${d.msg}`).join("; ");
}

function send(path, method, body) {
  const headers = {};
  if (session.token()) headers.Authorization = `Bearer ${session.token()}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

// Demo users have no passwords, so an expired token (e.g. after the database was reseeded) can be
// renewed silently by signing in again as the same demo role. Concurrent 401s share one attempt.
let renewing = null;
async function renewSession() {
  const previous = session.user();
  if (!previous) return false;
  renewing ??= (async () => {
    try {
      const users = await (await fetch(`${BASE}/auth/demo-users`)).json();
      const same = users.find((u) => u.role === previous.role && u.bureau === previous.bureau);
      if (!same) return false;
      const res = await fetch(`${BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: same.id }),
      });
      if (!res.ok) return false;
      const { token, user } = await res.json();
      session.save(token, user);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (renewing = null), 0);
    }
  })();
  return renewing;
}

export async function api(path, { method = "GET", body, raw = false } = {}) {
  let res = await send(path, method, body);
  // A 401 is rejected before the backend does any work, so retrying once is safe, even for POST.
  if (res.status === 401 && !path.startsWith("/auth/") && (await renewSession())) {
    res = await send(path, method, body);
  }
  if (res.status === 401 && !path.startsWith("/auth/")) {
    throw new ApiError(401, `${SESSION_ENDED}${method === "GET" ? "" : " Nothing was saved."} Please sign in again.`);
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
