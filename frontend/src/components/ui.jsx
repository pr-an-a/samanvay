import { Link } from "react-router-dom";
import { useSlaSettings } from "../hooks";
import { BUREAUS, LINK_STATUS, STATUSES, isDueSoon, isOverdue, percent } from "../labels";

export function PageTitle({ children, sub, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-4xl">
        <h1 className="font-display text-3xl font-semibold text-ink">{children}</h1>
        {sub && <p className="mt-1 text-lg text-ink-2">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}

export function Card({ title, sub, children, className = "", actions, ...rest }) {
  return (
    <section className={`rounded-xl border border-line bg-surface p-5 ${className}`} {...rest}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-xl font-semibold text-ink">{title}</h2>}
            {sub && <p className="mt-1 text-base text-ink-2">{sub}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const BUREAU_CHIP = {
  RB: "bg-rb-chip text-rb-ink",
  PGRC: "bg-pgrc-chip text-pgrc-ink",
  REGIONAL: "bg-regional-chip text-regional-ink",
};

/** Bureau chip: muted bureau colour, always with the full name (never colour alone, never a code). */
export function Bureau({ code, className = "" }) {
  const name = BUREAUS[code]?.name || code;
  return (
    <span className={`inline-flex w-fit items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm ${BUREAU_CHIP[code] || "bg-sand text-ink"} ${className}`}>
      {name}
    </span>
  );
}

function Chip({ tone = "neutral", children }) {
  const look = { neutral: "bg-sand text-ink-2", clay: "bg-late-wash text-late", ochre: "bg-amber-wash text-amber" }[tone];
  return <span className={`inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-sm ${look}`}>{children}</span>;
}

/** Case status. Neutral, except Escalated (an alert: clay). */
export function Status({ status }) {
  return <Chip tone={status === "escalated" ? "clay" : "neutral"}>{STATUSES[status] || status}</Chip>;
}

/** "Overdue" (clay) or "Due soon" (neutral) against the demo time limits, not official AICTE timelines. */
export function SlaTag({ caseItem }) {
  const settings = useSlaSettings();
  if (isOverdue(caseItem)) return <Chip tone="clay">Overdue</Chip>;
  if (isDueSoon(caseItem, settings?.due_soon_days ?? 3)) return <Chip>Due soon</Chip>;
  return null;
}

/** Needs your check = ochre; confirmed and rejected stay neutral. */
export function LinkStatus({ status }) {
  const icon = { suggested: "●", confirmed: "✓", rejected: "✕" }[status];
  return (
    <Chip tone={status === "suggested" ? "ochre" : "neutral"}>
      <span aria-hidden>{icon}</span>
      {LINK_STATUS[status]}
    </Chip>
  );
}

export function MatchStrength({ value, compact = false }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      {!compact && <span className="text-base text-ink-2">Match strength</span>}
      <span className="h-2 w-16 overflow-hidden rounded-full bg-line" aria-hidden>
        <span className="block h-2 rounded-full bg-ink" style={{ width: percent(value) }} />
      </span>
      <span className="tabular font-semibold text-ink">{percent(value)}</span>
    </span>
  );
}

/** Charcoal ring showing match strength, as in the overview mockup. */
export function MatchRing({ value, size = 58 }) {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Match strength ${percent(value)}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth="5" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-ink)" strokeWidth="5" strokeLinecap="round"
        strokeDasharray={`${c * value} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--color-ink)">
        {percent(value)}
      </text>
    </svg>
  );
}

export function Button({ to, variant = "primary", size = "md", className = "", ...props }) {
  const look = {
    primary: "bg-accent text-white hover:opacity-90",
    secondary: "border border-line bg-surface text-ink hover:border-ink",
  }[variant];
  const pad = size === "lg" ? "px-5 py-2.5 text-lg" : "px-4 py-2 text-base";
  const cls = `inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${pad} ${look} ${className}`;
  if (to) return <Link to={to} className={cls} {...props} />;
  return <button type="button" className={cls} {...props} />;
}

export function TextLink({ to, children }) {
  return (
    <Link to={to} className="text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
      {children}
    </Link>
  );
}

export function Loading() {
  return <p className="py-10 text-lg text-muted">Loading…</p>;
}

export function ErrorBox({ error }) {
  if (!error) return null;
  return (
    <div role="alert" className="rounded-xl border border-late/30 bg-late-wash p-4 text-lg text-ink">
      <span className="font-semibold text-late">{error.status === 401 ? "Signed out: " : "Something went wrong: "}</span>
      {error.message || String(error)}
      {error.status === 401 && (
        <Link to="/login" className="ml-2 font-semibold text-ink underline decoration-line underline-offset-4 hover:decoration-ink">Sign in again</Link>
      )}
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <div>
      <dt className="text-base text-muted">{label}</dt>
      <dd className="mt-1 text-lg text-ink">{children ?? "—"}</dd>
    </div>
  );
}
