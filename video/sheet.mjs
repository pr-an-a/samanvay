// Developer helper: a 3-frames-per-clip sheet from out/clips (for a quick look before assembling).  node sheet.mjs [id,id,...]
import { execFileSync } from "node:child_process";
import { readJson, OUT } from "./lib.mjs";
import { join } from "node:path";
const r = readJson(join(OUT, "record_report.json"));
const ids = (process.argv[2] ? process.argv[2].split(",") : Object.keys(r.sections));
const probe = join(OUT, "probe");
const rows = [];
for (const id of ids) {
  const m = r.sections[id], files = [];
  [0.3, 0.62, 0.92].forEach((p, k) => {
    const f = join(probe, `${id}_${k}.png`);
    execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", (m.ready + (m.end - m.ready) * p).toFixed(2), "-i", join(OUT, "clips", `${id}.webm`), "-frames:v", "1", "-vf", "scale=640:360", f]);
    files.push(f);
  });
  const row = join(probe, `row_${id}.png`);
  execFileSync("ffmpeg", ["-v", "error", "-y", ...files.flatMap((f) => ["-i", f]), "-filter_complex", "hstack=inputs=3", row]);
  rows.push(row);
}
const out = join(probe, `sheet_${ids.join("-")}.png`);
execFileSync("ffmpeg", ["-v", "error", "-y", ...rows.flatMap((f) => ["-i", f]), "-filter_complex", `vstack=inputs=${rows.length}`, out]);
console.log(out);
