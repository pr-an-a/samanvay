// One command for the whole video:  node video/build.mjs [--from reseed|tts|record|assemble]
//   reseed    put the demo data back, compute the live numbers, then everything below (default)
//   tts       reseed, then generate the voiceover (Piper) and record
//   record    record every section
//   assemble  cut the draft, stills and reports
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { HERE, OUT, reseed, computeNumbers, writeJson } from "./lib.mjs";

const steps = ["reseed", "tts", "record", "assemble"];
const from = process.argv.includes("--from") ? process.argv[process.argv.indexOf("--from") + 1] : "reseed";
const run = (cmd, args) => { const r = spawnSync(cmd, args, { stdio: "inherit", cwd: HERE }); if (r.status !== 0) process.exit(r.status || 1); };
// Recording changes the data (a note, an audit entry, a prevented clash), so anything that records starts from a fresh reseed.
if (from !== "assemble") { console.log("\n== reseed and live numbers =="); await reseed(); writeJson(join(OUT, "numbers.json"), await computeNumbers()); }
for (const s of steps.slice(Math.max(1, steps.indexOf(from)))) {
  console.log(`\n== ${s} ==`);
  if (s === "tts") run(join(HERE, ".venv", "bin", "python"), ["tts.py"]);
  if (s === "record") run("node", ["record.mjs"]);
  if (s === "assemble") run("node", ["assemble.mjs"]);
}
console.log("\ndone: video/out/samanvay_demo_draft.mp4");
