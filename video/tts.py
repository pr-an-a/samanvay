"""Voiceover, one wav per sentence (so each sentence can be placed exactly where it is spoken on screen).

  <python of the engine> video/tts.py        # reads script.json + out/numbers.json, writes out/audio/<section>/<n>.wav
                                              # and out/audio/durations.json

build.mjs picks the interpreter: voice.engine "kokoro" (voice.python, the Python 3.12 venv) or "piper" (video/.venv).
The voice and the pronunciation map come from video/config.json. Pronunciations change the TTS INPUT ONLY: captions, subtitles and
the SRT keep the correct spelling. If video/voice/<section>.m4a exists, its duration is recorded as the human-voice override.
"""
import json, re, subprocess, wave
from pathlib import Path

HERE = Path(__file__).resolve().parent
cfg = json.loads((HERE / "config.json").read_text())
script = json.loads((HERE / "script.json").read_text())
nums = json.loads((HERE / "out" / "numbers.json").read_text())
v = cfg["voice"]
ENGINE = v.get("engine", "piper")


def pronunciations():
    """Every pronunciation map found in the config, later ones win: {written form: how to say it}."""
    found = {}
    for source in (cfg.get("pronunciations"), cfg.get("pronunciation_map"), cfg.get("say_as"),
                   v.get("say_as"), v.get("pronunciations"), v.get("pronunciation_map"), v.get("pronunciation")):
        if isinstance(source, dict):
            found.update({k: str(val) for k, val in source.items()})
    return found


def fill(text):
    def get(m):
        cur = nums
        for k in m.group(1).split("."):
            cur = cur[k]
        return str(cur)
    return re.sub(r"\{([\w.]+)\}", get, text)


PRON = pronunciations()


def spoken(text):
    """The text as it is fed to the voice (not as it is shown)."""
    for word in sorted(PRON, key=len, reverse=True):
        flags = 0 if word.isupper() or not word.islower() else re.IGNORECASE
        text = re.sub(rf"(?<![\w]){re.escape(word)}(?![\w])", PRON[word].replace("\\", "\\\\"), text, flags=flags)
    return text


def make_synth():
    """Returns synth(text, pace, path): writes a wav. pace > 1 means slower than the configured voice."""
    if ENGINE == "kokoro":
        import numpy as np, soundfile as sf
        from kokoro import KPipeline
        pipe = KPipeline(lang_code=v.get("lang_code", "a"), repo_id=v.get("repo_id", "hexgrad/Kokoro-82M"))
        def synth(text, pace, path):
            chunks = [r[2].numpy() for r in pipe(text, voice=v["name"], speed=v.get("speed", 1.0) / pace)]
            sf.write(str(path), np.concatenate(chunks), v.get("sample_rate", 24000))
        return synth
    from piper import PiperVoice, SynthesisConfig
    model = v.get("model") or v.get("model_path") or f"voices/{v['name']}.onnx"
    voice = PiperVoice.load(str(HERE / model))
    def synth(text, pace, path):
        syn = SynthesisConfig(length_scale=v.get("length_scale", 1.08) * pace, noise_scale=v.get("noise_scale", 0.6),
                              noise_w_scale=v.get("noise_w_scale", 0.7), speaker_id=v.get("speaker_id"))
        with wave.open(str(path), "wb") as w:
            voice.synthesize_wav(text, w, syn_config=syn)
    return synth


synth = make_synth()
out = {}
for sec in script["sections"]:
    d = HERE / "out" / "audio" / sec["id"]
    d.mkdir(parents=True, exist_ok=True)
    for old in d.glob("*.wav"):
        old.unlink()
    rows = []
    for i, line in enumerate(sec["lines"]):
        shown = fill(line)
        path = d / f"{i}.wav"
        synth(spoken(shown), sec.get("pace", 1.0), path)
        with wave.open(str(path)) as w:
            rows.append({"text": shown, "spoken_as": spoken(shown), "file": str(path.relative_to(HERE)), "seconds": round(w.getnframes() / w.getframerate(), 3)})
    human = HERE / "voice" / f"{sec['id']}.m4a"
    gap = v.get("sentence_gap_seconds", 0.25)
    entry = {"sentences": rows, "speech_seconds": round(sum(r["seconds"] for r in rows) + gap * (len(rows) - 1), 2)}
    if human.exists():
        dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(human)],
                                   capture_output=True, text=True).stdout)
        entry["human"] = {"file": str(human.relative_to(HERE)), "seconds": round(dur, 3)}
    out[sec["id"]] = entry
    print(f"{sec['id']:14s} {entry['speech_seconds']:5.1f}s  {len(rows)} sentences" + ("  (human voice found)" if "human" in entry else ""))
(HERE / "out" / "audio" / "durations.json").write_text(json.dumps(out, indent=2) + "\n")
print("voice:", ENGINE, v.get("name"), "| pronunciations:", len(PRON), "| total speech", round(sum(e["speech_seconds"] for e in out.values()), 1), "s")
