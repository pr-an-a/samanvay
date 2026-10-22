import { Card, ErrorBox, Loading, PageTitle } from "../components/ui";
import { useApi } from "../hooks";

const COLUMNS = [
  ["before_fixes_test_half", "Before fixes", "test set"],
  ["after_fixes_test_half", "After fixes", "test set"],
  ["unseen_seed43", "New data", "never used for tuning"],
];

const frac = (x) => `${x.found ?? x.rejected} of ${x.total}`;
const pct = (x) => `${Math.round(x * 100)}%`;

const ROWS = [
  ["Warnings that were right", (r) => pct(r.precision), "Precision: of the matches shown, how many were really the same college"],
  ["Same-college cases found", (r) => pct(r.recall), "Recall: of the real same-college pairs, how many were found"],
  ["Easy pairs found", (r) => frac(r.tiers.easy), "Both complaints give the AICTE ID"],
  ["Medium pairs found", (r) => frac(r.tiers.medium), "No ID, name spelled correctly"],
  ["Hard pairs found", (r) => frac(r.tiers.hard), "No ID, misspelled, abbreviated or initials only"],
  ["Look-alike colleges correctly kept apart", (r) => frac(r.decoys), "Similar names, or neighbouring campuses"],
  ["Wrong warnings on all other pairs", (r) => `${r.background.false_positives} of ${r.background.pairs.toLocaleString("en-IN")}`, "Every other pair of cases compared"],
];

export default function AccuracyPage() {
  const { data, error, loading } = useApi("/eval/results");
  if (error) return <ErrorBox error={error} />;
  if (loading || !data) return <Loading />;

  return (
    <div className="space-y-6">
      <PageTitle sub="We tested the matching on made-up complaints where we know the right answer.">How accurate is matching?</PageTitle>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-lg">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="py-3 pr-4 font-normal text-ink-2">Measure</th>
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
                <tr key={label} className="border-b border-line/70">
                  <td className="py-4 pr-4">
                    <div>{label}</div>
                    <div className="text-base text-muted">{help}</div>
                  </td>
                  {COLUMNS.map(([key]) => (
                    <td key={key} className={`px-4 py-4 text-right text-xl ${key === "before_fixes_test_half" ? "text-ink-2" : "font-semibold"}`}>
                      {get(data[key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="What went wrong before the fixes">
          <ul className="space-y-4 text-lg">
            {data.before_fixes_test_half.misses.map((m) => (
              <li key={m.pair_id}>
                <span className="font-semibold">Missed a {m.label} pair ({m.pair_id})</span>
                <div className="text-ink-2">{m.reason}</div>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-base text-muted">{data.earlier_note}</p>
        </Card>

        <Card title="Please read these numbers with care" className="border-amber-line bg-amber-wash">
          <ul className="list-disc space-y-2 pl-6 text-lg">
            {data.caveats.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </Card>
      </div>
      <p className="text-base text-muted">
        Matching threshold {data.after_fixes_test_half.threshold}. Generated {data.generated_on} by eval/build_results.py.
      </p>
    </div>
  );
}
