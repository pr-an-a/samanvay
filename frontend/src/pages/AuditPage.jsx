import { useSearchParams } from "react-router-dom";
import { query } from "../api";
import { Card, ErrorBox, Loading, PageTitle, TextLink } from "../components/ui";
import { useApi } from "../hooks";
import { ROLES, bureauName, formatDateTime } from "../labels";

const ACTIONS = {
  complaint_registered: "New complaint",
  link_confirmed: "Confirmed same college",
  link_rejected: "Marked different colleges",
  case_escalated: "Escalated",
  note_posted: "Coordination note",
  action_taken: "Action sent",
  action_overridden: "Sent despite a clash",
  clash_prevented: "Clash prevented",
};
const CONTROL = "rounded-lg border border-line bg-surface px-3 py-2 text-base text-ink";

export default function AuditPage() {
  const [params, setParams] = useSearchParams();
  const filters = { action: params.get("action") || "", date_from: params.get("date_from") || "", date_to: params.get("date_to") || "" };
  const { data, error, loading } = useApi(`/audit${query(filters)}`);

  function set(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }

  return (
    <div className="space-y-6">
      <PageTitle sub="Every new complaint, match decision and escalation: who did it, what, when, and their note. This log cannot be edited or deleted.">
        Audit log
      </PageTitle>

      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1.5 text-base text-ink-2">
            Action
            <select value={filters.action} onChange={(e) => set("action", e.target.value)} className={CONTROL}>
              <option value="">All actions</option>
              {Object.entries(ACTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-base text-ink-2">
            From
            <input type="date" value={filters.date_from} onChange={(e) => set("date_from", e.target.value)} className={CONTROL} />
          </label>
          <label className="flex flex-col gap-1.5 text-base text-ink-2">
            To
            <input type="date" value={filters.date_to} onChange={(e) => set("date_to", e.target.value)} className={CONTROL} />
          </label>
        </div>
      </Card>

      <ErrorBox error={error} />
      {loading || !data ? (
        <Loading />
      ) : (
        <Card title={`${data.length} entr${data.length === 1 ? "y" : "ies"}`}>
          {data.length === 0 ? (
            <p className="text-lg text-ink-2">
              Nothing recorded for these filters. Entries appear when officers register complaints, decide on matches or escalate cases.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-base">
                <thead className="text-left text-ink-2">
                  <tr>
                    {["When", "Who", "What", "Note"].map((h) => <th key={h} className="px-3 pb-3 font-normal">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.map((e) => (
                    <tr key={e.id} className="border-t border-line align-top">
                      <td className="tabular whitespace-nowrap px-3 py-3 text-ink-2">{formatDateTime(e.timestamp)}</td>
                      <td className="px-3 py-3">
                        <div>{e.actor_name}</div>
                        <div className="text-ink-2">{e.actor_bureau ? bureauName(e.actor_bureau) : ROLES[e.actor_role] || e.actor_role}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-semibold">{ACTIONS[e.action] || e.action}</div>
                        <div>
                          {e.link_id ? <TextLink to={`/links/${e.link_id}`}>{e.summary}</TextLink>
                            : e.case_pk ? <TextLink to={`/cases/${e.case_pk}`}>{e.summary}</TextLink> : e.summary}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-ink-2">{e.remarks ? `“${e.remarks}”` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
