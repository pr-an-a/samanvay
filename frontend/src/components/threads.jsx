import { useEffect, useState } from "react";
import { BUREAUS } from "../labels";

// The signature motif: THREADS JOINING. Two lines (one per bureau, in the bureau's colour) merge into one.

const SLATE = "var(--color-rb)";
const TERRA = "var(--color-pgrc)";

/** The logo: two lines merging into one. `light` is for use on charcoal. */
export function ThreadMark({ size = 18, light = true }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" strokeWidth="2.6" strokeLinecap="round">
      <path d="M6 3c0 7 6 6.5 6 12v6" stroke={light ? "#d8d0c3" : SLATE} />
      <path d="M18 3c0 7-6 6.5-6 12" stroke={light ? "#e8967a" : TERRA} />
    </svg>
  );
}

/** Draws itself once it has mounted. */
export function useOn(delay = 30) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOn(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return on;
}

/** Two bureau threads meeting in one, across a card's width: used above a pair of cases that match. */
export function MatchThread({ left, right, label }) {
  const on = useOn();
  return (
    <div className="relative" aria-hidden={!label}>
      <svg viewBox="0 0 600 64" preserveAspectRatio="none" className="h-14 w-full overflow-visible">
        <path className={`thread-draw ${on ? "on" : ""}`} pathLength="1" d="M150,0 C150,40 300,26 300,64" fill="none"
          stroke={BUREAUS[left]?.color || SLATE} strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <path className={`thread-draw ${on ? "on" : ""}`} pathLength="1" d="M450,0 C450,40 300,26 300,64" fill="none"
          stroke={BUREAUS[right]?.color || TERRA} strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {label && (
        <span className="absolute left-1/2 top-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink px-3 py-1 text-base font-semibold text-white shadow">
          {label}
        </span>
      )}
    </div>
  );
}

/** Looping hero animation: two threads draw down, join, and continue as one to a college. For the login page. */
export function ThreadsHero() {
  return (
    <svg viewBox="0 0 440 330" className="h-full w-full" role="img" aria-label="Two threads, one for each bureau, joining into one">
      <g fontFamily="Inter, system-ui, sans-serif" fontSize="12" fill="#e9e2d6">
        <text x="40" y="26">Regulation Bureau</text>
        <text x="292" y="26">Grievance Cell</text>
      </g>
      <circle cx="70" cy="44" r="5" fill={SLATE} />
      <circle cx="370" cy="44" r="5" fill={TERRA} />
      <path className="thread-loop thread-draw" pathLength="1" d="M70,44 C70,130 220,120 220,190" fill="none" stroke="#9fb0bf" strokeWidth="4" strokeLinecap="round" />
      <path className="thread-loop thread-draw" pathLength="1" style={{ animationDelay: "0.15s" }} d="M370,44 C370,130 220,120 220,190" fill="none" stroke="#e8967a" strokeWidth="4" strokeLinecap="round" />
      <path className="thread-loop thread-draw" pathLength="1" style={{ animationDelay: "0.9s" }} d="M220,190 L220,236" fill="none" stroke="#fbf9f5" strokeWidth="5" strokeLinecap="round" />
      <circle className="pulse-dot" cx="220" cy="190" r="7" fill="#fbf9f5" />
      {/* the college: a simple line-drawn building */}
      <g fill="none" stroke="#e9e2d6" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.95">
        <path d="M150 312h140" /><path d="M162 312V268" /><path d="M192 312V268" /><path d="M248 312V268" /><path d="M278 312V268" />
        <path d="M152 268h136" /><path d="M170 268c0-16 20-24 50-34 30 10 50 18 50 34" /><path d="M214 312v-26h12v26" />
      </g>
    </svg>
  );
}

/** Small line illustrations for empty states. */
export function Illustration({ name, className = "" }) {
  const stroke = { fill: "none", strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round" };
  return (
    <svg aria-hidden viewBox="0 0 160 110" className={`h-24 w-auto ${className}`}>
      {name === "clear" && (
        <g {...stroke}>
          <path d="M30 14c0 28 28 24 28 50v26" stroke={SLATE} />
          <path d="M130 14c0 28-28 24-28 50" stroke={TERRA} />
          <path d="M80 64c0 10 0 16 0 26" stroke="var(--color-ink)" />
          <circle cx="80" cy="64" r="11" stroke="var(--color-ink)" />
          <path d="M74.5 64l4 4 7-8" stroke="var(--color-ink)" />
        </g>
      )}
      {name === "apart" && (
        <g {...stroke}>
          <path d="M40 14c0 30 8 40 8 76" stroke={SLATE} />
          <path d="M120 14c0 30-8 40-8 76" stroke={TERRA} strokeDasharray="2 7" />
          <circle cx="80" cy="54" r="4" stroke="var(--color-chart-taupe)" />
        </g>
      )}
      {name === "note" && (
        <g {...stroke}>
          <path d="M50 14c0 22 30 20 30 44" stroke={SLATE} /><path d="M110 14c0 22-30 20-30 44" stroke={TERRA} />
          <rect x="52" y="62" width="56" height="34" rx="6" stroke="var(--color-ink)" /><path d="M62 74h36M62 84h22" stroke="var(--color-ink)" />
        </g>
      )}
    </svg>
  );
}
