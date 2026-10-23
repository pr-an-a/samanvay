// Records the demo video section by section (one clip each) at 1920x1080 with Playwright, driving the real app in video mode.
//
//   node record.mjs                 record every section (data must already be reseeded: build.mjs does that first)
//   node record.mjs --only stress   record just some sections (comma-separated ids)
//
// Every section runs CONTEXT -> action -> result -> WHY, and a click only ever happens AFTER the sentence that explains it:
//   before  waits until the result the sentence talks about is on screen (numbers are only spoken once they are visible)
//   during  runs while the sentence is spoken: pointing, scrolling, zooming, typing (never a decision click)
//   after   the click itself: cursor glides in slowly, the element pulses for 0.5 s, then it is clicked
// The bottom bar shows the sentence being spoken (set per sentence); the start time of every sentence is logged so assemble.mjs
// can place its audio exactly there. Nothing here plays audio, so speech can never run past the visuals.
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
const report = { sections: {}, visibility: [], proofs: [], zooms: [], console: [], flags: [] };

// ---------- in-page: seeded state, zoom, visible cursor + click ripple, smooth element zoom ----------
const INIT = ({ seed, zoom }) => {
  const applyZoom = () => document.documentElement && (document.documentElement.style.zoom = String(zoom));
  applyZoom();
  document.addEventListener("readystatechange", applyZoom);
  addEventListener("DOMContentLoaded", applyZoom);
  if (!sessionStorage.getItem("__seeded")) {
    sessionStorage.setItem("__seeded", "1");
    sessionStorage.setItem("samanvay.video", "1");
    sessionStorage.setItem("samanvay.rec", "1");
    if (seed.token) {
      localStorage.setItem("samanvay.token", seed.token);
      localStorage.setItem("samanvay.user", JSON.stringify(seed.user));
    } else {
      localStorage.removeItem("samanvay.token");
      localStorage.removeItem("samanvay.user");
    }
    sessionStorage.removeItem("samanvay.tour"); // no guided-demo state: the side panel is not part of the video
  }

  // Smooth zoom onto one element (ease in/out, 0.6 s): scales the element itself (so its text is re-rendered sharp), centres it in the
  // part of the screen above the subtitle bar, and dims the rest. Never reaches the subtitles.
  window.__zoom = (() => {
    let cur = null;
    const dim = () => {
      let d = document.getElementById("__dim");
      if (!d) {
        d = document.createElement("div");
        d.id = "__dim";
        d.style.cssText = "position:fixed;inset:0;background:rgba(38,34,30,.52);opacity:0;transition:opacity 500ms ease;z-index:44;pointer-events:none";
        document.documentElement.appendChild(d);
      }
      return d;
    };
    const out = () => {
      if (!cur) return 0;
      const c = cur;
      cur = null;
      c.el.style.transform = "";
      dim().style.opacity = "0";
      c.hidden.forEach((h) => (h.style.display = h.dataset.__d || ""));
      setTimeout(() => {
        for (const [k, v] of Object.entries(c.saved)) c.el.style[k] = v;
      }, 700);
      return 1;
    };
    const into = (el, o = {}) => {
      out();
      const bar = document.querySelector("[data-caption-bar]");
      const limit = (bar ? bar.getBoundingClientRect().top : innerHeight) - 18;
      const top = o.top ?? 58;
      const saved = {};
      const set = (k, v) => { saved[k] = el.style[k]; el.style[k] = v; };
      const hidden = [];
      if (o.hideAfter != null) [...el.children].slice(o.hideAfter).forEach((c) => { c.dataset.__d = c.style.display; c.style.display = "none"; hidden.push(c); });
      if (o.only) [...el.children].forEach((c, i) => { if (i < o.only[0] || i > o.only[1]) { c.dataset.__d = c.style.display; c.style.display = "none"; hidden.push(c); } });
      if (o.fit) { set("width", "fit-content"); set("marginLeft", "auto"); set("marginRight", "auto"); }
      if (o.width) { set("width", o.width + "px"); set("marginLeft", "auto"); set("marginRight", "auto"); }
      set("transition", "none");
      set("transform", "none");
      if (getComputedStyle(el).position === "static") set("position", "relative");
      set("zIndex", "45");
      set("transformOrigin", "50% 50%");
      if (o.bg) { set("background", "#fbf9f5"); set("padding", "16px 22px"); set("borderRadius", "16px"); set("boxShadow", "0 18px 50px rgba(0,0,0,.35)"); }
      const r = el.getBoundingClientRect();
      const s = Math.min(o.max ?? 1.8, (innerWidth - 90) / r.width, (limit - top) / r.height);
      cur = { el, saved, hidden };
      if (s < 1.05) { if (!o.modal) dim().style.opacity = "1"; return { scale: 1, w: r.width, h: r.height }; }
      const z = zoom || 1;
      const dx = (innerWidth / 2 - (r.left + r.width / 2)) / z;
      const dy = (top + (limit - top) / 2 - (r.top + r.height / 2)) / z;
      if (!o.modal) dim().style.opacity = "1";
      void el.offsetWidth;
      el.style.transition = "transform 600ms cubic-bezier(.4,0,.2,1)";
      el.style.transform = `translate(${dx}px, ${dy}px) scale(${s})`;
      return { scale: +s.toFixed(2), w: Math.round(r.width), h: Math.round(r.height) };
    };
    return { into, out };
  })();

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

// ---------- human-ish helpers (everything slower than a normal script: the viewer must be able to follow) ----------
const rand = (a, b) => a + Math.random() * (b - a);
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const GLIDE = 820; // ms for a cursor move; a section's `pace` stretches it

async function glide(h, x, y, ms = GLIDE) {
  const { page, st } = h;
  if (Math.hypot(x - h.st.x, y - h.st.y) < 4) return; // already there (the cursor pointed at it while the sentence was spoken)
  ms *= h.pace;
  const steps = Math.max(18, Math.round(ms / 16));
  const [x0, y0] = [st.x, st.y];
  for (let i = 1; i <= steps; i++) {
    const e = ease(i / steps);
    await page.mouse.move(x0 + (x - x0) * e, y0 + (y - y0) * e + Math.sin((i / steps) * Math.PI) * 7);
    await sleep(ms / steps);
  }
  [st.x, st.y] = [x, y];
}
async function center(loc) {
  await loc.first().waitFor({ state: "visible", timeout: 15000 });
  let b = await loc.first().boundingBox();
  const limit = await loc.first().evaluate(() => { const bar = document.querySelector("[data-caption-bar]"); return (bar ? bar.getBoundingClientRect().top : innerHeight) - 30; });
  if (b.y < 70 || b.y + b.height > limit) { // never point at or click what is scrolled away or under the subtitles
    await loc.first().evaluate((el) => el.scrollIntoView({ block: "center", behavior: "smooth" }));
    await sleep(700);
    b = await loc.first().boundingBox();
  }
  return [b.x + b.width / 2, b.y + b.height / 2];
}
async function pointAt(h, loc, ms) { const [x, y] = await center(loc); await glide(h, x, y, ms); }
/** Pulse the element for 0.5 s, then click it. (The cursor is already there: pointAt ran while the sentence was spoken.) */
async function pulseClick(h, loc) {
  await pointAt(h, loc);
  await loc.first().evaluate((el) => { el.classList.add("__pulse"); setTimeout(() => el.classList.remove("__pulse"), 560); });
  await sleep(500);
  await h.page.mouse.down(); await sleep(70); await h.page.mouse.up();
  await sleep(120);
}
async function typeHuman(h, loc, text) {
  await pointAt(h, loc);
  await h.page.mouse.down(); await h.page.mouse.up();
  const [lo, hi] = cfg.pacing.typing_ms_per_char;
  for (const ch of text) { await h.page.keyboard.type(ch); await sleep(rand(lo, hi)); }
}
const btn = (h, name) => h.page.getByRole("button", { name }).first();
const nav = (h, name) => h.page.locator('nav[aria-label="Main"] a', { hasText: name }).first();
const bell = (h) => h.page.locator('button[aria-label^="Alerts"]');
const setSubtitle = (h, text) => h.page.evaluate((t) => window.__setSubtitle?.(t), text);

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

/** Scroll an element fully into view (clear of the subtitles) and record whether it really fits. `tall` = meant to scroll (not flagged). */
async function reveal(h, selectorOrLocator, label, settle = 500, tall = false) {
  await sleep(settle);
  const loc = typeof selectorOrLocator === "string" ? h.page.locator(selectorOrLocator).first() : selectorOrLocator.first();
  await loc.waitFor({ state: "attached", timeout: 15000 });
  const measure = () => loc.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const bar = document.querySelector("[data-caption-bar]");
    const limit = bar ? bar.getBoundingClientRect().top : innerHeight;
    return { top: r.top, bottom: r.bottom, h: r.height, limit, left: r.left, right: r.right, vw: innerWidth };
  });
  let m = await measure();
  if (m.top < 60 || m.bottom > m.limit - 10) {
    await loc.evaluate((el, big) => el.scrollIntoView({ block: big ? "start" : "center", behavior: "smooth" }), m.h > m.limit * 0.6);
    await sleep(850);
    m = await measure();
  }
  const fits = m.top >= -1 && m.bottom <= m.limit + 1 && m.left >= -1 && m.right <= m.vw + 1;
  report.visibility.push({ section: h.sec, label, fits: fits || tall, top: Math.round(m.top), bottom: Math.round(m.bottom), available: Math.round(m.limit), tall });
  if (!fits && !tall) report.flags.push(`${h.sec}: "${label}" is not fully in view (${Math.round(m.h)}px tall, ${Math.round(m.limit)}px available)`);
}
async function zoomIn(h, locator, label, opts = {}) {
  const loc = typeof locator === "string" ? h.page.locator(locator).first() : locator.first();
  await reveal(h, loc, label, 250, Boolean(opts.tall));
  const info = await loc.evaluate((el, o) => window.__zoom.into(el, o), opts);
  report.zooms.push({ section: h.sec, label, ...info });
  await sleep(650);
}
async function zoomOut(h) { await h.page.evaluate(() => window.__zoom.out()); await sleep(650); }
const highlight = (loc) => loc.evaluate((el) => { document.querySelectorAll(".video-highlight[data-hl]").forEach((e) => { e.classList.remove("video-highlight"); e.removeAttribute("data-hl"); }); el.classList.add("video-highlight"); el.setAttribute("data-hl", "1"); });

// ---------- the sections ----------
const caseUrl = `/cases/${nums.ids.action_case_pk}`;
const PANEL = '[data-tour-target="check-panel"]';

async function fillForm(h, human) {
  const card = h.page.locator('[data-tour-target="new-action"]');
  if (human) {
    await pointAt(h, card.locator("select").first(), 550);
    await card.locator("select").first().selectOption({ label: "Seek reply from institution" });
    await sleep(250);
    await typeHuman(h, card.locator("input").first(), DEMO_ASKING);
  } else {
    await card.locator("select").first().selectOption({ label: "Seek reply from institution" });
    await card.locator("input").first().fill(DEMO_ASKING);
  }
}
const goto = async (h, path, waitFor) => { await h.page.goto(`${BASE}${path}`); if (waitFor) await h.page.waitForSelector(waitFor); await h.page.mouse.move(h.st.x, h.st.y); };

const DEFS = {
  story: {
    role: null,
    setup: (h) => goto(h, "/story?manual=1", "text=Illustrative scenario"),
    beats: [
      { during: async (h) => { await sleep(300); await h.page.keyboard.press("ArrowRight"); } },
      { during: async (h) => { await h.page.keyboard.press("ArrowRight"); } },
      { during: async (h) => { await h.page.keyboard.press("ArrowRight"); } },
      { during: async (h) => { await h.page.keyboard.press("ArrowRight"); }, hold: 1.4 },
    ],
  },
  without_with: {
    role: "PGRC",
    setup: (h) => goto(h, "/without-with", "text=Without Samanvay"),
    beats: [
      { during: async (h) => { await reveal(h, '[data-tour-target="inboxes"]', "the two inboxes"); await pointAt(h, h.page.locator("section[aria-label='Regulation Bureau inbox'] li").first(), 700); await pointAt(h, h.page.locator("section[aria-label='Grievance Cell inbox'] li").nth(2), 800); await pointAt(h, btn(h, /Turn on Samanvay/), 800); },
        after: async (h) => { await pulseClick(h, btn(h, /Turn on Samanvay/)); await sleep(300); } },
      { before: async (h) => {
          await prove(h, `${nums.ww.pairs} connector lines drawn`, (n) => document.querySelectorAll("path.connector-line").length === n, nums.ww.pairs);
          const noid = await h.page.getByText("Matched without AICTE ID", { exact: true }).count();
          const same = await h.page.getByText("Same AICTE ID", { exact: true }).count();
          if (noid !== nums.ww.noid || noid + same !== nums.ww.pairs) throw new Error(`[without_with] labels on screen: ${noid} without ID + ${same} with ID; voiceover says ${nums.ww.noid} of ${nums.ww.pairs}`);
          report.proofs.push({ section: h.sec, label: `${nums.ww.pairs} matches, ${nums.ww.noid} without an AICTE ID (counted on screen)`, ok: true });
          await reveal(h, '[data-tour-target="inboxes"]', "the three matches", 200);
        }, hold: 0.4 },
      { hold: 1.0 },
    ],
  },
  check: {
    role: "PGRC", pace: 1.35,
    setup: (h) => goto(h, caseUrl, '[data-tour-target="new-action"]'),
    beats: [
      { during: async (h) => { await reveal(h, '[data-tour-target="new-action"]', "the New action form", 300); } },
      { during: async (h) => { await fillForm(h, true); } },
      { during: async (h) => { await pointAt(h, btn(h, /Check and send/)); }, after: async (h) => { await pulseClick(h, btn(h, /Check and send/)); } },
      { before: async (h) => { await hasText(h, "the official alert wording is on screen", "Potential Overlapping Cases – Coordination Required"); await sleep(500); }, hold: 0.4 },
      { before: async (h) => { await hasText(h, `"${nums.check.days} days ago" in the check panel`, `${nums.check.days} days ago`); },
        during: async (h) => { await zoomIn(h, PANEL, "the check panel", { modal: true, max: 1.5 }); }, hold: 0.8 },
      { hold: 1.4 },
    ],
  },
  coordinate: {
    role: "PGRC", pace: 1.2,
    setup: async (h) => {
      await goto(h, caseUrl, '[data-tour-target="new-action"]'); await fillForm(h, false);
      await btn(h, /Check and send/).click(); await h.page.waitForSelector(PANEL); await sleep(900);
    },
    beats: [
      { during: async (h) => { await zoomIn(h, PANEL, "the check panel and its three choices", { modal: true, max: 1.5 });
          for (const n of [/Coordinate with/, /Send anyway/, /^Cancel$/]) await pointAt(h, btn(h, n), 800); } },
      { during: async (h) => { await pointAt(h, btn(h, /Coordinate with/)); }, after: async (h) => { await pulseClick(h, btn(h, /Coordinate with/)); await sleep(600); } },
      { during: async (h) => { await zoomIn(h, PANEL, "the drafted coordination note", { modal: true, max: 1.5 }); await pointAt(h, h.page.locator("#coord-note"), 1000); await sleep(1200); },
        after: async (h) => { await pulseClick(h, btn(h, /Send note/)); await prove(h, "note sent message", () => document.body.innerText.includes("bell has rung")); await sleep(500); } },
      { hold: 1.6 },
    ],
  },
  regulation: {
    role: "RB",
    setup: (h) => goto(h, "/", '[data-tour-target="inbox-list"]'),
    beats: [
      { before: async (h) => { await hasText(h, "the note is waiting in the inbox", "Waiting for your reply"); },
        during: async (h) => { await zoomIn(h, h.page.locator('[data-tour-target="inbox-list"] > ul'), "the inbox's top rows", { hideAfter: 2, tall: true, max: 1.5 }); await sleep(300); } },
      { during: async (h) => { await zoomOut(h); await pointAt(h, h.page.locator('[data-tour-target="inbox-list"] > ul > li').first()); },
        after: async (h) => { await pulseClick(h, h.page.locator('[data-tour-target="inbox-list"] > ul > li a').first()); await h.page.waitForSelector('[data-tour-target="timeline"]'); await sleep(350); } },
      { during: async (h) => {
          const rows = h.page.locator('[data-tour-target="timeline"] ol > li');
          const mergeAt = await rows.evaluateAll((els) => els.findIndex((e) => e.textContent.includes("Threads join")));
          await zoomIn(h, h.page.locator('[data-tour-target="timeline"] ol'), "the merged-thread timeline (the rows around the join)", { only: [Math.max(0, mergeAt - 2), mergeAt + 2], tall: true, bg: true, max: 1.7 });
          await pointAt(h, h.page.getByText(/Threads join/).first(), 900); }, hold: 0.3 },
      { hold: 1.0 },
    ],
  },
  stress: {
    role: "RB", persona: null,
    setup: (h) => goto(h, "/", '[data-tour-target="inbox-list"]'),
    beats: [
      { during: async (h) => { await pointAt(h, nav(h, "Stress test")); }, after: async (h) => { await pulseClick(h, nav(h, "Stress test")); await h.page.waitForSelector('[data-tour-target="stress-table"]'); await sleep(200); } },
      { during: async (h) => { await reveal(h, '[data-tour-target="stress-table"]', "the stress-test table (top)", 300, true); await pointAt(h, btn(h, /^Run$/)); }, after: async (h) => { await pulseClick(h, btn(h, /^Run$/)); } },
      { before: async (h) => {
          await prove(h, `${nums.stress.total} variants listed`, (n) => document.querySelectorAll('[data-tour-target="stress-table"] tbody tr').length === n, nums.stress.total);
          await h.page.getByText("Final score").first().waitFor({ timeout: 20000 });
          await sleep(300);
        },
        during: async (h) => {
          await hasText(h, `score line ${nums.stress.samanvay}/${nums.stress.total} · ${nums.stress.exact}/${nums.stress.total} · ${nums.stress.id}/${nums.stress.total}`,
            `Samanvay ${nums.stress.samanvay}/${nums.stress.total} · Exact name ${nums.stress.exact}/${nums.stress.total} · ID-only ${nums.stress.id}/${nums.stress.total}`);
          await zoomIn(h, h.page.locator("p[role=status]").first(), "the stress-test score line", { bg: true, fit: true, max: 1.8 });
        }, hold: 0.4 },
      { before: async (h) => { await zoomOut(h); },
        during: async (h) => { await reveal(h, h.page.locator("section", { has: h.page.getByText(/Where Samanvay missed/) }), "the misses card", 300);
          await hasText(h, `"Where Samanvay missed (${nums.stress.misses} of ${nums.stress.total})"`, `Where Samanvay missed (${nums.stress.misses} of ${nums.stress.total})`); }, hold: 1.0 },
    ],
  },
  accuracy: {
    role: "RB", persona: null,
    setup: (h) => goto(h, "/", '[data-tour-target="inbox-list"]'),
    beats: [
      { during: async (h) => { await pointAt(h, nav(h, "Accuracy")); }, after: async (h) => { await pulseClick(h, nav(h, "Accuracy")); await h.page.waitForSelector('[data-tour-target="baseline"]'); await sleep(150); } },
      { before: async (h) => {
          const want = [nums.base.id, nums.base.exact, nums.base.samanvay].map((f) => f / nums.base.overlaps);
          await prove(h, `bars grown to ${want.map((w) => Math.round(w * 100)).join("/")}% of ${nums.base.overlaps}`, (w) => {
            const bars = [...document.querySelectorAll(".bar-grow")];
            return bars.length === 3 && bars.every((b, i) => Math.abs(b.getBoundingClientRect().width / b.parentElement.getBoundingClientRect().width - w[i]) < 0.01);
          }, want, 8000);
          await hasText(h, `"Found ${nums.base.id} of ${nums.base.overlaps}"`, `Found ${nums.base.id} of ${nums.base.overlaps}`);
          await hasText(h, `"Found ${nums.base.exact} of ${nums.base.overlaps} · ${nums.base.exact_wrong} wrong matches"`, `Found ${nums.base.exact} of ${nums.base.overlaps}`, `${nums.base.exact_wrong} wrong matches`);
        },
        during: async (h) => { await zoomIn(h, h.page.locator('[data-tour-target="baseline"] ul').first(), "the three baseline bars", { bg: true, width: 1000, max: 1.8 }); }, hold: 0.5 },
      { before: async (h) => { await hasText(h, `"Found ${nums.base.samanvay} of ${nums.base.overlaps} · ${nums.base.samanvay_wrong} wrong matches"`, `Found ${nums.base.samanvay} of ${nums.base.overlaps}`, `${nums.base.samanvay_wrong} wrong matches`); }, hold: 1.0 },
      { before: async (h) => { await hasText(h, `second dataset: found ${nums.seed43.found} of ${nums.seed43.overlaps}, ${nums.seed43.wrong} wrong`, `found ${nums.seed43.found} of ${nums.seed43.overlaps} with ${nums.seed43.wrong} wrong match`); await zoomOut(h); },
        during: async (h) => { await zoomIn(h, '[data-testid="second-dataset"]', "the second-dataset line", { bg: true, width: 1000, max: 1.8 }); }, hold: 0.5 },
      { before: async (h) => { await zoomOut(h); },
        during: async (h) => { await reveal(h, '[data-testid="caveat"]', "the synthetic-data caveat", 200); await highlight(h.page.locator('[data-testid="caveat"]')); }, hold: 1.0 },
    ],
  },
  how: {
    role: "RB", persona: null,
    setup: (h) => goto(h, "/accuracy", '[data-tour-target="baseline"]'),
    beats: [
      { during: async (h) => { await pointAt(h, nav(h, "How it works")); }, after: async (h) => { await pulseClick(h, nav(h, "How it works")); await h.page.waitForSelector('[data-tour-target="how-steps"]'); await reveal(h, '[data-tour-target="how-steps"]', "the thread diagram", 250); } },
      ...[0, 1, 2, 3].map((i) => ({ during: async (h) => { const card = h.page.locator("ol > li").nth(i); await reveal(h, card, `technique card ${i + 1}`, 100); await highlight(card); await pointAt(h, card, 800); }, hold: 0.3 })),
      { during: async (h) => { const c = h.page.locator("section.moment").last(); await reveal(h, c, "explainable, no black-box AI card", 100); await highlight(c); await pointAt(h, c, 800); }, hold: 1.2 },
    ],
  },
  reports: {
    role: "RB", persona: null, // the "Senior officers" label appears once the dashboard does
    setup: (h) => goto(h, "/how-it-works", '[data-tour-target="how-steps"]'),
    beats: [
      { during: async (h) => { await pointAt(h, nav(h, "Reports")); }, after: async (h) => { await pulseClick(h, nav(h, "Reports")); await h.page.waitForSelector('[data-tour-target="reports-kpis"]'); await h.page.evaluate(() => window.__setPersona?.("Senior officers · all bureaus")); await sleep(300); } },
      { during: async (h) => {
          await reveal(h, '[data-tour-target="reports-kpis"]', "KPI tiles", 200); await pointAt(h, h.page.locator('[data-tour-target="reports-kpis"]'), 900);
          await pointAt(h, h.page.getByText("Open cases by bureau").first(), 1000); await pointAt(h, h.page.locator(".recharts-wrapper").first(), 1000);
          report.proofs.push({ section: h.sec, label: "KPI tiles, bureau-wise open vs overdue and ageing chart all on screen", ok: true });
        }, hold: 0.8 },
    ],
  },
  officers: {
    role: "RB",
    setup: (h) => goto(h, "/reports", '[data-tour-target="reports-kpis"]'),
    beats: [
      { during: async (h) => { await pointAt(h, nav(h, "Inbox")); }, after: async (h) => { await pulseClick(h, nav(h, "Inbox")); await h.page.waitForSelector('[data-tour-target="inbox-list"]'); await sleep(300); } },
      { during: async (h) => { await pointAt(h, h.page.locator('[data-tour-target="inbox-list"] > ul > li').first()); },
        after: async (h) => {
          await pulseClick(h, h.page.locator('[data-tour-target="inbox-list"] > ul > li a').first()); await h.page.waitForSelector('[data-tour-target="timeline"]');
          await sleep(250); await h.page.evaluate((u) => { history.pushState({}, "", u); dispatchEvent(new PopStateEvent("popstate")); }, caseUrl); // a cut to the Grievance Cell's case
          await h.page.waitForSelector("text=Complainant");
          const field = h.page.locator("div:has(> dt:text-is('Complainant'))").first();
          await prove(h, "complainant hidden from the other bureau", () => document.body.innerText.includes("A*** R***") && document.body.innerText.includes("hidden: another bureau"));
          await reveal(h, field, "the hidden complainant name", 300); await highlight(field); await pointAt(h, field, 700);
        }, hold: 0.8 },
      { hold: 2.0 },
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
  await ctx.addInitScript(INIT, { seed: { token: auth.token, user: auth.user }, zoom: ZOOM });
  const t0 = Date.now();
  const page = await ctx.newPage();
  const h = { page, st: { x: 300, y: 940 }, sec: sec.id, pace: def.pace ?? 1 };
  page.on("console", (m) => m.type() === "error" && report.console.push({ section: sec.id, text: m.text().slice(0, 200) }));
  page.on("pageerror", (e) => report.console.push({ section: sec.id, text: String(e).slice(0, 200) }));
  await def.setup(h);
  await page.evaluate((p) => { window.__setPersona?.(p); window.__setSubtitle?.(""); }, "persona" in def ? def.persona : undefined);
  await sleep(300);
  const now = () => (Date.now() - t0) / 1000;
  const ready = now();
  await sleep(cfg.pacing.lead_in_seconds * 1000);

  const lines = sec.lines.map((l) => fill(l, nums));
  const info = durs[sec.id];
  let seconds = info.sentences.map((s) => s.seconds);
  if (info.human) { // one human recording per section: spread its length over the sentences by word count
    const words = lines.map((l) => l.split(/\s+/).length), total = words.reduce((a, b) => a + b, 0);
    seconds = words.map((w) => (info.human.seconds * w) / total);
  }
  if (def.beats.length !== lines.length) throw new Error(`${sec.id}: ${lines.length} sentences but ${def.beats.length} beats`);
  const timeline = [];
  for (let j = 0; j < lines.length; j++) {
    const beat = def.beats[j], gap = j < lines.length - 1 ? cfg.voice.sentence_gap_seconds : 0;
    const b0 = Date.now();
    await beat.before?.(h);                                  // the result this sentence talks about is on screen
    const beforeSeconds = (Date.now() - b0) / 1000;
    const start = now() + 0.05;
    await setSubtitle(h, lines[j]);                          // the bottom bar shows the sentence being spoken
    const d0 = Date.now();
    await Promise.all([(async () => { await beat.during?.(h); })(), sleep(seconds[j] * 1000)]);
    const duringSeconds = (Date.now() - d0) / 1000;
    const a0 = Date.now();
    await beat.after?.(h);                                   // the click, only after the sentence that explained it
    const afterSeconds = (Date.now() - a0) / 1000;
    timeline.push({ beat: j, text: lines[j], start: +start.toFixed(3), seconds: +seconds[j].toFixed(3), file: info.sentences[j].file,
      before_seconds: +beforeSeconds.toFixed(2), act_seconds: +duringSeconds.toFixed(2), after_seconds: +afterSeconds.toFixed(2) });
    await sleep((((beat.hold ?? 0.1) * 0.7) + gap) * 1000);
  }
  await sleep((def.tail ?? cfg.pacing.tail_hold_seconds) * 1000);
  await setSubtitle(h, "");
  const end = now();
  const video = page.video();
  await ctx.close();
  const dest = join(OUT, "clips", `${sec.id}.webm`);
  renameSync(await video.path(), dest);
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
if (prev) {
  report.sections = { ...prev.sections, ...report.sections };
  for (const k of ["proofs", "visibility", "zooms"]) report[k] = [...(prev[k] || []).filter((p) => !only.includes(p.section)), ...report[k]];
}
writeJson(join(OUT, "record_report.json"), report);
const bad = report.proofs.filter((p) => !p.ok);
console.log(`\nproofs ok: ${report.proofs.filter((p) => p.ok).length}, failed: ${bad.length}; console errors: ${report.console.length}; visibility flags: ${report.flags.length}`);
report.zooms.forEach((z) => console.log(`zoom ${z.section}: ${z.label} x${z.scale}`));
report.flags.forEach((f) => console.log("FLAG", f));
report.console.forEach((c) => console.log("CONSOLE", c.section, c.text));
if (bad.length) process.exit(1);
