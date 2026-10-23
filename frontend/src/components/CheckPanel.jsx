import { useEffect, useState } from "react";
import { api } from "../api";
import { useTour } from "../tour";
import { BUREAUS, bureauName, formatDateTime } from "../labels";
import { Bureau, Button, ErrorBox } from "./ui";
import { ThreadMark, useOn } from "./threads";

const TYPES = {
  duplicate_effort: "Duplicate effort",
  conflicting_action: "Conflicting action",
  waiting_on_each_other: "Waiting on each other",
};
const lowerFirst = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);

function Side({ tone, label, bureau, lines }) {
  return (
    <div className="rounded-xl border border-line bg-page p-4" style={{ borderTop: `4px solid ${BUREAUS[bureau]?.color || "var(--color-ink)"}` }}>
      <div className="text-base text-muted">{label}</div>
      <div className="mt-1.5"><Bureau code={bureau} className="text-base" /></div>
      <div className="mt-2 space-y-1">{lines}</div>
    </div>
  );
}

/**
 * Full-attention panel: "Before you send: ...". Shows the two actions side by side and the clash. The officer can
 * coordinate (a prefilled note that rings the other bureau's bell), send anyway (with a reason, which is audited),
 * or cancel. Nothing has been saved when this opens.
 */
export default function CheckPanel({ caseItem, draft, clashes, onClose, onSent }) {
  const tour = useTour();
  const [first, ...rest] = clashes;
  const { other } = first;
  const [mode, setMode] = useState("choose"); // choose | coordinate | override | done
  const asking = draft.asking_for ? ` (asking for “${draft.asking_for}”)` : "";
  const [note, setNote] = useState(
    `Before I ${lowerFirst(draft.label)}${asking}, can we coordinate? I can see your case ${other.case_id}${other.action ? ` (${lowerFirst(other.action)}${other.days_ago != null ? `, ${other.days_ago === 0 ? "today" : `${other.days_ago} day${other.days_ago === 1 ? "" : "s"} ago`}` : ""})` : ""}. Shall we agree who goes first, or send one joint request?`.slice(0, 500),
  );
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const on = useOn(120);
  const other_name = bureauName(other.bureau);

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && !busy && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [busy, onClose]);

  async function run(fn) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const coordinate = () => run(async () => {
    await api(`/cases/${caseItem.id}/actions/coordinate`, { method: "POST", body: { link_id: other.link_id, body: note.trim(), kind: draft.kind } });
    tour.reach(5, { otherBureau: other.bureau });
    setOutcome(`Note sent. The ${other_name}’s bell has rung. Your request was not sent to the college.`);
    setMode("done");
  });

  const sendAnyway = () => run(async () => {
    const body = { kind: draft.kind, asking_for: draft.asking_for || null, transfer_to: draft.transfer_to || null, override_reason: reason.trim() };
    await api(`/cases/${caseItem.id}/actions`, { method: "POST", body });
    setOutcome("Sent. Your reason is written to the audit log.");
    setMode("done");
    onSent?.();
  });

  return (
    <div className="anim-dim fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-[rgb(38_34_30/0.66)] p-6 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="check-title" data-tour-target="check-panel"
        className="anim-slide w-full max-w-4xl overflow-hidden rounded-2xl bg-surface shadow-2xl">
        <header className="moment px-7 py-5">
          <div className="flex items-center gap-2 text-sm uppercase tracking-[0.14em] text-[#e0c9b4]">
            <ThreadMark size={16} /> Pre-action check
            <span className="ml-auto rounded-full border border-white/25 px-3 py-0.5 text-sm normal-case tracking-normal text-white">{TYPES[first.type]}</span>
          </div>
          <h2 id="check-title" className="font-display mt-2 text-4xl font-semibold leading-tight">
            Before you send: {first.headline}
          </h2>
        </header>

        <div className="space-y-5 px-7 py-6">
          <div className="grid items-stretch gap-3 md:grid-cols-[1fr_auto_1fr]">
            <Side label="Already on record" bureau={other.bureau} lines={<>
              <div className="text-lg font-semibold">{other.action || `Case ${other.case_id} is open`}</div>
              {other.asking_for && <div className="text-base text-ink-2">Asking for: {other.asking_for}</div>}
              <div className="text-base text-muted">
                {other.case_id}{other.actor && <> · {other.actor}</>}
                {other.when && <> · {formatDateTime(other.when)}</>}
              </div>
            </>} />
            <div className="hidden items-center md:flex" aria-hidden>
              <svg viewBox="0 0 70 40" className="h-10 w-[4.5rem]">
                <path className={`thread-draw ${on ? "on" : ""}`} pathLength="1" d="M0,8 C28,8 30,20 35,20" fill="none" stroke={BUREAUS[other.bureau]?.color} strokeWidth="3" strokeLinecap="round" />
                <path className={`thread-draw ${on ? "on" : ""}`} pathLength="1" d="M70,8 C42,8 40,20 35,20" fill="none" stroke={BUREAUS[caseItem.source_bureau]?.color} strokeWidth="3" strokeLinecap="round" />
                <path className={`thread-draw ${on ? "on" : ""}`} pathLength="1" d="M35,20 L35,40" fill="none" stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
            <Side label="What you are about to send" bureau={caseItem.source_bureau} lines={<>
              <div className="text-lg font-semibold">{draft.label}</div>
              {draft.asking_for && <div className="text-base text-ink-2">Asking for: {draft.asking_for}</div>}
              <div className="text-base text-muted">{caseItem.case_id} · not sent yet</div>
            </>} />
          </div>

          <p className="text-xl leading-snug">{first.explanation}</p>
          {rest.length > 0 && (
            <ul className="list-disc space-y-1 pl-6 text-base text-ink-2">
              {rest.map((c, i) => <li key={i}><span className="font-semibold text-ink">{TYPES[c.type]}:</span> {c.explanation}</li>)}
            </ul>
          )}

          {mode === "choose" && (
            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
              <Button size="lg" autoFocus onClick={() => { setMode("coordinate"); tour.reach(4); }}>Coordinate with {other_name}</Button>
              <Button size="lg" variant="secondary" onClick={() => setMode("override")}>Send anyway</Button>
              <button type="button" onClick={onClose} className="ml-auto px-3 py-2 text-lg text-ink-2 underline decoration-line underline-offset-4 hover:text-ink">Cancel</button>
            </div>
          )}

          {mode === "coordinate" && (
            <div className="space-y-3 border-t border-line pt-5">
              <label className="block text-base text-ink-2" htmlFor="coord-note">
                Note to the {other_name}. It rings their bell; your request is held, not sent.
              </label>
              <textarea id="coord-note" value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={4} className="w-full rounded-lg border border-line p-3 text-lg" />
              <div className="flex flex-wrap items-center gap-3">
                <Button size="lg" disabled={busy || !note.trim()} onClick={coordinate}>{busy ? "Sending…" : "Send note"}</Button>
                <Button size="lg" variant="secondary" disabled={busy} onClick={() => setMode("choose")}>Back</Button>
              </div>
            </div>
          )}

          {mode === "override" && (
            <div className="space-y-3 border-t border-line pt-5">
              <label className="block text-base text-ink-2" htmlFor="override-reason">
                Why send anyway? Your reason is written to the audit log (at least 5 characters).
              </label>
              <textarea id="override-reason" value={reason} onChange={(e) => setReason(e.target.value.slice(0, 500))} rows={3} className="w-full rounded-lg border border-line p-3 text-lg" placeholder="e.g. The college has not answered us since 1 October" autoFocus />
              <div className="flex flex-wrap items-center gap-3">
                <Button size="lg" disabled={busy || reason.trim().length < 5} onClick={sendAnyway}>{busy ? "Sending…" : "Send anyway and record my reason"}</Button>
                <Button size="lg" variant="secondary" disabled={busy} onClick={() => setMode("choose")}>Back</Button>
              </div>
            </div>
          )}

          {mode === "done" && (
            <div className="flex flex-wrap items-center gap-4 border-t border-line pt-5" role="status">
              <p className="text-xl"><span aria-hidden className="mr-2 font-semibold">✓</span>{outcome}</p>
              <Button size="lg" className="ml-auto" onClick={onClose}>Close</Button>
            </div>
          )}
          <ErrorBox error={error} />
        </div>
      </section>
    </div>
  );
}
