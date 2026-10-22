import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { useSlaSettings } from "../hooks";
import { BUREAUS, SLA_NOTE, formatDateTime } from "../labels";
import { Button } from "./ui";

const SECTIONS = [
  ["overdue", "Overdue"],
  ["due_soon", "Due soon"],
  ["needs_check", "Needs your check"],
];
const POLL_MS = 60_000;
const CAP = 20; // keep the badge readable: "20+" rather than "87"

function BellIcon() {
  return (
    <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

export default function AlertsBell() {
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const [error, setError] = useState(null);
  const box = useRef(null);
  const { pathname } = useLocation();
  const { user } = useAuth();
  const settings = useSlaSettings();
  const isAdmin = user?.role === "ADMIN";

  const load = useCallback(() => api("/notifications").then(setData).catch(setError), []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load, pathname]);

  useEffect(() => {
    if (!open) return;
    const close = (e) => (e.key === "Escape" || (e.type === "mousedown" && !box.current?.contains(e.target))) && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  // Closing the panel refreshes the count (everything just shown is now seen).
  useEffect(() => {
    if (!open && data) load();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggle() {
    if (open) return setOpen(false);
    setOpen(true);
    await load(); // show the "New" markers first, then mark everything as seen
    api("/notifications/seen", { method: "POST" }).catch(() => {});
  }

  async function runCheck() {
    setChecking(true);
    setError(null);
    try {
      setCheckResult(await api("/sla/check", { method: "POST" }));
      await load(); // shows the new alerts with their "New" markers...
      await api("/notifications/seen", { method: "POST" }); // ...which the officer is now looking at
    } catch (e) {
      setError(e);
    } finally {
      setChecking(false);
    }
  }

  const unseen = open ? 0 : data?.unseen ?? 0;
  const items = data?.items ?? [];

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={`Alerts${unseen ? (isAdmin ? ", new alerts" : `, ${unseen} new`) : ""}`}
        className="relative rounded-lg border border-white/30 p-2 text-white hover:bg-white/10"
      >
        <BellIcon />
        {unseen > 0 &&
          (isAdmin ? (
            // The Administrator sees every bureau: a dot here, the per-bureau numbers inside.
            <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-navy bg-amber-line" />
          ) : (
            <span className="tabular absolute -right-2 -top-2 min-w-6 rounded-full bg-amber-line px-1.5 text-center text-sm font-semibold text-ink">
              {unseen > CAP ? `${CAP}+` : unseen}
            </span>
          ))}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Alerts"
          className="absolute right-0 z-50 mt-3 w-[30rem] overflow-hidden rounded-xl border border-line bg-surface text-ink shadow-xl"
        >
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-lg font-semibold">Alerts</h2>
            {!data ? (
              <p className="text-base text-ink-2">Loading…</p>
            ) : isAdmin ? (
              <table className="mt-2 w-full text-base">
                <thead className="text-left text-ink-2">
                  <tr>
                    <th className="pb-1 font-normal">Bureau</th>
                    <th className="pb-1 text-right font-normal">Overdue</th>
                    <th className="pb-1 text-right font-normal">Due soon</th>
                    <th className="pb-1 text-right font-normal">To check</th>
                    <th className="pb-1 text-right font-normal">New</th>
                  </tr>
                </thead>
                <tbody className="tabular">
                  {Object.entries(BUREAUS).map(([code, b]) => {
                    const row = data.by_bureau[code] || { overdue: 0, due_soon: 0, needs_check: 0, new: 0 };
                    return (
                      <tr key={code} className="border-t border-line">
                        <td className="py-1.5">{b.name}</td>
                        <td className="py-1.5 text-right">{row.overdue}</td>
                        <td className="py-1.5 text-right">{row.due_soon}</td>
                        <td className="py-1.5 text-right">{row.needs_check}</td>
                        <td className={`py-1.5 text-right ${row.new ? "font-semibold text-accent" : ""}`}>{row.new}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="text-base text-ink-2">
                {data.counts.overdue} overdue · {data.counts.due_soon} due soon · {data.counts.needs_check} need your check
              </p>
            )}
          </div>
          <div className="max-h-[26rem] overflow-y-auto px-5">
            {items.length === 0 && <p className="py-6 text-base text-ink-2">No alerts right now.</p>}
            {SECTIONS.map(([kind, title]) => {
              const list = items.filter((i) => i.kind === kind);
              if (!list.length) return null;
              return (
                <section key={kind} className="py-3">
                  <h3 className="text-base font-semibold text-ink-2">{title} ({data.counts[kind]})</h3>
                  <ul className="mt-1 divide-y divide-line">
                    {list.slice(0, 8).map((i) => (
                      <li key={i.id}>
                        <Link
                          to={i.kind === "needs_check" ? `/links/${i.link_id}` : `/cases/${i.case_pk}`}
                          onClick={() => setOpen(false)}
                          className="flex gap-3 py-2.5 text-base hover:text-accent"
                        >
                          <span aria-hidden className={`mt-2 h-2 w-2 shrink-0 rounded-full ${i.new ? "bg-accent" : "bg-transparent"}`} />
                          <span>
                            {i.message}
                            {i.new && <span className="ml-2 text-sm font-semibold text-accent">New</span>}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {data.counts[kind] > Math.min(list.length, 8) && (
                    <Link
                      to={kind === "needs_check" ? "/alerts" : kind === "overdue" ? "/cases?overdue=true" : "/cases?open=true"}
                      onClick={() => setOpen(false)}
                      className="text-base text-accent underline-offset-4 hover:underline"
                    >
                      See all {data.counts[kind]}
                    </Link>
                  )}
                </section>
              );
            })}
          </div>
          <div className="space-y-2 border-t border-line bg-page/60 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-base text-ink-2">
                Last time-limit check:{" "}
                {data?.last_check
                  ? formatDateTime(data.last_check)
                  : settings?.automatic_checks
                    ? `not yet (runs every ${settings.check_interval_minutes} minutes)`
                    : "not yet"}
              </span>
              <Button variant="secondary" onClick={runCheck} disabled={checking}>{checking ? "Checking…" : "Run check now"}</Button>
            </div>
            {checkResult && (
              <p className="text-base text-ink">
                Checked {checkResult.checked} open cases: {checkResult.overdue} overdue, {checkResult.due_soon} due soon,{" "}
                {checkResult.new_alerts} new alert{checkResult.new_alerts === 1 ? "" : "s"}.
              </p>
            )}
            {error && <p className="text-base text-late">{error.message}</p>}
            {settings && !settings.automatic_checks && (
              <p className="text-sm text-ink-2">Demo mode: checks run only when you press “Run check now”.</p>
            )}
            <p className="text-sm text-muted">{SLA_NOTE}</p>
          </div>
        </div>
      )}
    </div>
  );
}
