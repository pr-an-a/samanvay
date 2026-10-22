import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Bureau, Button, Card, ErrorBox, Loading, PageTitle, Status } from "../components/ui";
import { useApi, useSlaSettings } from "../hooks";
import { BUREAUS, CATEGORIES, SLA_NOTE, formatDate, plainAction } from "../labels";

function EscalateRow({ c, onDone }) {
  const [open, setOpen] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function escalate() {
    setBusy(true);
    setError(null);
    try {
      await api(`/cases/${c.id}/escalate`, { method: "POST", body: { remarks: remarks.trim() || null } });
      onDone(c);
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  return (
    <>
      <tr className="border-t border-line align-top">
        <td className="px-4 py-3">
          <Link to={`/cases/${c.id}`} className="text-ink underline decoration-line underline-offset-4 hover:decoration-ink">{c.case_id}</Link>
          <div className="mt-1"><Bureau code={c.source_bureau} /></div>
        </td>
        <td className="px-4 py-3 text-lg">{c.raw_institution_name}</td>
        <td className="whitespace-nowrap px-4 py-3">
          <div className="tabular">{formatDate(c.expected_disposal_date)}</div>
          <div className="font-semibold text-late">{c.days_overdue} days overdue</div>
        </td>
        <td className="px-4 py-3">
          <Status status={c.status} />
          <div className="text-ink-2">{plainAction(c.last_action)}</div>
        </td>
        <td className="px-4 py-3 text-right">
          {!open && <Button onClick={() => setOpen(true)}>Escalate</Button>}
        </td>
      </tr>
      {open && (
        <tr className="bg-sand">
          <td colSpan={5} className="px-4 pb-4 pt-1">
            <label className="block text-base text-ink-2" htmlFor={`r-${c.id}`}>
              Note for the senior officer (recorded in the case history and audit log)
            </label>
            <textarea
              id={`r-${c.id}`}
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-surface p-3 text-lg"
              placeholder={`e.g. No progress for ${c.days_overdue} days; needs a decision`}
            />
            <div className="mt-3 flex gap-3">
              <Button onClick={escalate} disabled={busy}>{busy ? "Escalating…" : `Escalate ${c.case_id}`}</Button>
              <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            </div>
            <div className="mt-2"><ErrorBox error={error} /></div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function EscalationsPage() {
  const settings = useSlaSettings();
  const [days, setDays] = useState("");
  const threshold = days === "" ? settings?.escalate_after_days_overdue : Number(days);
  const { data, error, loading, reload } = useApi(settings ? `/sla/escalations?min_days_overdue=${threshold}` : null);
  const [done, setDone] = useState([]);
  const [shown, setShown] = useState(20);

  return (
    <div className="space-y-6">
      <PageTitle sub="Open cases that are well past their due date. Escalating sends the case to a senior officer and is recorded in the audit log.">
        Escalations
      </PageTitle>

      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1.5 text-base text-ink-2">
            Show cases overdue by more than
            <span className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={days === "" ? threshold ?? "" : days}
                onChange={(e) => setDays(e.target.value)}
                className="w-24 rounded-lg border border-line px-3 py-2 text-lg"
              />
              <span className="text-lg text-ink">days</span>
            </span>
          </label>
          <p className="text-base text-muted">{SLA_NOTE}</p>
        </div>
        {done.length > 0 && (
          <p role="status" className="mt-4 rounded-lg bg-ok-wash px-4 py-3 text-lg text-ok">
            ✓ Escalated: {done.map((c) => c.case_id).join(", ")}
          </p>
        )}
      </Card>

      <ErrorBox error={error} />
      {loading || !data ? (
        <Loading />
      ) : (
        <Card title={`${data.cases.length} case${data.cases.length === 1 ? "" : "s"} to consider`} sub="Most overdue first.">
          {data.cases.length === 0 ? (
            <p className="text-lg text-ink-2">No open case is that far past its due date.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-base">
                <thead className="text-left text-ink-2">
                  <tr>
                    {["Case", "College", "Due date", "Status and last action", ""].map((h) => (
                      <th key={h} className="px-4 pb-3 font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.cases.slice(0, shown).map((c) => (
                    <EscalateRow
                      key={c.id}
                      c={c}
                      onDone={(x) => {
                        setDone((d) => [...d, x]);
                        reload();
                      }}
                    />
                  ))}
                </tbody>
              </table>
              {shown < data.cases.length && (
                <div className="mt-4 text-center">
                  <Button variant="secondary" onClick={() => setShown(shown + 20)}>
                    Show more ({data.cases.length - shown} remaining)
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {settings && (
        <Card title="Time limits used" sub={`${SLA_NOTE} Days from receiving a complaint to its due date.`}>
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead className="text-left text-ink-2">
                <tr>
                  <th className="pb-2 font-normal">Complaint about</th>
                  {Object.entries(BUREAUS).map(([k, b]) => <th key={k} className="pb-2 text-right font-normal">{b.name}</th>)}
                </tr>
              </thead>
              <tbody className="tabular">
                {Object.entries(CATEGORIES).map(([cat, label]) => (
                  <tr key={cat} className="border-t border-line">
                    <td className="py-2">{label}</td>
                    {Object.keys(BUREAUS).map((b) => (
                      <td key={b} className="py-2 text-right">
                        {settings.rules.find((r) => r.bureau === b && r.category === cat)?.days ?? "—"} days
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-base text-muted">
            “Due soon” means due within {settings.due_soon_days} days.{" "}
            {settings.automatic_checks
              ? `The time-limit check runs every ${settings.check_interval_minutes} minutes.`
              : "Demo mode: the time-limit check runs only when someone presses “Run check now”."}
          </p>
        </Card>
      )}
    </div>
  );
}
