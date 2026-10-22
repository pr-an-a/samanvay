"""Evaluate the overlap matcher against eval/ground_truth.json.

Run from backend/ after `python -m app.seed`:
    python ../eval/evaluate.py              # tune threshold on tune half, report test half
    python ../eval/evaluate.py --save       # also write the tuned threshold to matcher_config.json
    python ../eval/evaluate.py --show P031 D004
    python ../eval/evaluate.py --fixed                # no tuning: use the config threshold
    python ../eval/evaluate.py --half tune            # print details for the tune half (for diagnosis)
    SAMANVAY_DB=sqlite:///./unseen43.db python ../eval/evaluate.py --truth ../eval/ground_truth_seed43.json --fixed --all

Split: planted overlaps (stratified by tier) and decoys are split into tune/test halves by a hash
of their pair_id; every other candidate pair (background negatives) by a hash of its case IDs.
Only link_threshold is tuned, and only on the tune half. Weights stay as set in the config.
"""

import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from sqlalchemy import select  # noqa: E402

from app.db import SessionLocal  # noqa: E402
from app.matcher import CONFIG, CONFIG_PATH, score_candidates  # noqa: E402
from app.models import Case  # noqa: E402

TIERS = ["easy", "medium", "hard"]
GRID = [round(0.40 + 0.01 * i, 2) for i in range(60)]


def stable_hash(text: str) -> int:
    return int(hashlib.sha256(text.encode()).hexdigest(), 16)


def halves(items: list[dict]) -> dict[str, str]:
    ordered = sorted(items, key=lambda x: stable_hash("split:" + x["pair_id"]))
    k = (len(ordered) + 1) // 2
    return {x["pair_id"]: "tune" if i < k else "test" for i, x in enumerate(ordered)}


def build_rows(gt: dict, scored: dict, cases: dict) -> list[dict]:
    rows, labelled = [], set()
    groups = [(t, [p for p in gt["overlaps"] if p["tier"] == t]) for t in TIERS] + [("decoy", gt["decoys"])]
    for label, items in groups:
        split = halves(items)
        for p in items:
            key = frozenset((p["case_a"], p["case_b"]))
            labelled.add(key)
            a, b = cases[p["case_a"]], cases[p["case_b"]]
            s = scored.get(key)
            note = None
            if s is None:
                note = ("blocked: different region" if a.region != b.region
                        else "different permanent IDs" if a.institution_id and b.institution_id else "not eligible")
            rows.append({"label": label, "positive": label != "decoy", "half": split[p["pair_id"]],
                         "pair_id": p["pair_id"], "a": a, "b": b, "scores": s, "note": note,
                         "conf": s["final_confidence"] if s else 0.0})
    for key, s in scored.items():
        if key not in labelled:
            a, b = (cases[i] for i in sorted(key))
            rows.append({"label": "background", "positive": False,
                         "half": "tune" if stable_hash("bg:" + "|".join(sorted(key))) % 2 == 0 else "test",
                         "pair_id": None, "a": a, "b": b, "scores": s, "note": None, "conf": s["final_confidence"]})
    return rows


def metrics(rows: list[dict], t: float) -> dict:
    tp = sum(r["positive"] and r["conf"] >= t for r in rows)
    fp = sum(not r["positive"] and r["conf"] >= t for r in rows)
    pos = sum(r["positive"] for r in rows)
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / pos if pos else 0.0
    return {"tp": tp, "fp": fp, "fn": pos - tp, "precision": p, "recall": r,
            "f1": 2 * p * r / (p + r) if p + r else 0.0}


def tune(rows: list[dict]) -> tuple[float, list[float]]:
    f1 = {t: metrics(rows, t)["f1"] for t in GRID}
    best = max(f1.values())
    plateau = [t for t in GRID if abs(f1[t] - best) < 1e-9]
    # Middle of the best plateau rather than its edge: less tied to this particular half.
    return plateau[len(plateau) // 2], plateau


def describe(r: dict) -> str:
    return f"{r['a'].case_id} '{r['a'].raw_institution_name}'  <->  {r['b'].case_id} '{r['b'].raw_institution_name}'"


def key_scores(s: dict | None) -> str:
    if not s:
        return ""
    keys = ["name_similarity", "initials_match", "type_match", "honorific_match", "address_similarity", "district_match"]
    return " ".join(f"{k.split('_')[0]}={s[k]}" for k in keys)


def report(rows: list[dict], t: float) -> None:
    m = metrics(rows, t)
    print(f"Overall  precision {m['precision']:.3f}  recall {m['recall']:.3f}  F1 {m['f1']:.3f}  "
          f"(TP {m['tp']}, FP {m['fp']}, FN {m['fn']})")
    for tier in TIERS:
        rs = [r for r in rows if r["label"] == tier]
        print(f"  {tier:7} recall {sum(r['conf'] >= t for r in rs)}/{len(rs)}")
    ds = [r for r in rows if r["label"] == "decoy"]
    blocked = sum(r["note"] is not None for r in ds)
    print(f"  decoy   correctly rejected {sum(r['conf'] < t for r in ds)}/{len(ds)} "
          f"({blocked} never compared: different region; {len(ds) - blocked} scored)")
    bg = [r for r in rows if r["label"] == "background"]
    print(f"  background candidate pairs {len(bg)}, false positives {sum(r['conf'] >= t for r in bg)}")

    misses = sorted((r for r in rows if r["positive"] and r["conf"] < t), key=lambda r: -r["conf"])
    fps = sorted((r for r in rows if not r["positive"] and r["conf"] >= t), key=lambda r: -r["conf"])
    print(f"\nMisses ({len(misses)}):")
    for r in misses:
        print(f"  {r['pair_id']} [{r['label']}] conf={r['conf']:.3f} {r['note'] or ''}\n    {describe(r)}\n    {key_scores(r['scores'])}")
    print(f"\nFalse positives ({len(fps)}):")
    for r in fps:
        print(f"  {r['pair_id'] or '-'} [{r['label']}] conf={r['conf']:.3f}\n    {describe(r)}\n    {key_scores(r['scores'])}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--save", action="store_true", help="write tuned threshold to matcher_config.json")
    ap.add_argument("--show", nargs="*", default=[], help="print full score breakdowns for these pair_ids")
    ap.add_argument("--fixed", action="store_true", help="skip tuning; use link_threshold from the config")
    ap.add_argument("--half", choices=["test", "tune"], default="test", help="which half to report in detail")
    ap.add_argument("--all", action="store_true", help="report on all pairs (for unseen data; implies --fixed)")
    ap.add_argument("--truth", type=Path, default=ROOT / "eval" / "ground_truth.json")
    args = ap.parse_args()

    gt = json.loads(args.truth.read_text())
    with SessionLocal() as db:
        all_cases = list(db.scalars(select(Case)))
        cases = {c.case_id: c for c in all_cases}
        scored = {frozenset((a.case_id, b.case_id)): s for a, b, s in score_candidates(all_cases)}
        rows = build_rows(gt, scored, cases)

        tune_rows = [r for r in rows if r["half"] == "tune"]
        test_rows = [r for r in rows if r["half"] == "test"]
        print(f"Candidate pairs scored: {len(scored)}  (tune half rows {len(tune_rows)}, test half rows {len(test_rows)})")
        if args.fixed or args.all:
            t = CONFIG["link_threshold"]
            print(f"Using config link_threshold {t} (no tuning)")
        else:
            t, plateau = tune(tune_rows)
            print(f"Tuned link_threshold on TUNE half: {t}  (best-F1 plateau {plateau[0]}-{plateau[-1]}); "
                  f"config currently {CONFIG['link_threshold']}")
        m = metrics(tune_rows, t)
        print(f"Tune half: precision {m['precision']:.3f} recall {m['recall']:.3f} F1 {m['f1']:.3f}\n")
        if args.all:
            print("=== ALL PAIRS ===")
            report(rows, t)
        else:
            print(f"=== {args.half.upper()} HALF ===")
            report(test_rows if args.half == "test" else tune_rows, t)

        for pid in args.show:
            r = next(r for r in rows if r["pair_id"] == pid)
            print(f"\n=== {pid} [{r['label']}, {r['half']} half] {'LINKED' if r['conf'] >= t else 'not linked'} ===")
            print(describe(r))
            print(json.dumps(r["scores"], indent=2) if r["scores"] else f"not scored: {r['note']}")

    if args.save and not (args.fixed or args.all):
        cfg = json.loads(CONFIG_PATH.read_text())
        cfg["link_threshold"] = t
        CONFIG_PATH.write_text(json.dumps(cfg, indent=2) + "\n")
        print(f"\nSaved link_threshold={t} to {CONFIG_PATH}")


if __name__ == "__main__":
    main()
