import { useState } from "react";
import { issueSentence, plainReasons } from "../evidence";
import ScoreBreakdown from "./ScoreBreakdown";
import { MatchStrength } from "./ui";

/** "Why we think it's the same college": ticked plain reasons, details behind a toggle. */
export default function Evidence({ link }) {
  const [open, setOpen] = useState(false);
  const reasons = plainReasons(link.scores, link.case_a, link.case_b);
  const issue = issueSentence(link.scores);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-semibold">Why we think it’s the same college</h3>
        <MatchStrength value={link.scores.final_confidence} />
      </div>
      <ul className="mt-4 space-y-3">
        {reasons.map((r) => (
          <li key={r} className="flex gap-3 text-lg">
            <span aria-hidden className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ok-wash font-semibold text-ok">
              ✓
            </span>
            {r}
          </li>
        ))}
      </ul>
      {issue && <p className="mt-4 text-lg text-ink-2">{issue}</p>}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="mt-5 text-base font-semibold text-ink underline decoration-line underline-offset-4 hover:decoration-ink"
      >
        {open ? "Hide details ▲" : "Show details ▼"}
      </button>
      {open && (
        <div className="mt-4 rounded-xl border border-line bg-sand p-5">
          <ScoreBreakdown scores={link.scores} />
        </div>
      )}
    </div>
  );
}
