// Title and end cards, rendered from HTML (so they use the app's own fonts) into PNGs for assemble.mjs.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { cfg, script, ROOT, OUT, ensureDir, readJson } from "./lib.mjs";

const FONTS = join(ROOT, "frontend", "node_modules", "@fontsource");
const css = `
@font-face{font-family:Fraunces;font-weight:600;src:url(file://${FONTS}/fraunces/files/fraunces-latin-600-normal.woff2)}
@font-face{font-family:Fraunces;font-style:italic;font-weight:400;src:url(file://${FONTS}/fraunces/files/fraunces-latin-400-italic.woff2)}
@font-face{font-family:Inter;font-weight:400;src:url(file://${FONTS}/inter/files/inter-latin-400-normal.woff2)}
@font-face{font-family:Inter;font-weight:600;src:url(file://${FONTS}/inter/files/inter-latin-600-normal.woff2)}
*{box-sizing:border-box;margin:0}
body{width:1920px;height:1080px;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fbf9f5;font-family:Inter,sans-serif;
 background-color:#26221e;background-image:radial-gradient(120% 90% at 100% 0%,rgba(181,101,74,.22),transparent 55%),radial-gradient(90% 80% at 0% 100%,rgba(91,107,122,.3),transparent 60%)}
.mark{margin-bottom:34px}
h1{font-family:Fraunces,serif;font-weight:600;font-size:124px;letter-spacing:-.01em;line-height:1}
.tag{font-family:Fraunces,serif;font-style:italic;font-size:42px;color:#e9e2d6;margin-top:22px}
.meta{margin-top:56px;font-size:34px;letter-spacing:.06em;color:#e0c9b4;text-align:center;line-height:1.6}
.meta b{color:#fbf9f5;font-weight:600}
.stats{display:flex;gap:90px;margin-top:10px}
.stat{text-align:center;max-width:420px}
.stat .n{font-family:Fraunces,serif;font-weight:600;font-size:88px;line-height:1;white-space:nowrap}
.stat .l{margin-top:16px;font-size:27px;color:#e9e2d6;line-height:1.35}
.foot{position:absolute;bottom:70px;font-size:28px;color:#e0c9b4}
h2{font-family:Fraunces,serif;font-weight:600;font-size:60px;margin-bottom:60px}
`;
const mark = `<svg class="mark" width="120" height="120" viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round"><path d="M6 3c0 7 6 6.5 6 12v6" stroke="#d8d0c3"/><path d="M18 3c0 7-6 6.5-6 12" stroke="#e8967a"/></svg>`;
const t = cfg.title_card;
const n = readJson(join(OUT, "numbers.json"));
const html = {
  title: `<style>${css}</style>${mark}<h1>${t.product}</h1><div class="tag">Check across bureaus before you act.</div>
    <div class="meta"><b>${t.code}</b> &nbsp;·&nbsp; ${t.team}<br>${t.college}</div>`,
  end: `<style>${css}</style><h2>Samanvay, in numbers</h2>
    <div class="stats">
      <div class="stat"><div class="n">${n.base.samanvay} of ${n.base.overlaps}</div><div class="l">planted overlaps found, with ${n.base.samanvay_wrong} wrong matches</div></div>
      <div class="stat"><div class="n">${n.stress.samanvay} of ${n.stress.total}</div><div class="l">misspelt and abbreviated names found by the real matcher</div></div>
      <div class="stat"><div class="n">${n.seed43.found} of ${n.seed43.overlaps}</div><div class="l">on a second dataset it was never tuned on</div></div>
    </div>
    <div class="foot">${cfg.end_card.disclaimer}</div>`,
};
// Chapter cards ("3 · Stopping a duplicate request") and transition cards ("Meanwhile, at the Regulation Bureau…")
const chapter = (label) => {
  const [n, ...rest] = label.split(" · ");
  return `<style>${css}</style>${mark.replace('width="120" height="120"', 'width="84" height="84"')}
    <div style="font-size:30px;letter-spacing:.22em;color:#e0c9b4;text-transform:uppercase;margin-bottom:26px">Chapter ${n}</div>
    <h1 style="font-size:104px;max-width:1500px;text-align:center;line-height:1.08">${rest.join(" · ")}</h1>`;
};
const transition = (text) => `<style>${css}</style>${mark.replace('width="120" height="120"', 'width="84" height="84"')}
  <h1 style="font-size:92px;font-style:italic;font-weight:400;max-width:1500px;text-align:center;line-height:1.15">${text}</h1>`;
script.cards.chapters.forEach((label, i) => { html[`chapter_${i + 1}`] = chapter(label); });
script.sections.filter((s) => s.transition).forEach((s) => { html[`transition_${s.id}`] = transition(s.transition); });
ensureDir(join(OUT, "cards"));
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
for (const [name, body] of Object.entries(html)) {
  const file = join(OUT, "cards", `${name}.html`);
  writeFileSync(file, `<!doctype html><meta charset=utf-8>${body}`);
  await page.goto(`file://${file}`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(OUT, "cards", `${name}.png`) });
}
await browser.close();
console.log("cards rendered");
