import { Link } from "react-router-dom";
import { BUREAUS, formatDateTime, plainAction } from "../labels";
import { Bureau } from "./ui";

// Two bureau threads (in bureau colours) run side by side, then merge into one shared thread once an officer
// has confirmed it is the same college. A bureau's thread starts at its first action.

const ORDER = ["RB", "PGRC", "REGIONAL"];
const LANE = 22;
const DOT_Y = 21;
const isConfirm = (t) => /^Overlap with .* confirmed$/.test(t.action);

export default function ThreadTimeline({ entries, emptyText = "Nothing has happened on this college yet." }) {
  if (!entries?.length) return <p className="text-lg text-ink-2">{emptyText}</p>;
  const lanes = ORDER.filter((b) => entries.some((e) => e.case_bureau === b));
  const merged = lanes.length > 1 ? entries.findIndex(isConfirm) : -1;
  const W = 28 + LANE * (lanes.length - 1);
  const x = (b) => 14 + LANE * lanes.indexOf(b);
  const cx = W / 2;
  const start = Object.fromEntries(lanes.map((b) => [b, entries.findIndex((e) => e.case_bureau === b)]));
  const end = Object.fromEntries(lanes.map((b) => [b, merged >= 0 ? merged : entries.map((e) => e.case_bureau).lastIndexOf(b)]));
  const line = (left, color, top, height, key) => (
    <span key={key} aria-hidden className="absolute rounded-full" style={{ left: left - 1.5, width: 3, background: color, top, ...(height != null ? { height } : { bottom: 0 }) }} />
  );

  return (
    <ol>
      {entries.map((t, i) => {
        const phase = merged < 0 || i < merged ? "split" : i === merged ? "merge" : "joined";
        const last = i === entries.length - 1;
        const laneX = phase === "joined" ? cx : x(t.case_bureau);
        return (
          <li key={i} className="anim-rise grid gap-x-5 sm:grid-cols-[auto_1fr]" style={{ animationDelay: `${Math.min(i * 70, 900)}ms` }}>
            <div className="relative hidden sm:block" style={{ width: W }}>
              {phase !== "joined" &&
                lanes.map((b) => {
                  if (i < start[b] || (merged < 0 ? i > end[b] : i > merged)) return null;
                  const color = BUREAUS[b].color;
                  const isStart = i === start[b], isEnd = merged < 0 && i === end[b];
                  if (phase === "merge") return null; // drawn below as curves
                  return line(x(b), color, isStart ? DOT_Y : 0, isEnd ? DOT_Y - (isStart ? DOT_Y : 0) : isStart ? undefined : undefined, b);
                })}
              {phase === "merge" && (
                <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${W} 100`} preserveAspectRatio="none" aria-hidden>
                  {lanes.filter((b) => i >= start[b]).map((b) => (
                    <path key={b} d={`M${x(b)},${i === start[b] ? DOT_Y : 0} C${x(b)},62 ${cx},44 ${cx},100`} fill="none"
                      stroke={BUREAUS[b].color} strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                  ))}
                </svg>
              )}
              {phase === "joined" && line(cx, "var(--color-ink)", 0, last ? DOT_Y : undefined, "j")}
              <span aria-hidden className="absolute z-10 h-3 w-3 rounded-full border-2 border-surface"
                style={{ left: laneX - 6, top: DOT_Y - 6, background: BUREAUS[t.case_bureau]?.color, boxShadow: phase === "joined" ? "0 0 0 2px var(--color-ink)" : undefined }} />
            </div>
            <div className="grid gap-x-6 gap-y-1 py-3 @3xl:grid-cols-[11rem_1fr] sm:grid-cols-[10rem_1fr]">
              <div className="text-base">
                <div className="tabular text-muted">{formatDateTime(t.timestamp)}</div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Bureau code={t.case_bureau} />
                  <Link to={`/cases/${t.case_pk}`} className="text-ink underline decoration-line underline-offset-4 hover:decoration-ink">{t.case_id}</Link>
                </div>
              </div>
              <div>
                {i === merged && (
                  <span className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-0.5 text-sm font-semibold text-white">
                    <span aria-hidden>⟡</span> Threads join: one shared timeline from here
                  </span>
                )}
                <div className="text-lg font-semibold">{plainAction(t.action)}</div>
                <div className="text-base text-ink-2">
                  {t.actor}
                  {t.remarks && <> · “{t.remarks}”</>}
                </div>
                {t.asking_for && <div className="text-base text-ink-2">Asking for: {t.asking_for}</div>}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
