"""Build eval/results.json for the frontend's "Matcher accuracy" page.

Run from backend/:  python ../eval/build_results.py

"after" numbers are recomputed here in throwaway databases (so demo data added through the UI
never leaks in). "before" numbers were measured in step 3b with the step-3 matcher (commit
6f54f86) on the same data before its address fixes; that code no longer exists in the tree,
so they are recorded below verbatim from that run.
"""

import json
import os
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"

BEFORE_FIXES_TEST_HALF = {
    "source": "eval/evaluate.py --fixed, step-3 matcher (commit 6f54f86), step-3b data, threshold 0.78",
    "threshold": 0.78, "precision": 1.0, "recall": 0.833, "f1": 0.909, "tp": 20, "fp": 0, "fn": 4,
    "tiers": {"easy": {"found": 7, "total": 7}, "medium": {"found": 6, "total": 7}, "hard": {"found": 7, "total": 10}},
    "decoys": {"rejected": 12, "total": 12},
    "background": {"pairs": 2325, "false_positives": 0},
    "misses": [
        {"pair_id": "P018", "label": "medium", "confidence": 0.750,
         "reason": "Address without door number or pincode: the district was read as the street, so the address scored 0."},
        {"pair_id": "P031", "label": "hard", "confidence": 0.645,
         "reason": "Address missing on one side was scored 0 instead of being ignored."},
        {"pair_id": "P032", "label": "hard", "confidence": 0.737,
         "reason": "Same street-parsing bug as P018."},
        {"pair_id": "P038", "label": "hard", "confidence": 0.645,
         "reason": "Address missing on one side was scored 0 instead of being ignored."},
    ],
    "false_positives": [],
}

CAVEATS = [
    "All of this data is synthetic, made by our own generator. Real complaints will be messier, so expect lower scores.",
    "We wrote the matcher knowing how the generator misspells names and addresses, which makes these tests easier than real life.",
    "The 'unseen' dataset (seed 43) has new institutions and complaints, but the same kinds of mistakes. It shows consistency, not readiness for real data.",
    "Fixes were designed from the tune half's errors only. We looked at the test-half scores once before and once after the fixes.",
    "A perfect score does not mean the matcher is always right. Every link is only a suggestion until an officer confirms it.",
    "The 'same issue / different issue' label has no ground truth and has not been evaluated.",
    "When the address is missing on one side, the match rests on the name alone and is less certain.",
]


def run(env_db: str, *args: str) -> None:
    env = dict(os.environ, SAMANVAY_DB=env_db)
    subprocess.run([sys.executable, *args], cwd=BACKEND, env=env, check=True, stdout=subprocess.DEVNULL)


def evaluate(data_dir: str, truth: str, extra: list[str]) -> tuple[dict, dict]:
    """(summary, baselines) for one dataset, from a throwaway database."""
    with tempfile.TemporaryDirectory() as tmp:
        db, out, base = f"sqlite:///{tmp}/eval.db", Path(tmp) / "summary.json", Path(tmp) / "baselines.json"
        run(db, "-m", "app.seed", "--bare", "--data-dir", str(ROOT / data_dir))
        run(db, str(ROOT / "eval" / "evaluate.py"), "--truth", str(ROOT / "eval" / truth), "--json-out", str(out),
            "--baselines-out", str(base), *extra)
        return json.loads(out.read_text()), json.loads(base.read_text())


def main() -> None:
    after, base42 = evaluate("data/sources", "ground_truth.json", ["--fixed"])
    unseen, base43 = evaluate("data/sources_seed43", "ground_truth_seed43.json", ["--all"])
    results = {
        "generated_on": date.today().isoformat(),
        "earlier_note": ("On the first, easier version of the data (identical addresses on both sides of a true "
                         "pair), the step-3 matcher scored 1.0. Making the data realistic exposed the bugs below."),
        "before_fixes_test_half": BEFORE_FIXES_TEST_HALF,
        "after_fixes_test_half": dict(after, source="eval/evaluate.py --fixed, seed-42 test half"),
        "unseen_seed43": dict(unseen, source="eval/evaluate.py --all on seed-43 data, no retuning"),
        "baselines": {
            "note": ("Same pairs for every method. 'All overlaps' counts every planted overlap; the threshold was tuned on "
                     "half of them, so the held-out test half is shown too."),
            "seed42": base42, "unseen_seed43": base43,
        },
        "caveats": CAVEATS,
    }
    (ROOT / "eval" / "results.json").write_text(json.dumps(results, indent=2) + "\n")
    print(json.dumps({k: {m: v.get(m) for m in ("precision", "recall", "f1")} for k, v in results.items()
                      if isinstance(v, dict) and "f1" in v}, indent=1))


if __name__ == "__main__":
    main()
