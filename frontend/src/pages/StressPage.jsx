import { useEffect, useRef, useState } from "react";
import { Card, ErrorBox, Loading, PageTitle, Button } from "../components/ui";
import { useApi } from "../hooks";
import { bureauName, percent } from "../labels";
import { useVideoCaption } from "../video";

const STEP_MS = 150;

function Mark({ ok, shown, children }) {
  return (
    <span className={`inline-flex items-center gap-1.5 transition-opacity duration-200 ${shown ? "opacity-100" : "opacity-0"}`}>
      <span aria-hidden className={`font-semibold ${ok ? "text-ink" : "text-late"}`}>{ok ? "✓" : "✕"}</span>
      <span className={ok ? "text-ink" : "text-ink-2"}>{children}</span>
    </span>
  );
}

export default function StressPage() {
  const { data, error, loading } = useApi("/demo/stress-test");
  const [shown, setShown] = useState(0); // rows revealed so far
  const [running, setRunning] = useState(false);
  const timer = useRef(null);
  const newest = useRef(null);
  const rows = data?.variants ?? [];
  const done = data && shown >= rows.length;
  const t = data?.totals;
  const score = t && `Samanvay ${t.samanvay}/${t.total} · Exact name ${t.exact_name}/${t.total} · ID-only ${t.id_only}/${t.total}`;
  useVideoCaption(done ? score : "Twenty ways to misspell one college. The real matcher, row by row.", "stress-table");
  useEffect(() => () => clearInterval(timer.current), []);
  // Keep the row being revealed in view, above the video caption bar.
  useEffect(() => {
    if (shown) newest.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [shown]);

  function run() {
    clearInterval(timer.current);
    setShown(0);
    setRunning(true);
    let n = 0;
    timer.current = setInterval(() => {
      n += 1;
      setShown(n);
      if (n >= rows.length) {
        clearInterval(timer.current);
        setRunning(false);
      }
    }, STEP_MS);
  }

  if (error) return <ErrorBox error={error} />;
  if (loading || !data) return <Loading />;
  const failed = rows.filter((r) => !r.samanvay);
  const tally = (key) => rows.slice(0, shown).filter((r) => r[key]).length;

  return (
    <div className="space-y-6">
      <PageTitle
        sub={`${data.college}: the ${bureauName(data.other_bureau)} has case ${data.other_case} on this college. Each line below is a new Grievance Cell complaint that writes the name differently and gives no AICTE ID.`}
        actions={<Button size="lg" onClick={run} disabled={running}>{running ? "Running…" : shown ? "Run again" : "Run"}</Button>}
      >
        Stress test
      </PageTitle>

      <Card data-tour-target="stress-table" className="!p-0 overflow-hidden">
        <table className="w-full">
          <thead className="bg-sand text-left text-base text-ink-2">
            <tr>
              <th className="px-5 py-1.5 font-normal">Name as written</th>
              <th className="px-3 py-3 font-normal">What is different</th>
              <th className="px-3 py-3 font-semibold text-ink">Samanvay</th>
              <th className="px-3 py-3 font-normal">Exact name</th>
              <th className="px-3 py-3 font-normal">AICTE ID only</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const on = i < shown;
              return (
                <tr key={r.name + r.what} ref={i === shown - 1 ? newest : null}
                  className={`scroll-mb-32 border-t border-line transition-colors duration-300 ${on && !r.samanvay ? "bg-late-wash" : ""}`}>
                  <td className="px-5 py-1 text-base font-semibold">{r.name}</td>
                  <td className="px-3 py-1 text-base text-ink-2">{r.what}{!r.district_given && " (no district)"}</td>
                  <td className="tabular whitespace-nowrap px-3 py-1 text-base"><Mark ok={r.samanvay} shown={on}>{percent(r.strength)} match</Mark></td>
                  <td className="whitespace-nowrap px-3 py-1 text-base"><Mark ok={r.exact_name} shown={on}>{r.exact_name ? "found" : "missed"}</Mark></td>
                  <td className="whitespace-nowrap px-3 py-1 text-base"><Mark ok={r.id_only} shown={on}>{r.id_only ? "found" : "missed"}</Mark></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-line bg-sand text-base">
            <tr>
              <td className="px-5 py-2 font-semibold" colSpan={2}>{shown ? (done ? "Final score" : "Running score") : "Press Run"}</td>
              <td className="tabular px-3 py-3 font-semibold">{shown ? `${tally("samanvay")} of ${rows.length}` : ""}</td>
              <td className="tabular px-3 py-3">{shown ? `${tally("exact_name")} of ${rows.length}` : ""}</td>
              <td className="tabular px-3 py-3">{shown ? `${tally("id_only")} of ${rows.length}` : ""}</td>
            </tr>
          </tfoot>
        </table>
      </Card>

      {done && (
        <>
          <p className="text-center text-3xl font-semibold" role="status">{score}</p>
          {failed.length > 0 && (
            <Card title={`Where Samanvay missed (${failed.length} of ${rows.length})`} sub={`A match needs at least ${percent(data.threshold)} strength. These fell short, so no warning would be raised.`}>
              <ul className="space-y-3 text-lg">
                {failed.map((r) => (
                  <li key={r.name + r.what}>
                    <span className="font-semibold">{r.name}</span> <span className="text-ink-2">({r.what}{!r.district_given && ", no district"})</span>: {percent(r.strength)} match
                    {r.reasons.length > 0 && <div className="text-base text-ink-2">{r.reasons[1] || r.reasons[0]}</div>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
      <p className="text-base text-muted">
        This runs the real matcher on each name; nothing is saved. The variants were written once, before running, and none were removed. “Exact name” ignores capital letters and punctuation, nothing more. All data is synthetic, and the name styles are ones we thought of, so real complaints will be messier.
      </p>
    </div>
  );
}
