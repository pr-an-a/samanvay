import { useEffect, useState } from "react";
import { Card, ErrorBox, Loading, PageTitle } from "../components/ui";
import { useApi } from "../hooks";

const METHODS = [
  ["id_only", "AICTE ID only", "Needs the ID on both complaints", "bg-chart-sand"],
  ["exact_name", "Exact name", "Same name, ignoring capitals and punctuation", "bg-chart-taupe"],
  ["samanvay", "Samanvay", "Name, address, district and more, with a score breakdown", "bg-ink"],
];

/** Horizontal bars that grow when the page appears. All numbers come from eval/results.json (computed, not typed). */
function Baselines({ data }) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGrown(true), 150);
    return () => clearTimeout(t);
  }, []);
  const b = data.baselines.seed42;
  const all = b.all, half = b.test_half;
  const u = data.baselines.unseen_seed43.all.methods;
  return (
    <Card data-tour-target="baseline" title="Samanvay compared with simpler methods" sub="The same pairs of cases for every method.">
      <p className="text-xl font-semibold">Overlaps found, out of {all.overlaps} real same-college pairs</p>
      <ul className="mt-4 space-y-5">
        {METHODS.map(([key, label, help, colour], i) => {
          const m = all.methods[key];
          return (
            <li key={key}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <span className="text-lg font-semibold">{label} <span className="text-base font-normal text-muted">{help}</span></span>
                <span className="tabular text-lg"><span className="font-semibold">Found {m.found} of {all.overlaps}</span> · {m.false_positives} wrong {m.false_positives === 1 ? "match" : "matches"}</span>
              </div>
              <div className="mt-1.5 h-5 w-full overflow-hidden rounded-full bg-sand" role="img" aria-label={`${label} found ${m.found} of ${all.overlaps}`}>
                <div
                  className={`bar-grow h-5 rounded-full ${colour}`}
                  style={{ width: grown ? `${(m.found / all.overlaps) * 100}%` : "0%", transition: `width 1200ms ease-out ${i * 200}ms` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-5 text-base text-ink-2">
        Wrong matches are counted over the {all.non_overlap_pairs.toLocaleString("en-IN")} pairs that are not the same college (look-alikes and every other pair compared).
        On the held-out test half alone ({half.overlaps} pairs, never used to set the threshold): AICTE ID only {half.methods.id_only.found}, exact name {half.methods.exact_name.found}, Samanvay {half.methods.samanvay.found}.
      </p>
      <p className="mt-3 rounded-lg bg-sand px-4 py-3 text-lg" data-testid="second-dataset">
        <span className="font-semibold">A second dataset the matcher was never tuned on</span> (new colleges and complaints, same kinds of mistakes):
        Samanvay found <span className="font-semibold">{u.samanvay.found} of {data.baselines.unseen_seed43.all.overlaps}</span> with {u.samanvay.false_positives} wrong {u.samanvay.false_positives === 1 ? "match" : "matches"}.
        AICTE ID only found {u.id_only.found}; exact name found {u.exact_name.found}, with {u.exact_name.false_positives} wrong.
      </p>
      <p className="mt-2 text-base text-muted" data-testid="caveat">
        Synthetic data made by our own generator, with mistakes we designed. Real complaints will be messier, so expect lower scores for Samanvay too.
      </p>
    </Card>
  );
}

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

      <Baselines data={data} />

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

      <div className="grid gap-5 lg:grid-cols-2">
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

        <Card title="Please read these numbers with care" className="bg-sand">
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
