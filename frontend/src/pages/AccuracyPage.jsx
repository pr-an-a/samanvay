import { Card, ErrorBox, Loading, PageTitle } from "../components/ui";
import { useApi } from "../hooks";

const COLUMNS = [
  ["before_fixes_test_half", "Before fixes", "test half"],
  ["after_fixes_test_half", "After fixes", "test half"],
  ["unseen_seed43", "Unseen data", "seed 43, no retuning"],
];

function fraction(x) {
  return `${x.found ?? x.rejected} / ${x.total}`;
}

const ROWS = [
  ["Precision", (r) => r.precision.toFixed(3), "Of the links suggested, how many were right"],
  ["Recall", (r) => r.recall.toFixed(3), "Of the real overlaps, how many were found"],
  ["F1", (r) => r.f1.toFixed(3), "Balance of the two"],
  ["Easy pairs found", (r) => fraction(r.tiers.easy), "Same permanent ID"],
  ["Medium pairs found", (r) => fraction(r.tiers.medium), "No ID, clean name"],
  ["Hard pairs found", (r) => fraction(r.tiers.hard), "No ID, misspelled / initials / abbreviated"],
  ["Decoys correctly rejected", (r) => fraction(r.decoys), "Different institutions with similar names or neighbouring campuses"],
  ["Wrong links on other pairs", (r) => `${r.background.false_positives} of ${r.background.pairs.toLocaleString("en-IN")}`, "Every other cross-bureau pair compared"],
];

export default function AccuracyPage() {
  const { data, error, loading } = useApi("/eval/results");
  if (error) return <ErrorBox error={error} />;
  if (loading || !data) return <Loading />;

  return (
    <div>
      <PageTitle sub="How well the overlap matcher finds the same institution across bureaus, measured on labelled synthetic data.">
        Matcher accuracy
      </PageTitle>

      <Card title="Results">
        <div className="overflow-x-auto">
          <table className="w-full text-lg">
            <thead>
              <tr className="border-b-2 border-line text-left">
                <th className="py-3 pr-4 font-semibold">Measure</th>
                {COLUMNS.map(([key, label, sub]) => (
                  <th key={key} className="px-4 py-3 text-right font-semibold">
                    {label}
                    <div className="text-base font-normal text-muted">{sub}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular">
              {ROWS.map(([label, get, help]) => (
                <tr key={label} className="border-b border-line/60">
                  <td className="py-3 pr-4">
                    <div className="font-medium">{label}</div>
                    <div className="text-base text-muted">{help}</div>
                  </td>
                  {COLUMNS.map(([key]) => {
                    const v = get(data[key]);
                    const before = key === "before_fixes_test_half";
                    return <td key={key} className={`px-4 py-3 text-right text-xl ${before ? "text-ink-2" : "font-semibold"}`}>{v}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-base text-ink-2">Link threshold {data.after_fixes_test_half.threshold}. {data.earlier_note}</p>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="What went wrong before the fixes">
          <ul className="space-y-3 text-lg">
            {data.before_fixes_test_half.misses.map((m) => (
              <li key={m.pair_id}>
                <span className="font-semibold">Missed {m.pair_id}</span> <span className="text-ink-2">({m.label}, confidence {m.confidence.toFixed(2)})</span>
                <div>{m.reason}</div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-base text-ink-2">
            After the fixes: {data.after_fixes_test_half.misses.length} misses and {data.after_fixes_test_half.false_positives.length} wrong
            links on the test half; {data.unseen_seed43.misses.length} misses and {data.unseen_seed43.false_positives.length} wrong links on the unseen data.
          </p>
        </Card>

        <Card title="Read these numbers with care" className="border-2 border-warning">
          <ul className="list-disc space-y-2 pl-6 text-lg">
            {data.caveats.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </Card>
      </div>
      <p className="mt-4 text-base text-muted">Generated {data.generated_on} by eval/build_results.py.</p>
    </div>
  );
}
