"""Piper voiceover, one wav per sentence (so each sentence can be placed exactly where it is spoken on screen).

  video/.venv/bin/python video/tts.py        # reads script.json + out/numbers.json, writes out/audio/<section>/<n>.wav
                                              # and out/audio/durations.json

If video/voice/<section>.m4a exists, its duration is recorded as the human-voice override for that section.
"""
import json, re, subprocess, wave
from pathlib import Path

from piper import PiperVoice, SynthesisConfig

HERE = Path(__file__).resolve().parent
cfg = json.loads((HERE / "config.json").read_text())
script = json.loads((HERE / "script.json").read_text())
nums = json.loads((HERE / "out" / "numbers.json").read_text())
v = cfg["voice"]


def fill(text):
    def get(m):
        cur = nums
        for k in m.group(1).split("."):
            cur = cur[k]
        return str(cur)
    return re.sub(r"\{([\w.]+)\}", get, text)


def spoken(text):
    for word, say in v["say_as"].items():
        text = re.sub(rf"\b{re.escape(word)}\b", say, text)
    return text


voice = PiperVoice.load(str(HERE / v["model"]))
syn = SynthesisConfig(length_scale=v["length_scale"], noise_scale=v["noise_scale"], noise_w_scale=v["noise_w_scale"])
out = {}
for sec in script["sections"]:
    d = HERE / "out" / "audio" / sec["id"]
    d.mkdir(parents=True, exist_ok=True)
    rows = []
    for i, line in enumerate(sec["lines"]):
        shown = fill(line)
        path = d / f"{i}.wav"
        with wave.open(str(path), "wb") as w:
            voice.synthesize_wav(spoken(shown), w, syn_config=syn)
        with wave.open(str(path)) as w:
            rows.append({"text": shown, "file": str(path.relative_to(HERE)), "seconds": round(w.getnframes() / w.getframerate(), 3)})
    human = HERE / "voice" / f"{sec['id']}.m4a"
    entry = {"sentences": rows, "speech_seconds": round(sum(r["seconds"] for r in rows) + v["sentence_gap_seconds"] * (len(rows) - 1), 2)}
    if human.exists():
        dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(human)],
                                   capture_output=True, text=True).stdout)
        entry["human"] = {"file": str(human.relative_to(HERE)), "seconds": round(dur, 3)}
    out[sec["id"]] = entry
    print(f"{sec['id']:14s} {entry['speech_seconds']:5.1f}s  {len(rows)} sentences" + ("  (human voice found)" if "human" in entry else ""))
(HERE / "out" / "audio" / "durations.json").write_text(json.dumps(out, indent=2) + "\n")
print("total speech", round(sum(e["speech_seconds"] for e in out.values()), 1), "s")
