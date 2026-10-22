import { useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BureauTag, Button, Card, ErrorBox, Loading, PageTitle, Pct } from "../components/ui";
import { useApi } from "../hooks";
import { BUREAUS, formatDate } from "../labels";

const KPIS = [
  ["Total cases", (s) => s.total_cases, "/cases"],
  ["Pending", (s) => s.by_status.pending, "/cases?status=pending"],
  ["Under process", (s) => s.by_status.under_process, "/cases?status=under_process"],
  ["Transferred", (s) => s.by_status.transferred, "/cases?status=transferred"],
  ["Escalated", (s) => s.by_status.escalated, "/cases?status=escalated"],
  ["Disposed", (s) => s.by_status.disposed, "/cases?status=disposed"],
];

const AXIS = { fill: "#3f3e3b", fontSize: 16 };

function Kpi({ label, value, sub, onClick, alert = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border bg-surface p-4 text-left shadow-sm hover:border-brand ${alert ? "border-critical border-2" : "border-line"}`}
    >
      <div className="text-lg text-ink-2">{label}</div>
      <div className={`mt-1 text-4xl font-semibold ${alert ? "text-critical" : "text-ink"}`}>{value.toLocaleString("en-IN")}</div>
      {sub && <div className="mt-1 text-base text-ink-2">{sub}</div>}
    </button>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-base shadow">
      <div className="font-semibold">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm" style={{ background: p.color }} />
          {p.name}: <span className="tabular font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: s, error, loading } = useApi("/dashboard/stats");
  const { data: alerts } = useApi("/alerts/overlaps");

  if (error) return <ErrorBox error={error} />;
  if (loading || !s) return <Loading />;

  const workload = s.bureau_workload.map((b) => ({
    bureau: BUREAUS[b.bureau].label,
    code: b.bureau,
    within: b.open - b.overdue,
    overdue: b.overdue,
    open: b.open,
    total: b.total,
  }));
  const ageing = Object.entries(s.ageing_open).map(([bucket, count]) => ({ bucket: `${bucket} days`, count }));

  return (
    <div>
      <PageTitle sub={`Figures as of ${formatDate(s.as_of)}. Click any card to open the matching cases.`}>Dashboard</PageTitle>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
        {KPIS.map(([label, get, to]) => (
          <Kpi key={label} label={label} value={get(s)} onClick={() => navigate(to)} />
        ))}
        <Kpi
          label="Overdue vs SLA"
          value={s.sla.overdue}
          sub={`of ${s.sla.open} open cases`}
          alert
          onClick={() => navigate("/cases?overdue=true")}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Bureau workload (open cases)">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workload} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e1e0d9" />
                <XAxis dataKey="bureau" tick={AXIS} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} />
                <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} width={44} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f4f5f7" }} />
                <Legend wrapperStyle={{ fontSize: 16, color: "#3f3e3b" }} />
                <Bar dataKey="within" name="Within SLA" stackId="open" fill="#2a78d6" stroke="#fff" strokeWidth={2} maxBarSize={24} isAnimationActive={false} />
                <Bar dataKey="overdue" name="Overdue" stackId="open" fill="#d03b3b" stroke="#fff" strokeWidth={2} maxBarSize={24} isAnimationActive={false} radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="open" position="top" style={{ fill: "#0b0b0b", fontSize: 16, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-base text-ink-2">Number above each bar: total open cases. Hover for the split.</p>
        </Card>

        <Card title="Ageing of open cases">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ageing} margin={{ top: 24, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e1e0d9" />
                <XAxis dataKey="bucket" tick={AXIS} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} />
                <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} width={44} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f4f5f7" }} />
                <Bar dataKey="count" name="Open cases" fill="#2a78d6" maxBarSize={24} isAnimationActive={false} radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="count" position="top" style={{ fill: "#0b0b0b", fontSize: 16, fontWeight: 600 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-base text-ink-2">Days since the complaint was received.</p>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card
          title="Overlaps needing coordination"
          className="lg:col-span-3"
          actions={<Button to="/alerts" variant="secondary">View all</Button>}
        >
          <p className="mb-3 text-lg text-ink-2">
            <span className="text-3xl font-semibold text-ink">{s.overlaps.suggested}</span> awaiting review ·{" "}
            {s.overlaps.confirmed} confirmed · {s.overlaps.rejected} rejected
          </p>
          <ul className="divide-y divide-line">
            {alerts?.slice(0, 6).map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-lg">
                    <BureauTag bureau={l.case_a.source_bureau} /> <span className="font-medium">{l.case_a.raw_institution_name}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-lg">
                    <BureauTag bureau={l.case_b.source_bureau} /> <span className="font-medium">{l.case_b.raw_institution_name}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-base text-ink-2">
                    confidence <span className="text-lg font-semibold text-ink"><Pct value={l.scores.final_confidence} /></span>
                  </span>
                  <Button to={`/links/${l.id}`}>Review</Button>
                </div>
              </li>
            ))}
            {alerts && alerts.length === 0 && <li className="py-3 text-lg text-ink-2">Nothing awaiting review.</li>}
          </ul>
        </Card>

        <Card title="Cases by region" className="lg:col-span-2">
          <table className="w-full text-lg">
            <thead>
              <tr className="border-b border-line text-left text-base text-muted">
                <th className="py-2 font-medium">Region</th>
                <th className="py-2 text-right font-medium">Total</th>
                <th className="py-2 text-right font-medium">Open</th>
                <th className="py-2 text-right font-medium">Overdue</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {s.by_region.map((r) => (
                <tr
                  key={r.region}
                  className="cursor-pointer border-b border-line/60 hover:bg-page"
                  onClick={() => navigate(`/cases?region=${encodeURIComponent(r.region)}`)}
                >
                  <td className="py-2 text-brand underline-offset-2 hover:underline">{r.region}</td>
                  <td className="py-2 text-right">{r.total}</td>
                  <td className="py-2 text-right">{r.open}</td>
                  <td className={`py-2 text-right ${r.overdue ? "font-semibold text-critical" : ""}`}>{r.overdue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
      <p className="mt-4 text-base text-ink-2">{s.sla.note}</p>
    </div>
  );
}
