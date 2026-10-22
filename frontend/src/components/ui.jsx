import { Link } from "react-router-dom";
import { BUREAUS, STATUSES, isOverdue } from "../labels";

export function PageTitle({ children, sub, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold text-ink">{children}</h1>
        {sub && <p className="mt-1 text-lg text-ink-2">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}

export function Card({ title, children, className = "", actions }) {
  return (
    <section className={`rounded-lg border border-line bg-surface p-5 shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-xl font-semibold text-ink">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** Bureau identity: coloured swatch + text label (never colour alone). */
export function BureauTag({ bureau, long = false }) {
  const b = BUREAUS[bureau] || { label: bureau, long: bureau, color: "var(--color-muted)" };
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-line bg-surface px-3 py-0.5 text-base font-medium text-ink">
      <span aria-hidden className="h-3 w-3 rounded-full" style={{ background: b.color }} />
      {long ? b.long : b.label}
    </span>
  );
}

export function StatusBadge({ status }) {
  const muted = status === "disposed";
  return (
    <span className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-base font-medium ${muted ? "bg-page text-muted" : "bg-brand-wash text-brand-dark"}`}>
      {STATUSES[status] || status}
    </span>
  );
}

export function OverdueBadge({ caseItem }) {
  if (!isOverdue(caseItem)) return null;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded bg-critical-wash px-2 py-0.5 text-base font-semibold text-critical">
      <span aria-hidden>⚠</span> Overdue
    </span>
  );
}

export function LinkStatusBadge({ status }) {
  const styles = {
    suggested: "bg-alert-wash text-ink",
    confirmed: "bg-[#e6f4e6] text-good-text",
    rejected: "bg-page text-muted",
  };
  const icon = { suggested: "●", confirmed: "✓", rejected: "✕" }[status];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-2 py-0.5 text-base font-semibold ${styles[status] || ""}`}>
      <span aria-hidden>{icon}</span> {status === "suggested" ? "Awaiting review" : status[0].toUpperCase() + status.slice(1)}
    </span>
  );
}

export function Button({ as, to, variant = "primary", className = "", ...props }) {
  const styles = {
    primary: "bg-brand text-white hover:bg-brand-dark",
    secondary: "border border-line bg-surface text-ink hover:bg-page",
    danger: "bg-critical text-white hover:brightness-90",
    good: "bg-good-text text-white hover:brightness-110",
  };
  const cls = `inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-lg font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`;
  if (to) return <Link to={to} className={cls} {...props} />;
  return <button type="button" className={cls} {...props} />;
}

export function Loading() {
  return <p className="py-8 text-lg text-muted">Loading…</p>;
}

export function ErrorBox({ error }) {
  if (!error) return null;
  return (
    <div role="alert" className="rounded-md border border-critical bg-critical-wash p-4 text-lg text-ink">
      <span className="font-semibold text-critical">⚠ Error: </span>
      {error.message || String(error)}
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <div>
      <dt className="text-base text-muted">{label}</dt>
      <dd className="mt-0.5 text-lg text-ink">{children ?? "—"}</dd>
    </div>
  );
}

export function Pct({ value }) {
  return <span className="tabular">{value === null || value === undefined ? "—" : value.toFixed(2)}</span>;
}
