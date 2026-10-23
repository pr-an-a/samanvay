import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useApi } from "../hooks";
import { BUREAUS, bureauName } from "../labels";
import { useTour } from "../tour";
import CheckPanel from "./CheckPanel";
import { ThreadMark } from "./threads";
import { Button, Card, ErrorBox } from "./ui";

const INPUT = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-lg text-ink";
const NEEDS_ASKING = ["seek_reply", "request_documents", "show_cause"];
const DEMO_EXAMPLE = { kind: "seek_reply", asking_for: "Laboratory equipment list and the latest inspection report" };

/** "New action" on a case. Before anything is saved, Samanvay checks it against the same college's cases at other bureaus. */
export default function ActionForm({ caseItem, links = [], onSaved }) {
  const { user } = useAuth();
  const tour = useTour();
  const { data: kinds } = useApi(`/cases/${caseItem.id}/actions/kinds`);
  const [form, setForm] = useState({ kind: "", asking_for: "", transfer_to: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [sent, setSent] = useState(null);
  const [panel, setPanel] = useState(null); // { draft, clashes }
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const label = kinds?.actions.find((a) => a.kind === form.kind)?.label;
  const mine = user?.role === "ADMIN" || user?.bureau === caseItem.source_bureau;

  if (caseItem.status === "disposed") return null;
  if (!mine) {
    return (
      <Card title="New action">
        <p className="text-base text-muted">Only the {bureauName(caseItem.source_bureau)} (and the Administrator) can act on this case.</p>
      </Card>
    );
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSent(null);
    const body = { kind: form.kind, asking_for: form.asking_for.trim() || null, transfer_to: form.kind === "transfer" ? form.transfer_to : null };
    try {
      const { clashes, checked } = await api(`/cases/${caseItem.id}/actions/check`, { method: "POST", body });
      if (clashes.length) {
        setPanel({ draft: { ...body, label }, clashes });
        tour.reach(3);
      } else {
        await api(`/cases/${caseItem.id}/actions`, { method: "POST", body });
        setSent(`Sent: ${label.toLowerCase()}. Checked against ${checked.length} linked case${checked.length === 1 ? "" : "s"} at other bureaus: no clash.`);
        setForm({ kind: "", asking_for: "", transfer_to: "" });
        onSaved();
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card data-tour-target="new-action" title="New action" sub="Samanvay checks it against other bureaus’ cases on the same college before it is saved."
      actions={tour.active && tour.step <= 3 && (
        <Button variant="secondary" onClick={() => setForm({ ...form, ...DEMO_EXAMPLE })}>Use demo example</Button>
      )}>
      {(() => {
        const others = links.filter((l) => l.status === "confirmed").map((l) => (l.case_a.id === caseItem.id ? l.case_b : l.case_a));
        return (
          <p className="mb-4 flex items-center gap-2 rounded-lg bg-sand px-3 py-2 text-base text-ink">
            <ThreadMark size={16} light={false} />
            {others.length
              ? <>Checks against: {others.map((c) => `${bureauName(c.source_bureau)} case ${c.case_id}`).join(", ")} (confirmed as the same college).</>
              : <>No other bureau has a confirmed case on this college, so nothing to clash with.</>}
          </p>
        );
      })()}
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-base text-ink-2">
          Action
          <select required value={form.kind} onChange={set("kind")} className={INPUT}>
            <option value="">Choose…</option>
            {kinds?.actions.map((a) => <option key={a.kind} value={a.kind}>{a.label}</option>)}
          </select>
        </label>
        {form.kind === "transfer" ? (
          <label className="flex flex-col gap-1.5 text-base text-ink-2">
            Transfer to
            <select required value={form.transfer_to} onChange={set("transfer_to")} className={INPUT}>
              <option value="">Choose…</option>
              {Object.entries(BUREAUS).filter(([k]) => k !== caseItem.source_bureau).map(([k, b]) => <option key={k} value={k}>{b.name}</option>)}
            </select>
          </label>
        ) : (
          <label className="flex flex-col gap-1.5 text-base text-ink-2">
            Asking for{NEEDS_ASKING.includes(form.kind) ? <span className="text-muted"> (required)</span> : <span className="text-muted"> (optional)</span>}
            <input value={form.asking_for} onChange={set("asking_for")} required={NEEDS_ASKING.includes(form.kind)} maxLength={300} className={INPUT}
              placeholder="e.g. Laboratory equipment list and inspection report" />
          </label>
        )}
        <div className="flex items-center justify-between gap-4 md:col-span-2">
          <p className="text-base text-muted">Time limits and check windows are demo settings, not official AICTE rules.</p>
          <Button type="submit" size="lg" disabled={busy || !form.kind}>{busy ? "Checking…" : "Check and send"}</Button>
        </div>
      </form>
      {sent && <p role="status" className="mt-4 rounded-lg bg-sand px-4 py-3 text-lg"><span aria-hidden className="mr-2 font-semibold">✓</span>{sent}</p>}
      <div className="mt-4"><ErrorBox error={error} /></div>
      {panel && (
        <CheckPanel caseItem={caseItem} draft={panel.draft} clashes={panel.clashes}
          onClose={() => { setPanel(null); onSaved(); }} onSent={() => setForm({ kind: "", asking_for: "", transfer_to: "" })} />
      )}
    </Card>
  );
}
