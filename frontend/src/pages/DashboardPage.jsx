import { useNavigate } from "react-router-dom";
import DemoReset from "../components/DemoReset";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Bureau, Button, Card, ErrorBox, LinkStatus, Loading, MatchStrength, Status } from "../components/ui";
import { useApi } from "../hooks";
import { BUREAUS, SLA_NOTE, plainAction } from "../labels";

const ACCENT = "#1f5fbf";
const AXIS = { fill: "#46505f", fontSize: 15 };

function Kpi({ label, value, hint, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-line bg-surface p-5 text-left transition-colors hover:border-accent"
    >
      <div className="text-base text-ink-2">{label}</div>
      <div className="tabular mt-1 text-4xl font-semibold">{value.toLocaleString("en-IN")}</div>
      <div className="mt-1 text-base text-muted">{hint}</div>
    </button>
  );
}

function CollegeRow({ item }) {
  return (
    <li className="grid gap-4 py-5 md:grid-cols-[1fr_auto] md:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xl font-semibold">{item.college_name}</span>
          <LinkStatus status={item.status} />
        </div>
        <div className="mt-0.5 text-base text-muted">{[item.district, item.region].filter(Boolean).join(", ")}</div>
        <ul className="mt-3 space-y-1.5">
          {item.cases.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-base">
              <Bureau code={c.source_bureau} className="w-44" />
              <span className="text-ink-2">{c.case_id}</span>
              <span className="text-ink-2">·</span>
              <Status status={c.status} />
              <span className="text-ink-2">· last action:</span>
              <span className="text-ink">{plainAction(c.last_action)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col items-start gap-3 md:items-end">
        <MatchStrength value={item.match_strength} />
        <Button to={`/links/${item.link_id}`} variant={item.status === "suggested" ? "primary" : "secondary"}>
          {item.status === "suggested" ? "Check now" : "View"}
        </Button>
      </div>
    </li>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: s, error, loading } = useApi("/dashboard/stats");
  const { data: colleges } = useApi("/dashboard/coordination?limit=6");

  if (error) return <ErrorBox error={error} />;
  if (loading || !s) return <Loading />;

  const maxOpen = Math.max(...s.bureau_workload.map((b) => b.open), 1);
  const ageing = Object.entries(s.ageing_open).map(([bucket, count]) => ({ bucket: `${bucket} d`, count }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Overview</h1>
        <p className="mt-2 max-w-4xl text-lg text-ink-2">
          Different AICTE bureaus can act on the same college without knowing it. Samanvay spots this and warns officers
          before duplicate or conflicting action.
        </p>
      </div>

      <Card
        title="Colleges needing coordination"
        sub="Two bureaus are working on the same college right now. Check each match, then coordinate."
        actions={<Button to="/alerts" variant="secondary">See all</Button>}
        className="border-t-4 border-t-accent"
      >
        {!colleges ? (
          <Loading />
        ) : colleges.length === 0 ? (
          <p className="text-lg text-ink-2">No college is being handled by two bureaus right now.</p>
        ) : (
          <ul className="divide-y divide-line">
            {colleges.map((c) => <CollegeRow key={c.link_id} item={c} />)}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
        <Kpi label="Open cases" value={s.sla.open} hint="across all bureaus" onClick={() => navigate("/cases?open=true")} />
        <Kpi label="Overdue" value={s.sla.overdue} hint="past their due date" onClick={() => navigate("/cases?overdue=true")} />
        <Kpi label="Needs your check" value={s.overlaps.suggested} hint="possible same-college matches" onClick={() => navigate("/alerts")} />
        <Kpi
          label="Coordinated this month"
          value={s.coordinated_this_month}
          hint="matches confirmed by officers"
          onClick={() => navigate("/alerts?status=confirmed")}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Open cases by bureau">
          <ul className="space-y-5">
            {s.bureau_workload.map((b) => (
              <li key={b.bureau}>
                <div className="flex items-baseline justify-between gap-3 text-base">
                  <span>{BUREAUS[b.bureau].name}</span>
                  <span className="tabular text-ink-2">
                    <span className="font-semibold text-ink">{b.open}</span> open · {b.overdue} overdue
                  </span>
                </div>
                <div className="mt-1.5 h-3 rounded-full bg-page" title={`${b.open} open cases`}>
                  <div className="h-3 rounded-full bg-accent" style={{ width: `${(b.open / maxOpen) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="How long open cases have waited">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ageing} margin={{ top: 20, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e2e5ea" />
                <XAxis dataKey="bucket" tick={AXIS} axisLine={{ stroke: "#c9ced6" }} tickLine={false} />
                <YAxis hide />
                <Tooltip cursor={{ fill: "#f2f4f7" }} formatter={(v) => [v, "Open cases"]} />
                <Bar dataKey="count" fill={ACCENT} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  <LabelList dataKey="count" position="top" style={{ fill: "#121721", fontSize: 15 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="By region">
          <table className="w-full text-base">
            <thead>
              <tr className="text-left text-muted">
                <th className="pb-2 font-normal">Region</th>
                <th className="pb-2 text-right font-normal">Open</th>
                <th className="pb-2 text-right font-normal">Overdue</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {s.by_region.map((r) => (
                <tr key={r.region} className="cursor-pointer border-t border-line hover:bg-page" onClick={() => navigate(`/cases?region=${encodeURIComponent(r.region)}`)}>
                  <td className="py-1.5 text-accent">{r.region}</td>
                  <td className="py-1.5 text-right">{r.open}</td>
                  <td className="py-1.5 text-right">{r.overdue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
      <p className="text-base text-muted">{SLA_NOTE}</p>
      <DemoReset />
    </div>
  );
}
