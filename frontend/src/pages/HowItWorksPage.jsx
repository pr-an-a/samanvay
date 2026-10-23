import { Card, ErrorBox, Loading, PageTitle } from "../components/ui";
import { ThreadMark, useOn } from "../components/threads";
import { useApi } from "../hooks";

const bold = (t) => <span className="font-semibold text-ink">{t}</span>;

/** Two bureau threads join, then one thread runs through the four steps. */
function Flow() {
  const on = useOn();
  const labels = ["Find the college", "Show the evidence", "Check before acting", "A person decides"];
  const xs = [330, 500, 670, 840];
  return (
    <svg viewBox="0 0 1000 96" className="h-24 w-full" role="img" aria-label="Four steps along one thread">
      <path className={`thread-draw ${on ? "on" : ""}`} pathLength="1" d="M20,14 C130,14 140,48 250,48" fill="none" stroke="var(--color-rb)" strokeWidth="4" strokeLinecap="round" />
      <path className={`thread-draw ${on ? "on" : ""}`} pathLength="1" d="M20,82 C130,82 140,48 250,48" fill="none" stroke="var(--color-pgrc)" strokeWidth="4" strokeLinecap="round" />
      <path className={`thread-draw ${on ? "on" : ""}`} pathLength="1" style={{ animationDelay: "0.5s" }} d="M250,48 L960,48" fill="none" stroke="var(--color-ink)" strokeWidth="4" strokeLinecap="round" />
      {xs.map((x, i) => (
        <g key={x}>
          <circle cx={x} cy="48" r="15" fill="var(--color-ink)" stroke="var(--color-page)" strokeWidth="4" />
          <text x={x} y="53.5" textAnchor="middle" fontSize="16" fontWeight="600" fill="#fff" fontFamily="Fraunces, serif">{i + 1}</text>
          <text x={x} y="90" textAnchor="middle" fontSize="12.5" fill="var(--color-ink-2)" fontFamily="Inter, sans-serif">{labels[i]}</text>
        </g>
      ))}
      <text x="22" y="9" fontSize="11.5" fill="var(--color-ink-2)" fontFamily="Inter, sans-serif" dy="-1">Regulation Bureau</text>
      <text x="22" y="96" fontSize="11.5" fill="var(--color-ink-2)" fontFamily="Inter, sans-serif" dy="-3">Grievance Cell</text>
    </svg>
  );
}

export default function HowItWorksPage() {
  const { data, error } = useApi("/demo/script");
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  const s = data.clash_settings;
  const steps = [
    ["1", "Find the same college", <>Even with no AICTE ID, Samanvay compares the college {bold("name")} (spelling, initials, abbreviations), {bold("address")}, {bold("district")} and type. If both complaints carry the same AICTE ID, that settles it. Different IDs are never linked.</>],
    ["2", "Show the evidence", <>Every suggested match comes with a {bold("score breakdown")}: what matched, what did not, and what was missing. Dates are never used to decide a match.</>],
    ["3", "Check before you act", <>When an officer is about to send an action, Samanvay checks the cases an officer has confirmed as the same college, with plain rules (no AI): {bold("duplicate effort")}, a similar request within {s.duplicate_days} days; {bold("conflicting action")}, such as closing while another bureau has escalated or issued a show-cause notice (within {s.conflict_days} days), or transferring to a bureau already on the college; {bold("waiting on each other")}, both cases quiet for {s.idle_days} days. These windows are demo settings, not official AICTE rules.</>],
    ["4", "A person decides", <>Nothing is merged or sent automatically. The officer can {bold("coordinate")} (a note that rings the other bureau’s bell), {bold("send anyway")} with a reason, or cancel. Every decision, note and override is in the audit log, which cannot be edited.</>],
  ];
  return (
    <div className="space-y-6">
      <PageTitle sub="Officers do not need another dashboard. Samanvay checks across bureaus at the moment they are about to act.">How it works</PageTitle>
      <div data-tour-target="how-steps"><Card className="!py-3"><Flow /></Card></div>
      <ol className="grid gap-4 md:grid-cols-2">
        {steps.map(([n, title, body], i) => (
          <li key={n} className="anim-rise" style={{ animationDelay: `${i * 80}ms` }}>
            <Card className="h-full">
              <div className="flex items-center gap-3">
                <span className="font-display flex h-9 w-9 items-center justify-center rounded-full bg-ink text-xl font-semibold text-white">{n}</span>
                <h2 className="font-display text-2xl font-semibold">{title}</h2>
              </div>
              <p className="mt-3 text-lg text-ink-2">{body}</p>
            </Card>
          </li>
        ))}
      </ol>
      <Card className="moment !border-0">
        <div className="flex items-start gap-4">
          <span className="mt-1 text-white"><ThreadMark size={28} /></span>
          <div>
            <h2 className="font-display text-2xl font-semibold">Privacy by design</h2>
            <p className="mt-1 text-lg text-[#e9e2d6]">
              All data here is synthetic. A bureau sees complainant names only on its own cases: other bureaus see them hidden (R*** K***).
              There are no phone numbers or emails, and complainant names are never logged. Sign-in is demo-grade, not production authentication.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
