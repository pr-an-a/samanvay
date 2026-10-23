// Measures how far Playwright's video lags the wall clock (so audio can be placed exactly): flashes the page red at a known time.
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import { renameSync } from "node:fs";
import { join } from "node:path";
import { OUT, ensureDir, sleep, writeJson, readJson, cfg, HERE } from "./lib.mjs";
const dir = ensureDir(join(OUT, "calibrate"));
const b = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, recordVideo: { dir, size: { width: 1920, height: 1080 } } });
const t0 = Date.now(); const p = await ctx.newPage();
await p.goto("about:blank"); await p.setContent("<body style='margin:0;background:#000'>"); await sleep(2000);
const flash = (Date.now() - t0) / 1000;
await p.evaluate(() => (document.body.style.background = "#f00")); await sleep(1500);
const v = p.video(); await ctx.close(); const f = await v.path(); const webm = join(dir, "cal.webm"); renameSync(f, webm); await b.close();
const raw = spawnSync("ffmpeg", ["-v", "error", "-i", webm, "-vf", "fps=50,scale=4:4,format=rgb24", "-f", "rawvideo", "-"], { maxBuffer: 1 << 26 }).stdout;
const frame = 4 * 4 * 3; let first = -1;
for (let i = 0; i * frame < raw.length; i++) { const r = raw[i * frame], g = raw[i * frame + 1]; if (r > 200 && g < 60) { first = i; break; } }
const seen = first / 50, offset = +(flash - seen).toFixed(3);
console.log({ flash_wall_seconds: +flash.toFixed(3), red_seen_in_video_seconds: seen, video_lags_wall_by: offset });
const c = readJson(join(HERE, "config.json")); c.capture.video_offset_seconds = offset; writeJson(join(HERE, "config.json"), c);
