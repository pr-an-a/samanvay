import { Link, useNavigate } from "react-router-dom";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import DemoReset from "../components/DemoReset";
import Icon from "../components/icons";
import { Bureau, Card, ErrorBox, Loading, MatchRing, Status } from "../components/ui";
import { useApi } from "../hooks";
import { BUREAUS, SLA_NOTE, daysAgo, plainAction } from "../labels";

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
    <button type="button" onClick={onClick} className="rounded-2xl border border-line bg-surface p-6 text-left hover:border-ink">
      <span className={`flex h-12 w-12 items-center justify-center rounded-full ${t.circle}`}>
        <Icon name={icon} size={22} />
      </span>
      <div className={`tabular mt-4 text-4xl font-semibold ${t.value}`}>{value.toLocaleString("en-IN")}</div>
      <div className="mt-1 text-lg text-ink-2">{label}</div>
    </button>
  );
}

/** One side of a match: the case as its bureau sees it. */
function CaseMini({ c }) {
  const line =
    c.status === "escalated" || c.status === "transferred" ? (
      <Status status={c.status} />
    ) : c.status === "pending" ? (
      <span className="text-ink-2">New {daysAgo(c.received_date)}</span>
    ) : (
      <span className="text-ink-2">{plainAction(c.last_action)}</span>
    );
  return (
    <div className="rounded-lg border border-l-4 border-line bg-surface px-5 py-4" style={{ borderLeftColor: BUREAUS[c.source_bureau]?.color }}>
      <Bureau code={c.source_bureau} />
      <div className="mt-2 text-lg text-ink">{c.case_id}</div>
      <div className="mt-0.5 text-base">{line}</div>
    </div>
  );
}

function Connector() {
  return (
    <span aria-hidden className="hidden items-center @min-[50rem]:flex">
      <span className="h-0.5 w-3 bg-chart-taupe" />
      <span className="h-4 w-4 rounded border-2 border-chart-taupe" />
      <span className="h-0.5 w-3 bg-chart-taupe" />
    </span>
  );
}

function CoordinationCard({ item }) {
  const [a, b] = item.cases;
  return (
    <Link
      to={`/links/${item.link_id}`}
      aria-label={`${item.college_name}: ${item.status === "suggested" ? "needs your check" : "confirmed"}`}
      className="flex flex-col gap-4 rounded-2xl border border-line bg-sand/50 p-5 hover:border-ink @min-[50rem]:grid @min-[50rem]:grid-cols-[1fr_auto_1.15fr_auto_1fr_auto] @min-[50rem]:items-center @min-[50rem]:gap-3"
    >
      <div className="order-2 @min-[50rem]:order-none"><CaseMini c={a} /></div>
      <Connector />
      <div className="order-1 flex flex-col items-center gap-2 text-center @min-[50rem]:order-none">
        <Icon name="college" size={24} className="text-ink-2" />
        <div className="text-lg text-ink">{item.college_name}</div>
        {item.match_tier === "id" ? (
          <span className="rounded-full bg-sand px-3 py-0.5 text-base text-ink-2">Same AICTE ID</span>
        ) : (
          <span className="rounded-full bg-amber-wash px-3 py-0.5 text-base text-amber">Matched without AICTE ID</span>
        )}
      </div>
      <Connector />
      <div className="order-3 @min-[50rem]:order-none"><CaseMini c={b} /></div>
      <div className="order-4 flex items-center gap-4 @min-[50rem]:order-none @min-[50rem]:flex-col @min-[50rem]:gap-1 @min-[50rem]:pl-2">
        <MatchRing value={item.match_strength} />
        <span className="text-base text-ink-2">{item.status === "suggested" ? "Check now →" : "Confirmed ✓"}</span>
      </div>
    </Link>
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
  const { data: colleges } = useApi("/dashboard/coordination?limit=5");

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
    <div className="space-y-10">
      <p className="-mt-4 max-w-4xl text-lg text-ink-2">
        Different AICTE bureaus can act on the same college without knowing it. Samanvay spots this and warns officers before
        duplicate or conflicting action.
      </p>

      <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
        <Kpi icon="folder" value={s.sla.open} label="Open cases" onClick={() => navigate("/cases?open=true")} />
        <Kpi icon="clock" value={s.sla.overdue} label="Overdue" tone="clay" onClick={() => navigate("/cases?overdue=true")} />
        <Kpi icon="link" value={s.overlaps.suggested} label="Needs your check" tone="ochre" onClick={() => navigate("/alerts")} />
        <Kpi icon="done" value={s.coordinated_this_month} label="Coordinated this month" onClick={() => navigate("/alerts?status=confirmed")} />
      </div>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-ink">Colleges needing coordination</h2>
            <p className="mt-1 text-base text-ink-2">Two bureaus are working on the same college right now. Open a match to check it.</p>
          </div>
          <Link to="/alerts" className="text-base text-ink underline decoration-line underline-offset-4 hover:decoration-ink">See all</Link>
        </div>
        {!colleges ? (
          <Loading />
        ) : colleges.length === 0 ? (
          <Card><p className="text-lg text-ink-2">No college is being handled by two bureaus right now.</p></Card>
        ) : (
          <div className="@container space-y-4">
            {colleges.map((c) => <CoordinationCard key={c.link_id} item={c} />)}
          </div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="How long open cases have waited">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ageing} margin={{ top: 26, right: 8, left: 8, bottom: 0 }}>
                <XAxis dataKey="bucket" tick={{ fill: INK_2, fontSize: 16 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<AgeTooltip />} cursor={{ fill: "#f5f1ea" }} />
                <Bar dataKey="count" maxBarSize={72} radius={[6, 6, 0, 0]} isAnimationActive={false}>
                  {ageing.map((d) => <Cell key={d.bucket} fill={d.fill} />)}
                  <LabelList dataKey="count" position="top" style={{ fill: INK, fontSize: 16 }} />
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
      <DemoReset />
    </div>
  );
}
