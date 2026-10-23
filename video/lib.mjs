// Shared helpers for the demo-video scripts. Free, local tools only (Playwright, Piper, ffmpeg).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, "..");
export const OUT = join(HERE, "out");
export const cfg = JSON.parse(readFileSync(join(HERE, "config.json"), "utf8"));
export const script = JSON.parse(readFileSync(join(HERE, "script.json"), "utf8"));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const ensureDir = (d) => (mkdirSync(d, { recursive: true }), d);
export const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
export const writeJson = (p, v) => (ensureDir(dirname(p)), writeFileSync(p, JSON.stringify(v, null, 2) + "\n"));

export async function api(path, token, body) {
  const res = await fetch(cfg.app.api + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}

/** Sign in as a demo role ("RB", "PGRC", "REGIONAL", "ADMIN"). Returns { token, user }. */
export async function login(role) {
  const users = await api("/auth/demo-users");
  const u = users.find((x) => (role === "ADMIN" ? x.role === "ADMIN" : x.bureau === role));
  if (!u) throw new Error(`no demo user for ${role}`);
  return api("/auth/login", null, { user_id: u.id });
}

/** Put the demo data back exactly as seeded (Administrator, demo mode): no restart needed. */
export async function reseed() {
  const { token } = await login("ADMIN");
  return api("/demo/reset", token, {});
}

export const DEMO_ASKING = "Register of original certificates held and the reason they are withheld";

/**
 * Every number the voiceover or the end card says, from the live app and the evaluation results.
 * Nothing here is typed in: change the data and the numbers (and the sentences) change with it.
 */
export async function computeNumbers() {
  const admin = await login("ADMIN");
  const pg = await login("PGRC");
  const script_ = await api("/demo/script", pg.token);
  const ww = await api("/demo/without-with", pg.token);
  const stress = await api("/demo/stress-test", pg.token);
  const check = await api(`/cases/${script_.action_case_pk}/actions/check`, pg.token, { kind: "seek_reply", asking_for: DEMO_ASKING });
  const results = readJson(join(ROOT, "eval", "results.json"));
  const b = results.baselines.seed42.all, u = results.baselines.unseen_seed43.all;
  const named = (pair) => [ww.rb.find((c) => c.pair === pair).college, ww.pgrc.find((c) => c.pair === pair).college];
  const nums = {
    ww: { pairs: ww.pairs.length, noid: ww.pairs.filter((p) => p.tier === "entity").length, names: Object.fromEntries(ww.pairs.map((p) => [p.key, named(p.key)])) },
    check: { days: check.clashes[0]?.other.days_ago, type: check.clashes[0]?.type, count: check.clashes.length },
    stress: { total: stress.totals.total, samanvay: stress.totals.samanvay, exact: stress.totals.exact_name, id: stress.totals.id_only, misses: stress.totals.total - stress.totals.samanvay,
              missed: stress.variants.filter((v) => !v.samanvay).map((v) => v.name) },
    base: { overlaps: b.overlaps, id: b.methods.id_only.found, exact: b.methods.exact_name.found, exact_wrong: b.methods.exact_name.false_positives,
            samanvay: b.methods.samanvay.found, samanvay_wrong: b.methods.samanvay.false_positives, pairs: b.non_overlap_pairs },
    seed43: { overlaps: u.overlaps, found: u.methods.samanvay.found, wrong: u.methods.samanvay.false_positives,
              summary_tp: results.unseen_seed43.tp, summary_fn: results.unseen_seed43.fn },
    ids: { action_case_pk: script_.action_case_pk, institution_id: script_.institution_id, link_id: script_.link_id },
    admin_token_user: admin.user.name,
  };
  // Sanity: what we are about to claim must be true.
  if (nums.ww.pairs !== 3 || Object.values(nums.ww.names).some(([a, c]) => a === c)) throw new Error("Without/With pairs: expected 3 pairs, each with differently spelt names");
  if (nums.check.type !== "duplicate_effort" || typeof nums.check.days !== "number") throw new Error("pre-action check did not find the seeded duplicate effort");
  if (nums.seed43.found !== nums.seed43.summary_tp || nums.seed43.found + nums.seed43.summary_fn !== nums.seed43.overlaps) throw new Error("seed-43 numbers disagree between baselines and summary");
  return nums;
}

/** {a.b} placeholders -> values from numbers. */
export function fill(text, nums) {
  return text.replace(/\{([\w.]+)\}/g, (_, key) => {
    const v = key.split(".").reduce((o, k) => o?.[k], nums);
    if (v === undefined || v === null) throw new Error(`unknown number {${key}}`);
    return String(v);
  });
}

export function ffprobeDuration(file) {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8" });
  return parseFloat(r.stdout);
}

export function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 28, ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.slice(0, 6).join(" ")} ... failed:\n${(r.stderr || "").slice(-1500)}`);
  return r;
}

export const exists = existsSync;
