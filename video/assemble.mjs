// Assembles the draft: title card + section clips (each with its voiceover placed exactly where it was spoken on screen)
// + end card, with soft crossfades and normalised loudness. Then stills for checking, a contact sheet, VOICEOVER.md and the report.
//   node assemble.mjs
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { cfg, script, OUT, HERE, ensureDir, readJson, writeJson, run, ffprobeDuration, exists } from "./lib.mjs";

const rep = readJson(join(OUT, "record_report.json"));
const durs = readJson(join(OUT, "audio", "durations.json"));
const nums = readJson(join(OUT, "numbers.json"));
const X = cfg.assemble.crossfade_seconds, FPS = cfg.capture.fps, OFFSET = cfg.capture.video_offset_seconds ?? 0;
const seg = ensureDir(join(OUT, "seg"));
const W = cfg.capture.width, H = cfg.capture.height;

run("node", [join(HERE, "cards.mjs")]);

// ---- 1. each section: video trimmed to its ready mark, voiceover mixed in at the logged times ----
const parts = [];
const titleSec = cfg.title_card.seconds, endSec = cfg.end_card.seconds;
function card(name, seconds) {
  const out = join(seg, `${name}.mp4`);
  run("ffmpeg", ["-y", "-loop", "1", "-framerate", String(FPS), "-t", String(seconds), "-i", join(OUT, "cards", `${name}.png`),
    "-f", "lavfi", "-t", String(seconds), "-i", "anullsrc=r=48000:cl=stereo", "-vf", `scale=${W}:${H},format=yuv420p`,
    "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-c:a", "aac", "-b:a", "192k", "-shortest", out]);
  return { id: name, file: out, seconds: ffprobeDuration(out) };
}
parts.push(card("title", titleSec));
for (const sec of script.sections) {
  const m = rep.sections[sec.id];
  const trim = Math.max(0, m.ready - OFFSET), len = m.clip_seconds;
  const v = join(seg, `${sec.id}.v.mp4`), a = join(seg, `${sec.id}.wav`), out = join(seg, `${sec.id}.mp4`);
  run("ffmpeg", ["-y", "-ss", trim.toFixed(3), "-t", len.toFixed(3), "-i", join(OUT, "clips", `${sec.id}.webm`),
    "-vf", `fps=${FPS},scale=${W}:${H}:flags=lanczos,format=yuv420p`, "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-an", v]);
  // audio: silence of the clip's length + every sentence delayed to the moment it was spoken on screen
  const inputs = ["-f", "lavfi", "-t", len.toFixed(3), "-i", "anullsrc=r=48000:cl=stereo"];
  const filters = [];
  const human = durs[sec.id].human;
  const placed = human ? [{ file: join(HERE, human.file), at: m.timeline[0].start - m.ready }] : m.timeline.map((t) => ({ file: join(HERE, t.file), at: t.start - m.ready }));
  placed.forEach((p, i) => {
    inputs.push("-i", p.file);
    const ms = Math.max(0, Math.round(p.at * 1000));
    filters.push(`[${i + 1}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms}[s${i}]`);
  });
  filters.push(`[0:a]${placed.map((_, i) => `[s${i}]`).join("")}amix=inputs=${placed.length + 1}:normalize=0:duration=first[mix]`);
  run("ffmpeg", ["-y", ...inputs, "-filter_complex", filters.join(";"), "-map", "[mix]", "-ar", "48000", "-t", len.toFixed(3), a]);
  run("ffmpeg", ["-y", "-i", v, "-i", a, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", out]);
  parts.push({ id: sec.id, file: out, seconds: ffprobeDuration(out) });
}
parts.push(card("end", endSec));

// ---- 2. crossfade everything together, normalise loudness ----
let total = parts[0].seconds;
const starts = [{ id: parts[0].id, at: 0, seconds: parts[0].seconds }];
const vf = [], af = [];
parts.forEach((_, i) => vf.push(`[${i}:v]settb=AVTB,fps=${FPS},format=yuv420p[v${i}]`));
let vPrev = "v0", aPrev = "0:a";
for (let i = 1; i < parts.length; i++) {
  const offset = total - X;
  vf.push(`[${vPrev}][v${i}]xfade=transition=fade:duration=${X}:offset=${offset.toFixed(3)}[x${i}]`);
  af.push(`[${aPrev}][${i}:a]acrossfade=d=${X}:c1=tri:c2=tri[ac${i}]`);
  starts.push({ id: parts[i].id, at: offset, seconds: parts[i].seconds });
  total += parts[i].seconds - X;
  vPrev = `x${i}`; aPrev = `ac${i}`;
}
if (total > cfg.assemble.max_seconds) {
  console.error(`TOO LONG: ${total.toFixed(1)}s > ${cfg.assemble.max_seconds}s. Trim holds/lines and rebuild.`);
  process.exit(2);
}
const final = join(OUT, "samanvay_demo_draft.mp4");
const norm = `[${aPrev}]loudnorm=I=${cfg.assemble.loudness_lufs}:TP=-1.5:LRA=11,aresample=48000[aout]`;
run("ffmpeg", ["-y", ...parts.flatMap((p) => ["-i", p.file]), "-filter_complex", [...vf, ...af, norm].join(";"), "-map", `[${vPrev}]`, "-map", "[aout]",
  "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "192k", final]);
const finalSeconds = ffprobeDuration(final);
console.log(`final: ${finalSeconds.toFixed(1)}s (${Math.floor(finalSeconds / 60)}:${String(Math.round(finalSeconds % 60)).padStart(2, "0")})`);

// ---- 3. stills for checking: 3 per scene (15 %, 50 %, 88 % of the part of the scene not under a crossfade) ----
const frames = ensureDir(join(OUT, "frames"));
run("sh", ["-c", `rm -f ${frames}/*.png`]);
const stills = [];
starts.forEach((s, i) => {
  const lo = s.at + (i === 0 ? 0.2 : X), hi = s.at + s.seconds - (i === starts.length - 1 ? 0.2 : X);
  const times = i === 0 || i === starts.length - 1 ? [(lo + hi) / 2] : [0.15, 0.5, 0.88].map((p) => lo + (hi - lo) * p);
  times.forEach((t, k) => {
    const f = join(frames, `${String(i).padStart(2, "0")}_${s.id}_${k + 1}.png`);
    run("ffmpeg", ["-y", "-ss", t.toFixed(2), "-i", final, "-frames:v", "1", f]);
    stills.push(f);
  });
});
const sheetSize = 18;
for (let n = 0; n * sheetSize < stills.length; n++) {
  const chunk = stills.slice(n * sheetSize, (n + 1) * sheetSize);
  const list = join(frames, `sheet${n + 1}.txt`);
  writeFileSync(list, chunk.map((f) => `file '${f}'\nduration 1`).join("\n") + "\n");
  run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", list, "-vf", `scale=640:360,tile=3x${Math.ceil(chunk.length / 3)}`, "-frames:v", "1", join(frames, `contact_sheet_${n + 1}.png`)]);
}

// ---- 4. flags: where audio and visuals do not line up ----
const flags = [...rep.flags];
for (const sec of script.sections) {
  const m = rep.sections[sec.id], last = m.timeline.at(-1);
  const speechEnd = last.start + last.seconds - m.ready;
  if (m.clip_seconds - speechEnd < 0.6) flags.push(`${sec.id}: speech ends ${(m.clip_seconds - speechEnd).toFixed(2)}s before the clip does (needs 0.6s)`);
  m.timeline.forEach((t) => { if (t.act_seconds - t.seconds > 3) flags.push(`${sec.id}: beat ${t.beat + 1} action takes ${t.act_seconds}s but its sentence only ${t.seconds}s (visuals outrun the voice)`); });
  const idle = m.clip_seconds - Math.max(...m.timeline.map((t) => t.start - m.ready + Math.max(t.seconds, t.act_seconds)));
  if (idle > 3.5) flags.push(`${sec.id}: ${idle.toFixed(1)}s of tail with nothing new happening`);
}
rep.proofs.filter((p) => !p.ok).forEach((p) => flags.push(`${p.section}: on-screen proof failed: ${p.label}`));
rep.console.forEach((c) => flags.push(`${c.section}: console error: ${c.text}`));
const result = { final_seconds: +finalSeconds.toFixed(2), scenes: starts.map((s) => ({ ...s, at: +s.at.toFixed(2), seconds: +s.seconds.toFixed(2) })), flags,
  proofs: rep.proofs, visibility: rep.visibility, stills: stills.length };
writeJson(join(OUT, "report.json"), result);

// ---- 5. VOICEOVER.md ----
const rows = script.sections.map((sec) => {
  const m = rep.sections[sec.id];
  return `### ${sec.id} · ${sec.title}\n\nTarget length **${m.clip_seconds.toFixed(0)} s** (speech ${durs[sec.id].speech_seconds.toFixed(1)} s with the Piper voice). Save a human recording as \`video/voice/${sec.id}.m4a\`.\n\n` +
    m.timeline.map((t) => `${t.beat + 1}. ${t.text}`).join("\n");
});
writeFileSync(join(HERE, "VOICEOVER.md"), `# Voiceover

Generated by \`video/assemble.mjs\` from \`video/script.json\`. Numbers in the lines are filled from the live app and \`eval/results.json\` and each is checked against the screen before it is spoken.
Voice: Piper \`${cfg.voice.name}\` (set in \`video/config.json\`). To use a human voice, record one file per section as \`video/voice/<section>.m4a\`
(about the target length), then run \`node video/build.mjs --from record\`: the sections with a human file are re-recorded and re-timed to it.

Total: **${Math.floor(finalSeconds / 60)}:${String(Math.round(finalSeconds % 60)).padStart(2, "0")}** including a ${titleSec} s title card and a ${endSec} s end card.

Numbers spoken, and where they come from:

| Number | Value | Source |
|---|---|---|
| Matches in Without / With | ${nums.ww.pairs} (${nums.ww.noid} without an AICTE ID) | \`GET /demo/without-with\` |
| Days since the other bureau asked | ${nums.check.days} | \`POST /cases/{id}/actions/check\` (nothing saved) |
| Stress test | ${nums.stress.samanvay} of ${nums.stress.total}; exact name ${nums.stress.exact}; ID only ${nums.stress.id}; ${nums.stress.misses} misses | \`GET /demo/stress-test\` (real matcher) |
| Baselines, ${nums.base.overlaps} overlaps | ID only ${nums.base.id}; exact name ${nums.base.exact} (${nums.base.exact_wrong} wrong); Samanvay ${nums.base.samanvay} (${nums.base.samanvay_wrong} wrong) | \`eval/results.json\` → \`baselines.seed42.all\` |
| Second dataset (never tuned on) | ${nums.seed43.found} of ${nums.seed43.overlaps}, ${nums.seed43.wrong} wrong | \`eval/results.json\` → \`baselines.unseen_seed43.all\` |

${rows.join("\n\n")}
`);
console.log(`flags: ${flags.length}`); flags.forEach((f) => console.log(" -", f));
