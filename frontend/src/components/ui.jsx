import { Link } from "react-router-dom";
import { BUREAUS, LINK_STATUS, STATUSES, isOverdue, percent } from "../labels";

export function PageTitle({ children, sub, actions }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-4xl">
        <h1 className="text-3xl font-semibold text-ink">{children}</h1>
        {sub && <p className="mt-2 text-lg text-ink-2">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}

export function Card({ title, sub, children, className = "", actions }) {
  return (
    <section className={`rounded-xl border border-line bg-surface p-6 ${className}`}>
      {(title || actions) && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
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

/** Bureau: coloured dot + full name (never colour alone, never a code). */
export function Bureau({ code, className = "" }) {
  const b = BUREAUS[code] || { name: code, color: "var(--color-muted)" };
  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap text-ink ${className}`}>
      <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ background: b.color }} />
      {b.name}
    </span>
  );
}

export function Status({ status }) {
  return <span className="whitespace-nowrap text-ink-2">{STATUSES[status] || status}</span>;
}

export function OverdueTag({ caseItem }) {
  if (!isOverdue(caseItem)) return null;
  return <span className="whitespace-nowrap font-semibold text-late">Overdue</span>;
}

export function LinkStatus({ status }) {
  const style = {
    suggested: "bg-amber-wash text-amber",
    confirmed: "bg-ok-wash text-ok",
    rejected: "bg-page text-muted",
  }[status];
  const icon = { suggested: "●", confirmed: "✓", rejected: "✕" }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-base font-semibold ${style}`}>
      <span aria-hidden>{icon}</span>
      {LINK_STATUS[status]}
    </span>
  );
}

export function MatchStrength({ value, compact = false }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      {!compact && <span className="text-base text-ink-2">Match strength</span>}
      <span className="h-2 w-16 overflow-hidden rounded-full bg-page" aria-hidden>
        <span className="block h-2 rounded-full bg-accent" style={{ width: percent(value) }} />
      </span>
      <span className="tabular font-semibold text-ink">{percent(value)}</span>
    </span>
  );
}

export function Button({ to, variant = "primary", size = "md", className = "", ...props }) {
  const look = {
    primary: "bg-accent text-white hover:bg-accent-dark",
    secondary: "border border-line bg-surface text-ink hover:border-accent hover:text-accent",
  }[variant];
  const pad = size === "lg" ? "px-6 py-3 text-lg" : "px-4 py-2 text-base";
  const cls = `inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${pad} ${look} ${className}`;
  if (to) return <Link to={to} className={cls} {...props} />;
  return <button type="button" className={cls} {...props} />;
}

export function TextLink({ to, children }) {
  return (
    <Link to={to} className="text-accent underline-offset-4 hover:underline">
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
    <div role="alert" className="rounded-xl border border-late/40 bg-surface p-4 text-lg text-ink">
      <span className="font-semibold text-late">Something went wrong: </span>
      {error.message || String(error)}
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
