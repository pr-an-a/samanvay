import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Bureau, Button, Card, ErrorBox, Loading, PageTitle, Status } from "../components/ui";
import { useApi } from "../hooks";
import { BUREAUS, CATEGORIES } from "../labels";
import { useTour } from "../tour";
import { useVideoCaption } from "../video";

const BEFORE = "Each bureau sees only its own cases.";
const AFTER = "Samanvay finds the same college across bureaus — even when the name is spelt differently.";

function Inbox({ bureau, cases, on, refs, side }) {
  return (
    <section aria-label={`${BUREAUS[bureau].name} inbox`} className="rounded-xl border border-line bg-surface p-3 text-ink">
      <div className="mb-2 flex items-center justify-between">
        <Bureau code={bureau} className="text-base" />
        <span className="text-base text-ink-2">{cases.length} cases in this inbox</span>
      </div>
      <ul className="space-y-1.5">
        {cases.map((c) => (
          <li
            key={c.case_id}
            ref={(el) => c.pair && (refs.current[`${side}${c.pair}`] = el)}
            className={`rounded-lg border-l-4 border border-line bg-page px-3 py-1.5 transition-shadow duration-500 ${
              on && c.pair ? "shadow-[0_0_0_2px_#f0c987]" : ""
            }`}
            style={{ borderLeftColor: BUREAUS[bureau].color }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-base font-semibold leading-snug">{c.college}</div>
                <div className="text-sm text-ink-2">
                  {c.case_id} · {CATEGORIES[c.category] || c.category}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {c.incoming && <span className="rounded-full bg-amber-wash px-2 py-0.5 text-sm text-amber">New today</span>}
                {!c.incoming && <Status status={c.status} />}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function WithoutWithPage() {
  const { data, error, loading } = useApi("/demo/without-with");
  const tour = useTour();
  const [on, setOn] = useState(false);
  const [lines, setLines] = useState([]);
  const box = useRef(null);
  const refs = useRef({});
  useVideoCaption(on ? AFTER : BEFORE, "inboxes");

  // Where each connector runs: from the right edge of the left card to the left edge of the right card.
  const measure = useCallback(() => {
    if (!box.current || !data) return;
    const origin = box.current.getBoundingClientRect();
    const z = origin.width / box.current.offsetWidth || 1; // 1 normally; not 1 when the page is CSS-zoomed (the video recorder zooms it)
    setLines(
      data.pairs.flatMap((p) => {
        const l = refs.current[`L${p.key}`], r = refs.current[`R${p.key}`];
        if (!l || !r) return [];
        const a = l.getBoundingClientRect(), b = r.getBoundingClientRect();
        const x1 = (a.right - origin.left) / z, y1 = (a.top + a.height / 2 - origin.top) / z;
        const x2 = (b.left - origin.left) / z, y2 = (b.top + b.height / 2 - origin.top) / z;
        return [{ ...p, x1, y1, x2, y2, len: Math.hypot(x2 - x1, y2 - y1) * 1.15 }];
      }),
    );
  }, [data]);

  useLayoutEffect(measure, [measure]);
  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  function turnOn() {
    measure();
    setOn(true);
    tour.patch({ turnedOn: true });
  }

  if (error) return <ErrorBox error={error} />;
  if (loading || !data) return <Loading />;

  return (
    <div className="space-y-4">
      <PageTitle
        sub="Two bureaus, two inboxes. Some of these cases are about the same college."
        actions={
          on ? (
            <Button variant="secondary" onClick={() => setOn(false)}>Turn off Samanvay</Button>
          ) : (
            <Button size="lg" onClick={turnOn}>Turn on Samanvay</Button>
          )
        }
      >
        {on ? "With Samanvay" : "Without Samanvay"}
      </PageTitle>

      <div data-tour-target="inboxes" className="moment rounded-2xl p-4">
      <div ref={box} className="relative grid grid-cols-[1fr_12rem_1fr] items-start">
        <Inbox bureau="RB" cases={data.rb} on={on} refs={refs} side="L" />
        <div data-tour-target="matches" className="self-stretch" aria-hidden />
        <Inbox bureau="PGRC" cases={data.pgrc} on={on} refs={refs} side="R" />

        <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          {lines.map((p, i) => {
            const mx = (p.x1 + p.x2) / 2;
            return (
              <path
                key={p.key}
                className="connector-line"
                d={`M${p.x1},${p.y1} C${mx},${p.y1} ${mx},${p.y2} ${p.x2},${p.y2}`}
                fill="none"
                stroke={p.tier === "id" ? "#fbf9f5" : "#f0c987"}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={p.len}
                strokeDashoffset={on ? 0 : p.len}
                style={{ opacity: on ? 1 : 0, transition: `stroke-dashoffset 600ms ease-out ${i * 120}ms` }}
              />
            );
          })}
        </svg>
        {lines.map((p, i) => (
          <span
            key={p.key}
            className={`absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border px-3 py-1 text-base font-semibold shadow-sm ${
              p.tier === "id" ? "border-ink bg-surface text-ink" : "border-amber/40 bg-amber-wash text-amber"
            }`}
            style={{
              left: (p.x1 + p.x2) / 2, top: (p.y1 + p.y2) / 2,
              opacity: on ? 1 : 0, transition: `opacity 300ms ease-out ${300 + i * 120}ms`,
            }}
          >
            {p.label}
          </span>
        ))}
      </div>

      <p data-video-hide className="font-display mt-4 px-4 pb-1 text-center text-3xl font-semibold leading-snug">{on ? AFTER : BEFORE}</p>
      </div>
      <p className="text-center text-base text-muted">
        Real cases from the demo data (all synthetic). A match is only a suggestion until an officer confirms it.
      </p>
    </div>
  );
}
