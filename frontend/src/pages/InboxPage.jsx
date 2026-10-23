import { useState } from "react";
import { Link } from "react-router-dom";
import CountUp from "../components/CountUp";
import { Illustration, ThreadMark } from "../components/threads";
import { Bureau, ErrorBox, Loading } from "../components/ui";
import { useAuth } from "../auth";
import { useApi } from "../hooks";
import { BUREAUS, ROLES, formatDateTime } from "../labels";

const KINDS = {
  note_waiting: { label: "Waiting for your reply", chip: "bg-amber-wash text-amber" },
  clash_prevented: { label: "Clash prevented", chip: "bg-sand text-ink" },
  overdue_linked: { label: "Overdue and linked", chip: "bg-late-wash text-late" },
  new_match: { label: "New same-college match", chip: "bg-sand text-ink-2" },
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function Task({ t, i }) {
  const k = KINDS[t.kind];
  const [a, b] = t.bureaus;
  return (
    <li className="anim-rise" style={{ animationDelay: `${Math.min(i * 45, 500)}ms` }}>
      <Link to={`/links/${t.link_id}`} className="group flex gap-4 rounded-xl border border-line bg-surface p-4 transition-colors hover:border-ink">
        {/* the two bureaus' threads, side by side */}
        <span aria-hidden className="flex shrink-0 gap-1 self-stretch py-1">
          <span className="w-1 rounded-full" style={{ background: BUREAUS[a]?.color }} />
          <span className="w-1 rounded-full" style={{ background: BUREAUS[b]?.color }} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-sm ${k.chip}`}>{k.label}</span>
            <Bureau code={a} /><Bureau code={b} />
            <span className="tabular ml-auto text-sm text-muted">{formatDateTime(t.when)}</span>
          </div>
          <h3 className="font-display mt-1.5 text-2xl font-semibold leading-snug">{t.college}</h3>
          <p className="text-lg">{t.title}</p>
          <p className="text-base text-ink-2">{t.detail}</p>
        </div>
        <span aria-hidden className="self-center text-xl text-ink-2 transition-transform group-hover:translate-x-1">→</span>
      </Link>
    </li>
  );
}

export default function InboxPage() {
  const { user } = useAuth();
  const { data, error, loading } = useApi("/inbox");
  const [filter, setFilter] = useState("all");
  if (error) return <ErrorBox error={error} />;
  if (loading || !data) return <Loading />;
  const matches = data.tasks.filter((t) => t.kind === "new_match");
  const limit = filter === "new_match" ? 12 : 4; // new matches are plentiful: keep the first few, the rest are one click away
  const shown = [...data.tasks.filter((t) => t.kind !== "new_match" && (filter === "all" || t.kind === filter)),
                 ...(filter === "all" || filter === "new_match" ? matches.slice(0, limit) : [])];
  const total = data.tasks.length - matches.length + data.counts.new_match;

  return (
    <div className="space-y-6">
      <section className="moment anim-rise overflow-hidden rounded-2xl px-7 py-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            <div className="flex items-center gap-2 text-sm uppercase tracking-[0.14em] text-[#e0c9b4]"><ThreadMark size={15} /> Coordination inbox</div>
            <h1 className="font-display mt-2 text-4xl font-semibold leading-tight">{greeting()}, {user?.name?.split(" ")[0]}</h1>
            <p className="mt-1 text-lg text-[#e9e2d6]">{ROLES[user?.role]}. Samanvay checks across bureaus at the moment you are about to act. This is what needs agreeing with another bureau.</p>
          </div>
          <dl className="flex gap-7">
            {[["note_waiting", "Waiting for you"], ["clash_prevented", "Clashes prevented"], ["new_match", "New matches"]].map(([k, label]) => (
              <div key={k}>
                <dt className="text-sm text-[#cfc6b8]">{label}</dt>
                <dd className="font-display text-4xl font-semibold"><CountUp value={data.counts[k]} /></dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div role="tablist" aria-label="Filter tasks" className="flex flex-wrap gap-2">
        {[["all", "All", total], ...Object.entries(KINDS).map(([k, v]) => [k, v.label, data.counts[k]])].map(([k, label, n]) => (
          <button key={k} role="tab" type="button" aria-selected={filter === k} onClick={() => setFilter(k)}
            className={`rounded-full border px-3.5 py-1.5 text-base transition-colors ${filter === k ? "border-ink bg-ink font-semibold text-white" : "border-line bg-surface text-ink-2 hover:border-ink hover:text-ink"}`}>
            {label} <span className="tabular ml-1 opacity-80">{n}</span>
          </button>
        ))}
      </div>

      <section data-tour-target="inbox-list" aria-label="Coordination tasks">
        {shown.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-line bg-surface px-6 py-12 text-center">
            <Illustration name="clear" />
            <h2 className="font-display mt-4 text-2xl font-semibold">Nothing to coordinate right now</h2>
            <p className="mt-1 max-w-md text-lg text-ink-2">When another bureau starts working on a college you are handling, it will appear here.</p>
          </div>
        ) : (
          <ul className="space-y-3">{shown.map((t, i) => <Task key={t.key} t={t} i={i} />)}</ul>
        )}
        {(filter === "all" || filter === "new_match") && data.counts.new_match > limit && (
          <p className="mt-4 text-base text-ink-2">
            {data.counts.new_match - limit} more possible matches. <Link to="/alerts" className="text-ink underline decoration-line underline-offset-4 hover:decoration-ink">See all matches</Link>
          </p>
        )}
      </section>
    </div>
  );
}
