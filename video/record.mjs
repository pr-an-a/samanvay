// Records the demo video section by section (one clip each) at 1920x1080 with Playwright, driving the real app in video mode.
//
//   node record.mjs                 record every section (data must already be reseeded: build.mjs does that first)
//   node record.mjs --only stress   record just one or more sections (comma-separated ids)
//
// Each sentence of the voiceover is a "beat": the action runs while the sentence is spoken, except "gated" beats (the ones that
// say a number) which first wait until the matching text is on screen. The start time of every sentence is logged so assemble.mjs can
// place its audio exactly there. Nothing here plays audio, so speech can never run past the visuals.
import { chromium } from "playwright";
import { rmSync, renameSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { cfg, script, sleep, ensureDir, readJson, writeJson, login, fill, ffprobeDuration, OUT, DEMO_ASKING } from "./lib.mjs";

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : null;
const nums = readJson(join(OUT, "numbers.json"));
const durs = readJson(join(OUT, "audio", "durations.json"));
const ZOOM = cfg.capture.page_zoom;
const BASE = cfg.app.base_url;
const report = { sections: {}, visibility: [], proofs: [], console: [], flags: [] };

// ---------- in-page: seeded sign-in/tour state, zoom, visible cursor with a click ripple ----------
const INIT = ({ seed, zoom }) => {
  const applyZoom = () => document.documentElement && (document.documentElement.style.zoom = String(zoom));
  applyZoom();
  document.addEventListener("readystatechange", applyZoom);
  addEventListener("DOMContentLoaded", applyZoom);
  if (!sessionStorage.getItem("__seeded")) {
    sessionStorage.setItem("__seeded", "1");
    sessionStorage.setItem("samanvay.video", "1");
    if (seed.token) {
      localStorage.setItem("samanvay.token", seed.token);
      localStorage.setItem("samanvay.user", JSON.stringify(seed.user));
    } else {
      localStorage.removeItem("samanvay.token");
      localStorage.removeItem("samanvay.user");
    }
    if (seed.tour) sessionStorage.setItem("samanvay.tour", JSON.stringify(seed.tour));
  }
  const make = () => {
    const css = document.createElement("style");
    css.textContent = `#__cur{position:fixed;left:-50px;top:-50px;z-index:2147483647;pointer-events:none;width:28px;height:28px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))}
      .__rip{position:fixed;z-index:2147483646;pointer-events:none;border-radius:50%;border:3px solid rgba(232,150,122,.95);width:16px;height:16px;transform:translate(-50%,-50%) scale(.3);opacity:.95;animation:__rip .55s ease-out forwards}
      @keyframes __rip{to{transform:translate(-50%,-50%) scale(3.4);opacity:0}}`;
    document.documentElement.appendChild(css);
    const cur = document.createElement("div");
    cur.id = "__cur";
    cur.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28"><path d="M4 2l15 9.5-6.5 1.5L9.5 20z" fill="#fff" stroke="#2e2a25" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(cur);
    addEventListener("mousemove", (e) => { cur.style.left = e.clientX / zoom - 4 + "px"; cur.style.top = e.clientY / zoom - 3 + "px"; }, true);
    addEventListener("mousedown", (e) => {
      const r = document.createElement("div");
      r.className = "__rip";
      r.style.left = e.clientX / zoom + "px";
      r.style.top = e.clientY / zoom + "px";
      document.documentElement.appendChild(r);
      setTimeout(() => r.remove(), 650);
    }, true);
  };
  document.readyState === "loading" ? addEventListener("DOMContentLoaded", make) : make();
};

// ---------- human-ish helpers ----------
const rand = (a, b) => a + Math.random() * (b - a);
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

async function glide(h, x, y, ms = 650) {
  const { page, st } = h;
  const steps = Math.max(14, Math.round(ms / 18));
  const [x0, y0] = [st.x, st.y];
  for (let i = 1; i <= steps; i++) {
    const e = ease(i / steps);
    await page.mouse.move(x0 + (x - x0) * e, y0 + (y - y0) * e + Math.sin(i / steps * Math.PI) * 6);
    await sleep(ms / steps);
  }
  [st.x, st.y] = [x, y];
}
async function center(loc) {
  await loc.first().waitFor({ state: "visible", timeout: 15000 });
  let b = await loc.first().boundingBox();
  const limit = await loc.first().evaluate(() => { const bar = document.querySelector("[role=status][aria-live]"); return (bar ? bar.getBoundingClientRect().top : innerHeight) - 30; });
  if (b.y < 70 || b.y + b.height > limit) { // never click what is scrolled away or under the caption bar
    await loc.first().evaluate((el) => el.scrollIntoView({ block: "center", behavior: "smooth" }));
    await sleep(700);
    b = await loc.first().boundingBox();
  }
  return [b.x + b.width / 2, b.y + b.height / 2];
}
async function pointAt(h, loc, ms) { const [x, y] = await center(loc); await glide(h, x, y, ms); }
async function click(h, loc) {
  await pointAt(h, loc);
  await sleep(rand(180, 300));
  await h.page.mouse.down(); await sleep(70); await h.page.mouse.up();
  await sleep(150);
}
async function typeHuman(h, loc, text) {
  await click(h, loc);
  const [lo, hi] = cfg.pacing.typing_ms_per_char;
  for (const ch of text) { await h.page.keyboard.type(ch); await sleep(rand(lo, hi)); }
}
const btn = (h, name) => h.page.getByRole("button", { name }).first();
const lnk = (h, name) => h.page.getByRole("link", { name }).first();
const bodyText = (h) => h.page.evaluate(() => document.body.innerText);

/** Wait until the screen shows what the voiceover is about to say. A mismatch stops the run: the numbers must match. */
async function prove(h, label, fn, arg, timeout = 15000) {
  try {
    await h.page.waitForFunction(fn, arg, { timeout });
  } catch {
    report.proofs.push({ section: h.sec, label, ok: false });
    throw new Error(`[${h.sec}] on-screen proof failed: ${label}`);
  }
  report.proofs.push({ section: h.sec, label, ok: true });
}
const hasText = (h, label, ...needles) => prove(h, label, (n) => n.every((s) => document.body.innerText.includes(s)), needles);

/** Scroll an element fully into view (clear of the caption bar) and record whether it really fits. */
async function reveal(h, selectorOrLocator, label, settle = 900) {
  await sleep(settle); // the app's own highlight scroll has finished
  const loc = typeof selectorOrLocator === "string" ? h.page.locator(selectorOrLocator).first() : selectorOrLocator.first();
  await loc.waitFor({ state: "attached", timeout: 15000 });
  const measure = () => loc.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const bar = document.querySelector("[role=status][aria-live]");
    const limit = bar ? bar.getBoundingClientRect().top : innerHeight;
    return { top: r.top, bottom: r.bottom, h: r.height, limit, left: r.left, right: r.right, vw: innerWidth };
  });
  let m = await measure();
  if (m.top < 0 || m.bottom > m.limit) {
    await loc.evaluate((el, big) => { el.scrollIntoView({ block: big ? "start" : "center", behavior: "smooth" }); }, m.h > m.limit * 0.6);
    await sleep(900);
    m = await measure();
  }
  const fits = m.top >= -1 && m.bottom <= m.limit + 1 && m.left >= -1 && m.right <= m.vw + 1;
  report.visibility.push({ section: h.sec, label, fits, top: Math.round(m.top), bottom: Math.round(m.bottom), available: Math.round(m.limit) });
  if (!fits) report.flags.push(`${h.sec}: "${label}" is not fully in view (${Math.round(m.h)}px tall, ${Math.round(m.limit)}px available)`);
}
const spaGo = (h, url) => h.page.evaluate((u) => { history.pushState({}, "", u); dispatchEvent(new PopStateEvent("popstate")); }, url);
const highlight = (h, loc) => loc.evaluate((el) => { document.querySelectorAll(".video-highlight[data-hl]").forEach((e) => { e.classList.remove("video-highlight"); e.removeAttribute("data-hl"); }); el.classList.add("video-highlight"); el.setAttribute("data-hl", "1"); });

// ---------- the sections ----------
const tourAt = (step, extra = {}) => ({ active: true, step, timelineUrl: null, ...extra });
const RB_AFTER_NOTE = { otherBureau: "RB", switchedTo: "RB" };
const caseUrl = `/cases/${nums.ids.action_case_pk}`;

async function fillCheckForm(h, human) {
  const card = h.page.locator('[data-tour-target="new-action"]');
  await card.locator("select").first().selectOption({ label: "Seek reply from institution" });
  if (human) await typeHuman(h, card.locator("input").first(), DEMO_ASKING);
  else await card.locator("input").first().fill(DEMO_ASKING);
}

const DEFS = {
  story: {
    role: null, tour: null,
    setup: async (h) => { await h.page.goto(`${BASE}/story?manual=1`); await h.page.waitForSelector("text=Illustrative scenario"); await h.page.mouse.move(h.st.x, h.st.y); },
    beats: [
      { act: async (h) => { await sleep(300); await h.page.keyboard.press("ArrowRight"); } },
      {},
      { act: async (h) => { await h.page.keyboard.press("ArrowRight"); } },
      { act: async (h) => { await h.page.keyboard.press("ArrowRight"); } },
      { act: async (h) => { await h.page.keyboard.press("ArrowRight"); }, hold: 2.2 },
    ],
  },
  without_with: {
    role: "PGRC", tour: tourAt(1),
    setup: async (h) => { await h.page.goto(`${BASE}/without-with`); await h.page.waitForSelector("text=Without Samanvay"); await h.page.mouse.move(h.st.x, h.st.y); },
    beats: [
      { act: async (h) => { await reveal(h, '[data-tour-target="inboxes"]', "the two inboxes"); }, hold: 0.8 },
      { act: async (h) => { await click(h, btn(h, /Turn on Samanvay/)); await sleep(1200); } },
      { gate: true, hold: cfg.pacing.important_hold_seconds,
        act: async (h) => { await sleep(300); },
        proof: async (h) => {
          await prove(h, `${nums.ww.pairs} connector lines drawn`, (n) => document.querySelectorAll("path.connector-line").length === n, nums.ww.pairs);
          const noid = await h.page.getByText("Matched without AICTE ID", { exact: true }).count();
          const same = await h.page.getByText("Same AICTE ID", { exact: true }).count();
          if (noid !== nums.ww.noid || noid + same !== nums.ww.pairs) throw new Error(`[without_with] labels on screen: ${noid} without ID + ${same} with ID; voiceover says ${nums.ww.noid} of ${nums.ww.pairs}`);
          report.proofs.push({ section: h.sec, label: `${nums.ww.pairs} matches, ${nums.ww.noid} without an AICTE ID (counted on screen)`, ok: true });
          await reveal(h, '[data-tour-target="inboxes"]', "the three matches", 300);
        } },
    ],
  },
  check: {
    role: "PGRC", tour: tourAt(2),
    setup: async (h) => { await h.page.goto(`${BASE}${caseUrl}`); await h.page.waitForSelector('[data-tour-target="new-action"]'); await h.page.mouse.move(h.st.x, h.st.y); },
    beats: [
      { act: async (h) => { await reveal(h, '[data-tour-target="new-action"]', "New action form"); }, hold: 0.6 },
      { act: async (h) => { await fillCheckForm(h, true); }, hold: 0.6 },
      { gate: true, act: async (h) => { await click(h, btn(h, /Check and send/)); }, proof: (h) => hasText(h, "official alert wording on screen", "Potential Overlapping Cases – Coordination Required"), hold: 0.6 },
      { gate: true, hold: cfg.pacing.important_hold_seconds + 0.8,
        proof: async (h) => { await hasText(h, `"${nums.check.days} days ago" in the check panel`, `${nums.check.days} days ago`); await reveal(h, '[data-tour-target="check-panel"]', "the check panel", 400); } },
    ],
  },
  coordinate: {
    role: "PGRC", tour: tourAt(2),
    setup: async (h) => {
      await h.page.goto(`${BASE}${caseUrl}`); await h.page.waitForSelector('[data-tour-target="new-action"]');
      await h.page.mouse.move(h.st.x, h.st.y); await fillCheckForm(h, false);
      await btn(h, /Check and send/).click(); await h.page.waitForSelector('[data-tour-target="check-panel"]'); await sleep(900);
    },
    beats: [
      { act: async (h) => { await click(h, btn(h, /Coordinate with/)); await sleep(500); }, hold: 0.4 },
      { act: async (h) => { await sleep(1800); await click(h, btn(h, /Send note/)); await prove(h, "note sent message", () => document.body.innerText.includes("bell has rung")); await sleep(1500); await click(h, btn(h, /^Close$/)); }, hold: 0.3 },
      { act: async (h) => {
          await click(h, btn(h, /Show the Regulation Bureau/));
          await prove(h, "inbox shows the note waiting", () => document.body.innerText.includes("waiting for a reply"));
          await sleep(1200); await click(h, h.page.locator('button[aria-label^="Alerts"]'));
          await prove(h, "bell shows the note", () => document.body.innerText.includes("Grievance Cell left a note on"));
          await sleep(1800); await h.page.keyboard.press("Escape"); await sleep(400);
        }, hold: 1.0 },
    ],
  },
  timeline: {
    role: "RB", tour: tourAt(5, RB_AFTER_NOTE),
    setup: async (h) => { await h.page.goto(`${BASE}/`); await h.page.waitForSelector('[data-tour-target="inbox-list"]'); await h.page.mouse.move(h.st.x, h.st.y); },
    beats: [
      { act: async (h) => { await click(h, btn(h, /Next: the merged timeline/)); await h.page.waitForSelector('[data-tour-target="timeline"]'); await reveal(h, '[data-tour-target="timeline"]', "the shared timeline", 1600); } },
      { act: async (h) => { await sleep(2200); await pointAt(h, h.page.getByText(/Threads join/).first(), 900); }, hold: 1.2 },
    ],
  },
  reports: {
    role: "RB", tour: tourAt(6, RB_AFTER_NOTE),
    setup: async (h) => { await h.page.goto(`${BASE}/institutions/${nums.ids.institution_id}`); await h.page.waitForSelector('[data-tour-target="timeline"]'); await h.page.mouse.move(h.st.x, h.st.y); },
    beats: [
      { act: async (h) => {
          await click(h, btn(h, /Next: reports/)); await h.page.waitForSelector('[data-tour-target="reports-kpis"]');
          await reveal(h, '[data-tour-target="reports-kpis"]', "KPI tiles", 500); await sleep(1400);
          await pointAt(h, h.page.locator(".recharts-wrapper").first(), 900); await sleep(1500);
          await pointAt(h, h.page.getByText("Open cases by bureau").first(), 900); await sleep(2200);
          report.proofs.push({ section: h.sec, label: "KPI tiles, bureau-wise open vs overdue and ageing chart all on screen", ok: true });
        }, hold: 0.8 },
    ],
  },
  stress: {
    role: "RB", tour: tourAt(7, RB_AFTER_NOTE),
    setup: async (h) => { await h.page.goto(`${BASE}/reports`); await h.page.waitForSelector('[data-tour-target="reports-kpis"]'); await h.page.mouse.move(h.st.x, h.st.y); },
    beats: [
      { act: async (h) => { await click(h, btn(h, /Next: stress test/)); await h.page.waitForSelector('[data-tour-target="stress-table"]'); await reveal(h, '[data-tour-target="stress-table"]', "stress-test table", 700); } },
      { act: async (h) => { await click(h, btn(h, /^Run$/)); },
        proof: (h) => prove(h, `${nums.stress.total} variants listed`, (n) => document.querySelectorAll('[data-tour-target="stress-table"] tbody tr').length === n, nums.stress.total) },
      { gate: true, hold: cfg.pacing.important_hold_seconds,
        act: async (h) => { await h.page.getByText("Final score").first().waitFor({ timeout: 20000 }); await reveal(h, '[data-tour-target="stress-table"]', "stress-test table with final score", 500); },
        proof: (h) => hasText(h, `score line ${nums.stress.samanvay}/${nums.stress.total} · ${nums.stress.exact}/${nums.stress.total} · ${nums.stress.id}/${nums.stress.total}`,
          `Samanvay ${nums.stress.samanvay}/${nums.stress.total} · Exact name ${nums.stress.exact}/${nums.stress.total} · ID-only ${nums.stress.id}/${nums.stress.total}`) },
      { gate: true, hold: cfg.pacing.important_hold_seconds,
        act: async (h) => { await reveal(h, h.page.locator("section", { has: h.page.getByText(/Where Samanvay missed/) }), "the misses card", 500); },
        proof: (h) => hasText(h, `"Where Samanvay missed (${nums.stress.misses} of ${nums.stress.total})"`, `Where Samanvay missed (${nums.stress.misses} of ${nums.stress.total})`) },
    ],
  },
  baselines: {
    role: "RB", tour: tourAt(8, RB_AFTER_NOTE),
    setup: async (h) => { await h.page.goto(`${BASE}/stress`); await h.page.waitForSelector('[data-tour-target="stress-table"]'); await h.page.mouse.move(h.st.x, h.st.y); },
    beats: [
      { gate: true, act: async (h) => { await click(h, btn(h, /Next: simpler methods/)); await h.page.waitForSelector('[data-tour-target="baseline"]'); await reveal(h, '[data-tour-target="baseline"]', "baseline bars", 600); },
        proof: async (h) => {
          const want = [nums.base.id, nums.base.exact, nums.base.samanvay].map((f) => f / nums.base.overlaps);
          await prove(h, `bars grown to ${want.map((w) => Math.round(w * 100)).join("/")}% of ${nums.base.overlaps}`, (w) => {
            const bars = [...document.querySelectorAll(".bar-grow")];
            return bars.length === 3 && bars.every((b, i) => Math.abs(b.getBoundingClientRect().width / b.parentElement.getBoundingClientRect().width - w[i]) < 0.01);
          }, want, 8000);
          await hasText(h, `"Found ${nums.base.id} of ${nums.base.overlaps}"`, `Found ${nums.base.id} of ${nums.base.overlaps}`);
        } },
      { gate: true, proof: (h) => hasText(h, `"Found ${nums.base.exact} of ${nums.base.overlaps} · ${nums.base.exact_wrong} wrong matches"`, `Found ${nums.base.exact} of ${nums.base.overlaps}`, `${nums.base.exact_wrong} wrong matches`) },
      { gate: true, hold: cfg.pacing.important_hold_seconds, proof: (h) => hasText(h, `"Found ${nums.base.samanvay} of ${nums.base.overlaps} · ${nums.base.samanvay_wrong} wrong matches"`, `Found ${nums.base.samanvay} of ${nums.base.overlaps}`, `${nums.base.samanvay_wrong} wrong matches`) },
      { gate: true, hold: cfg.pacing.important_hold_seconds,
        act: async (h) => { await reveal(h, '[data-testid="second-dataset"]', "second-dataset line", 300); await highlight(h, h.page.locator('[data-testid="second-dataset"]')); },
        proof: async (h) => { await hasText(h, `second dataset: found ${nums.seed43.found} of ${nums.seed43.overlaps}, ${nums.seed43.wrong} wrong`, `found ${nums.seed43.found} of ${nums.seed43.overlaps} with ${nums.seed43.wrong} wrong match`); } },
      { act: async (h) => { await reveal(h, '[data-testid="caveat"]', "synthetic-data caveat", 200); await highlight(h, h.page.locator('[data-testid="caveat"]')); }, hold: 1.2 },
    ],
  },
  how: {
    role: "RB", tour: tourAt(9, RB_AFTER_NOTE),
    setup: async (h) => { await h.page.goto(`${BASE}/accuracy`); await h.page.waitForSelector('[data-tour-target="baseline"]'); await h.page.mouse.move(h.st.x, h.st.y); },
    beats: [
      { act: async (h) => { await click(h, btn(h, /Next: how it works/)); await h.page.waitForSelector('[data-tour-target="how-steps"]'); await reveal(h, '[data-tour-target="how-steps"]', "the thread diagram", 600); } },
      ...[0, 1, 2, 3].map((i) => ({ act: async (h) => { const card = h.page.locator("ol > li").nth(i); await highlight(h, card); await pointAt(h, card, 700); await reveal(h, card, `technique card ${i + 1}`, 100); }, hold: 0.4 })),
      { act: async (h) => { const c = h.page.locator("section.moment").last(); await highlight(h, c); await reveal(h, c, "explainable, no black-box AI card", 100); await pointAt(h, c, 700); }, hold: 1.2 },
    ],
  },
  inbox: {
    role: "RB", tour: tourAt(10, RB_AFTER_NOTE),
    setup: async (h) => { await h.page.goto(`${BASE}/how-it-works`); await h.page.waitForSelector('[data-tour-target="how-steps"]'); await h.page.mouse.move(h.st.x, h.st.y); },
    beats: [
      { act: async (h) => {
          await click(h, btn(h, /Next: inbox and deadlines/)); await h.page.waitForSelector('[data-tour-target="inbox-list"]');
          await reveal(h, h.page.locator('[data-tour-target="inbox-list"] > ul > li').nth(2), "the first rows of the inbox", 700);
          await hasText(h, "inbox shows waiting note and prevented clash", "Waiting for your reply", "Clash prevented");
          await pointAt(h, h.page.locator('[data-tour-target="inbox-list"] li').first(), 900);
        }, hold: 0.6 },
      { act: async (h) => {
          await spaGo(h, caseUrl); await h.page.waitForSelector("text=Complainant");
          const field = h.page.locator("div:has(> dt:text-is('Complainant'))").first();
          await reveal(h, field, "hidden complainant name", 700); await highlight(h, field); await pointAt(h, field, 800);
        },
        proof: (h) => hasText(h, "complainant hidden from the other bureau", "A*** R***", "hidden: another bureau") , hold: 1.0 },
      { act: async (h) => {
          await click(h, btn(h, /Sign in as Administrator/)); await h.page.waitForSelector('[data-tour-target="inbox-list"]'); await sleep(800);
          await click(h, h.page.locator('button[aria-label^="Alerts"]'));
          await click(h, btn(h, /Run check now/)); await prove(h, "SLA check result shown", () => document.body.innerText.includes("Checked "), null, 20000);
          await sleep(1800);
        }, hold: 0.8 },
    ],
  },
  close: {
    role: "ADMIN", tour: tourAt(11, { otherBureau: "RB", switchedTo: "ADMIN" }),
    setup: async (h) => { await h.page.goto(`${BASE}/`); await h.page.waitForSelector('[data-tour-target="inbox-list"]'); await h.page.mouse.move(h.st.x, h.st.y); },
    beats: [
      { act: async (h) => { await click(h, btn(h, /Next: close/)); await sleep(500); }, hold: 2.4 },
    ],
  },
};

// ---------- run ----------
async function recordSection(browser, sec) {
  const def = DEFS[sec.id];
  if (!def) throw new Error(`no definition for section ${sec.id}`);
  const dir = ensureDir(join(OUT, "clips", sec.id));
  for (const f of readdirSync(dir)) rmSync(join(dir, f));
  const auth = def.role ? await login(def.role) : { token: null, user: null };
  const ctx = await browser.newContext({ viewport: { width: cfg.capture.width, height: cfg.capture.height }, deviceScaleFactor: 1,
    recordVideo: { dir, size: { width: cfg.capture.width, height: cfg.capture.height } } });
  await ctx.addInitScript(INIT, { seed: { token: auth.token, user: auth.user, tour: def.tour }, zoom: ZOOM });
  const t0 = Date.now();
  const page = await ctx.newPage();
  const h = { page, st: { x: 300, y: 940 }, sec: sec.id };
  page.on("console", (m) => m.type() === "error" && report.console.push({ section: sec.id, text: m.text().slice(0, 200) }));
  page.on("pageerror", (e) => report.console.push({ section: sec.id, text: String(e).slice(0, 200) }));
  await def.setup(h);
  await sleep(300);
  const now = () => (Date.now() - t0) / 1000;
  const ready = now();
  await sleep(cfg.pacing.lead_in_seconds * 1000);

  const lines = sec.lines.map((l) => fill(l, nums));
  const info = durs[sec.id];
  let seconds = info.sentences.map((s) => s.seconds);
  if (info.human) { // one human recording per section: spread its length over the sentences by word count
    const words = lines.map((l) => l.split(/\\s+/).length), total = words.reduce((a, b) => a + b, 0);
    seconds = words.map((w) => (info.human.seconds * w) / total);
  }
  if (def.beats.length !== lines.length) throw new Error(`${sec.id}: ${lines.length} sentences but ${def.beats.length} beats`);
  const timeline = [];
  for (let j = 0; j < lines.length; j++) {
    const beat = def.beats[j], gap = j < lines.length - 1 ? cfg.voice.sentence_gap_seconds : 0;
    const a0 = Date.now();
    let start, actSeconds;
    if (beat.gate) {
      await beat.act?.(h); actSeconds = (Date.now() - a0) / 1000;
      await beat.proof?.(h);
      start = now() + 0.05;
      await sleep(seconds[j] * 1000);
    } else {
      start = now() + 0.05;
      const acting = (async () => { await beat.act?.(h); actSeconds = (Date.now() - a0) / 1000; })();
      await Promise.all([acting, sleep(seconds[j] * 1000)]);
      await beat.proof?.(h);
    }
    timeline.push({ beat: j, text: lines[j], start: +start.toFixed(3), seconds: +seconds[j].toFixed(3), file: info.sentences[j].file, act_seconds: +(actSeconds ?? 0).toFixed(2) });
    await sleep(((beat.hold ?? 0.15) + gap) * 1000);
  }
  await sleep((def.tail ?? cfg.pacing.tail_hold_seconds) * 1000);
  const end = now();
  const video = page.video();
  await ctx.close();
  const src = await video.path();
  const dest = join(OUT, "clips", `${sec.id}.webm`);
  renameSync(src, dest);
  const meta = { id: sec.id, title: sec.title, ready: +ready.toFixed(3), end: +end.toFixed(3), clip_seconds: +(end - ready).toFixed(2),
    video_seconds: +ffprobeDuration(dest).toFixed(2), speech_seconds: info.speech_seconds, human_voice: Boolean(info.human), timeline };
  report.sections[sec.id] = meta;
  console.log(`${sec.id.padEnd(13)} clip ${meta.clip_seconds.toFixed(1)}s  speech ${meta.speech_seconds}s`);
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const sec of script.sections) {
    if (only && !only.includes(sec.id)) continue;
    await recordSection(browser, sec);
    const m = report.sections[sec.id];
    if (m.clip_seconds > 2.2 * m.speech_seconds + 12) { // an occasional browser stall: record that section once more
      console.log(`  ${sec.id}: clip is ${m.clip_seconds}s for ${m.speech_seconds}s of speech, recording it again`);
      await recordSection(browser, sec);
    }
  }
} finally {
  await browser.close();
}
const prev = only ? (() => { try { return readJson(join(OUT, "record_report.json")); } catch { return null; } })() : null;
if (prev) { report.sections = { ...prev.sections, ...report.sections }; report.proofs = [...prev.proofs.filter((p) => !only.includes(p.section)), ...report.proofs]; report.visibility = [...prev.visibility.filter((p) => !only.includes(p.section)), ...report.visibility]; }
writeJson(join(OUT, "record_report.json"), report);
const bad = report.proofs.filter((p) => !p.ok);
console.log(`\nproofs ok: ${report.proofs.filter((p) => p.ok).length}, failed: ${bad.length}; console errors: ${report.console.length}; visibility flags: ${report.flags.length}`);
report.flags.forEach((f) => console.log("FLAG", f));
report.console.forEach((c) => console.log("CONSOLE", c.section, c.text));
if (bad.length) process.exit(1);
