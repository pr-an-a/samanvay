// The matcher's score breakdown as labelled bars. Institution signals decide the match; issue
// signals only label it, so they are shown separately.

const INSTITUTION_SIGNALS = [
  ["id_match", "Same permanent ID"],
  ["name_similarity", "Name similarity"],
  ["initials_match", "Initials vs full name"],
  ["type_match", "Institution type"],
  ["honorific_match", "Honorific (Sri / Smt / Dr)"],
  ["address_similarity", "Address"],
  ["district_match", "District"],
  ["region_match", "Region"],
];
const ISSUE_SIGNALS = [
  ["text_similarity", "Description similarity"],
  ["category_match", "Same category"],
];

function Bar({ label, value, strong = false }) {
  const missing = value === null || value === undefined;
  return (
    <div className="grid grid-cols-[minmax(10rem,14rem)_1fr_4.5rem] items-center gap-3 py-1.5">
      <div className={`text-lg ${strong ? "font-semibold text-ink" : "text-ink-2"}`}>{label}</div>
      <div className="h-5 rounded bg-page" title={missing ? "Not available" : value.toFixed(3)}>
        {!missing && (
          <div
            className="h-5 rounded-r"
            style={{ width: `${Math.max(value * 100, 1)}%`, background: strong ? "var(--color-brand)" : "var(--color-rb)" }}
          />
        )}
      </div>
      <div className="tabular text-right text-lg text-ink">
        {missing ? <span className="text-base text-muted">n/a</span> : value.toFixed(2)}
      </div>
    </div>
  );
}

export default function ScoreBreakdown({ scores }) {
  return (
    <div>
      <Bar label="Overall confidence" value={scores.final_confidence} strong />
      <p className="mb-3 mt-1 text-base text-muted">
        {scores.match_tier === "id"
          ? "Matched on the AICTE permanent ID (tier 1)."
          : "No shared permanent ID: matched on institution details (tier 2). “n/a” means the field is missing on one side and is not counted."}
      </p>
      <h3 className="mt-4 text-lg font-semibold text-ink">Institution evidence</h3>
      {INSTITUTION_SIGNALS.map(([key, label]) => (
        <Bar key={key} label={label} value={scores[key]} />
      ))}
      <h3 className="mt-5 text-lg font-semibold text-ink">Issue similarity</h3>
      <p className="text-base text-muted">Labels the link only; it never decides whether the institutions match.</p>
      {ISSUE_SIGNALS.map(([key, label]) => (
        <Bar key={key} label={label} value={scores[key]} />
      ))}
    </div>
  );
}
