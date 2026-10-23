// One command for the whole video:  node video/build.mjs [--from reseed|tts|record|assemble]
//   reseed    put the demo data back, compute the live numbers, then everything below (default)
//   tts       reseed, then generate the voiceover (Piper) and record
//   record    record every section
//   assemble  cut the draft, stills and reports
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { HERE, OUT, reseed, computeNumbers, writeJson, sleep } from "./lib.mjs";

const steps = ["reseed", "tts", "record", "assemble"];
const from = process.argv.includes("--from") ? process.argv[process.argv.indexOf("--from") + 1] : "reseed";
const draft = process.argv.includes("--draft"); // a trial run with whatever voice is configured: skips the wait below
/** Final audio waits for the voice session: video/config.json must say "voice_confirmed": true (checked every minute, up to 40 minutes). */
async function waitForVoice() {
  const confirmed = () => { try { return (() => { const c = JSON.parse(readFileSync(join(HERE, "config.json"), "utf8")); return c.voice_confirmed === true || c.voice?.voice_confirmed === true; })(); } catch { return false; } };
  for (let waited = 0; !confirmed(); waited++) {
    if (waited >= 40) { console.error('voice_confirmed is still not true in video/config.json after 40 minutes: not generating final audio.'); process.exit(3); }
    console.log(`waiting for "voice_confirmed": true in video/config.json (${waited} min)…`);
    await sleep(60_000);
  }
  console.log("voice confirmed: using the voice and pronunciations in video/config.json");
}
const run = (cmd, args) => { const r = spawnSync(cmd, args, { stdio: "inherit", cwd: HERE }); if (r.status !== 0) process.exit(r.status || 1); };
// Recording changes the data (a note, an audit entry, a prevented clash), so anything that records starts from a fresh reseed.
if (from !== "assemble") { console.log("\n== reseed and live numbers =="); await reseed(); writeJson(join(OUT, "numbers.json"), await computeNumbers()); }
for (const s of steps.slice(Math.max(1, steps.indexOf(from)))) {
  console.log(`\n== ${s} ==`);
  if (s === "tts" && !draft) await waitForVoice();
  if (s === "tts") {
    const voice = JSON.parse(readFileSync(join(HERE, "config.json"), "utf8")).voice;
    run(voice.engine === "kokoro" ? join(HERE, voice.python) : join(HERE, ".venv", "bin", "python"), ["tts.py"]);
  }
  if (s === "record") run("node", ["record.mjs"]);
  if (s === "assemble") run("node", ["assemble.mjs"]);
}
console.log("\ndone: video/out/samanvay_demo_draft.mp4");
