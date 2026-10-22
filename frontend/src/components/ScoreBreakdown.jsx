// Detailed match evidence: labelled bars plus the matcher's own technical reasons.
// Shown behind a "Show details" toggle; the plain ticked reasons come first.

const COLLEGE_SIGNALS = [
  ["id_match", "Same AICTE ID"],
  ["name_similarity", "College name"],
  ["initials_match", "Short form vs full name"],
  ["type_match", "Type of college"],
  ["honorific_match", "Title (Sri / Smt / Dr)"],
  ["address_similarity", "Address"],
  ["district_match", "District"],
  ["region_match", "Region"],
];
const ISSUE_SIGNALS = [
  ["text_similarity", "Complaint wording"],
  ["category_match", "Same complaint topic"],
];

function Bar({ label, value }) {
  const missing = value === null || value === undefined;
  return (
    <div className="grid grid-cols-[13rem_1fr_3.5rem] items-center gap-4 py-1.5">
      <div className="text-base text-ink-2">{label}</div>
      <div className="h-3 rounded-full bg-page">
        {!missing && <div className="h-3 rounded-full bg-accent" style={{ width: `${Math.max(value * 100, 2)}%` }} />}
      </div>
      <div className="tabular text-right text-base text-ink">{missing ? <span className="text-muted">n/a</span> : `${Math.round(value * 100)}%`}</div>
    </div>
  );
}

export default function ScoreBreakdown({ scores }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Is it the same college?</h3>
        <p className="mb-2 text-base text-muted">
          {scores.match_tier === "id" ? "Decided by the AICTE ID." : "No shared AICTE ID, so these details were compared."} “n/a” means
          the detail is missing on one side and is not counted.
        </p>
        {COLLEGE_SIGNALS.map(([k, l]) => <Bar key={k} label={l} value={scores[k]} />)}
      </div>
      <div>
        <h3 className="text-lg font-semibold">Is it the same problem?</h3>
        <p className="mb-2 text-base text-muted">For information only. This never decides whether it is the same college.</p>
        {ISSUE_SIGNALS.map(([k, l]) => <Bar key={k} label={l} value={scores[k]} />)}
      </div>
      <div>
        <h3 className="text-lg font-semibold">Matcher notes</h3>
        <ul className="mt-2 list-disc space-y-1 pl-6 text-base text-ink-2">
          {scores.reasons.map((r) => <li key={r}>{r}</li>)}
        </ul>
      </div>
    </div>
  );
}
