import { useNavigate } from "react-router-dom";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import DemoReset from "../components/DemoReset";
import Icon from "../components/icons";
import CountUp from "../components/CountUp";
import { Card, ErrorBox, Loading, PageTitle } from "../components/ui";
import { useApi } from "../hooks";
import { BUREAUS, SLA_NOTE } from "../labels";

// Chart colours: sand and taupe for normal values, clay only for the oldest / overdue.
const SAND = "#d8d0c3";
const TAUPE = "#bfb3a3";
const CLAY = "#9c3d24";
const INK = "#2e2a25";
const INK_2 = "#6b6358";

const KPI_TONE = {
  neutral: { circle: "bg-sand text-ink-2", value: "text-ink" },
  clay: { circle: "bg-late-wash text-late", value: "text-late" },
  ochre: { circle: "bg-amber-wash text-amber", value: "text-ink" },
};

function Kpi({ icon, value, label, tone = "neutral", onClick }) {
  const t = KPI_TONE[tone];
  return (
    <button type="button" onClick={onClick} className="rounded-xl border border-line bg-surface p-5 text-left hover:border-ink">
      <span className={`flex h-11 w-11 items-center justify-center rounded-full ${t.circle}`}>
        <Icon name={icon} size={18} />
      </span>
      <div className={`font-display mt-3 text-4xl font-semibold ${t.value}`}><CountUp value={value} /></div>
      <div className="mt-1 text-lg text-ink-2">{label}</div>
    </button>
  );
}

function AgeTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-base">
      {label}: <span className="tabular font-semibold">{payload[0].value}</span> open cases
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: s, error, loading } = useApi("/dashboard/stats");

  if (error) return <ErrorBox error={error} />;
  if (loading || !s) return <Loading />;

  const buckets = Object.entries(s.ageing_open);
  const ageing = buckets.map(([bucket, count], i) => ({
    bucket: `${bucket}d`,
    count,
    fill: i === buckets.length - 1 ? CLAY : i === 0 ? SAND : TAUPE, // the oldest bucket is the one to worry about
  }));
  const maxOpen = Math.max(...s.bureau_workload.map((b) => b.open), 1);

  return (
    <div className="space-y-8">
      <PageTitle sub="Numbers and charts for the whole picture. The day-to-day work is in the Inbox.">Reports</PageTitle>

      <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
        <Kpi icon="folder" value={s.sla.open} label="Open cases" onClick={() => navigate("/cases?open=true")} />
        <Kpi icon="clock" value={s.sla.overdue} label="Overdue" tone="clay" onClick={() => navigate("/cases?overdue=true")} />
        <Kpi icon="link" value={s.overlaps.suggested} label="Needs your check" tone="ochre" onClick={() => navigate("/alerts")} />
        <Kpi icon="done" value={s.clashes_prevented} label="Clashes prevented" onClick={() => navigate("/audit?action=clash_prevented")} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="How long open cases have waited">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ageing} margin={{ top: 26, right: 8, left: 8, bottom: 0 }}>
                <XAxis dataKey="bucket" tick={{ fill: INK_2, fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<AgeTooltip />} cursor={{ fill: "#f5f1ea" }} />
                <Bar dataKey="count" maxBarSize={72} radius={[6, 6, 0, 0]} isAnimationActive={false}>
                  {ageing.map((d) => <Cell key={d.bucket} fill={d.fill} />)}
                  <LabelList dataKey="count" position="top" style={{ fill: INK, fontSize: 13 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-base text-ink-2">Days since the complaint was received. Clay = the oldest.</p>
        </Card>

        <Card title="Open cases by bureau">
          <ul className="space-y-5">
            {s.bureau_workload.map((b) => (
              <li key={b.bureau}>
                <div className="flex items-baseline justify-between gap-3 text-base">
                  <span className="text-ink">{BUREAUS[b.bureau].name}</span>
                  <span className="tabular text-ink-2">{b.open} open · {b.overdue} overdue</span>
                </div>
                <div
                  className="mt-1.5 flex h-3.5 overflow-hidden rounded-full"
                  style={{ width: `${(b.open / maxOpen) * 100}%` }}
                  title={`${b.open - b.overdue} within time limit, ${b.overdue} overdue`}
                >
                  <div style={{ flex: b.open - b.overdue, background: SAND }} />
                  <div style={{ flex: b.overdue, background: CLAY }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-base text-ink-2">Clay = overdue.</p>
        </Card>
      </div>

      <Card title="By region">
        <div className="grid gap-x-10 sm:grid-cols-2">
          {s.by_region.map((r) => (
            <button
              key={r.region}
              type="button"
              onClick={() => navigate(`/cases?region=${encodeURIComponent(r.region)}`)}
              className="flex justify-between gap-4 border-t border-line py-2 text-left text-base hover:bg-sand"
            >
              <span className="text-ink">{r.region}</span>
              <span className="tabular text-ink-2">
                {r.open} open · <span className={r.overdue ? "text-late" : ""}>{r.overdue} overdue</span>
              </span>
            </button>
          ))}
        </div>
      </Card>

      <p className="text-base text-ink-2">{SLA_NOTE}</p>
      <div data-admin-only><DemoReset /></div>
    </div>
  );
}
