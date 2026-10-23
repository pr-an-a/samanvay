import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Footer, Logo } from "../components/Layout";
import { CaptionBar, useVideoCaption } from "../video";

// An illustrative scenario (not real data): a student's complaint, and another bureau already acting on the same college.
// Beats advance by themselves, or with the right arrow key when the page is opened with ?manual=1 (the video recorder does this).

const LINES = [
  "",
  "Meet Ananya. Her college is withholding her original certificates.",
  "She files a complaint with the Grievance Cell.",
  "What she can’t see: the Regulation Bureau is already acting on the same college.",
  "Two bureaus. Two files. One college.",
];
const SLATE = "var(--color-rb)";
const TERRA = "var(--color-pgrc)";
const show = (on, extra = "") => ({ opacity: on ? 1 : 0, transform: on ? "none" : "translateY(10px)", transition: "opacity 450ms ease-out, transform 450ms ease-out", ...(extra ? { transitionDelay: extra } : {}) });

export default function StoryPage() {
  const [params] = useSearchParams();
  const manual = params.get("manual") === "1";
  const [beat, setBeat] = useState(0);
  useVideoCaption(LINES[beat] || "Illustrative scenario: a student’s complaint, and another bureau already acting.", null);

  useEffect(() => {
    if (manual) {
      const key = (e) => e.key === "ArrowRight" && setBeat((b) => Math.min(b + 1, 4));
      window.addEventListener("keydown", key);
      return () => window.removeEventListener("keydown", key);
    }
    const t = setInterval(() => setBeat((b) => Math.min(b + 1, 4)), 3600);
    setBeat(1);
    return () => clearInterval(t);
  }, [manual]);

  const draw = (n) => `thread-draw ${beat >= n ? "on" : ""}`;
  const card = (x, tone, who, a, b) => (
    <g>
      <rect x={x} y="44" width="250" height="104" rx="14" fill="#fbf9f5" stroke={tone} strokeWidth="3" />
      <text x={x + 18} y="76" fontSize="15" fontWeight="600" fill={tone} fontFamily="Inter, sans-serif">{who}</text>
      <text x={x + 18} y="105" fontSize="19" fontWeight="600" fill="#2e2a25" fontFamily="Fraunces, serif">{a}</text>
      <text x={x + 18} y="130" fontSize="14" fill="#6b6358" fontFamily="Inter, sans-serif">{b}</text>
    </g>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto w-full max-w-6xl px-8 pt-6"><Logo /></header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-8 py-6">
        <section className="moment relative overflow-hidden rounded-3xl px-8 pb-8 pt-7" data-tour-target="story">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#f0c987]/60 bg-[#f0c987]/15 px-3.5 py-1 text-base font-semibold text-[#f0c987]">
            <span aria-hidden>◐</span> Illustrative scenario
          </span>
          <svg viewBox="0 0 1000 420" className="mt-2 h-auto w-full" role="img" aria-label="Ananya complains to the Grievance Cell while the Regulation Bureau already has a case on the same college">
            {/* Ananya */}
            <g style={show(beat >= 1)}>
              <circle cx="110" cy="92" r="26" fill="none" stroke="#e9e2d6" strokeWidth="3" />
              <path d="M62 170c6-34 30-46 48-46s42 12 48 46" fill="none" stroke="#e9e2d6" strokeWidth="3" strokeLinecap="round" />
              <text x="110" y="205" textAnchor="middle" fontSize="19" fontWeight="600" fill="#fbf9f5" fontFamily="Fraunces, serif">Ananya</text>
              <text x="110" y="226" textAnchor="middle" fontSize="13" fill="#cfc6b8" fontFamily="Inter, sans-serif">a student</text>
            </g>
            {/* her complaint, and the thread to the Grievance Cell */}
            <path className={draw(2)} pathLength="1" d="M168,100 C240,100 270,96 330,96" fill="none" stroke="#e8967a" strokeWidth="4" strokeLinecap="round" />
            <g style={show(beat >= 2)}>{card(330, TERRA, "Grievance Cell", "Complaint registered", "Original certificates withheld")}</g>
            {/* the Regulation Bureau, already acting */}
            <g style={show(beat >= 3)}>{card(720, SLATE, "Regulation Bureau", "Case already open", "Certificate records requested")}</g>
            {/* the college, reached by both threads */}
            <path className={draw(3)} pathLength="1" d="M455,148 C455,240 520,262 548,300" fill="none" stroke="#e8967a" strokeWidth="4" strokeLinecap="round" />
            <path className={draw(3)} pathLength="1" d="M845,148 C845,240 640,262 612,300" fill="none" stroke="#9fb0bf" strokeWidth="4" strokeLinecap="round" />
            <g style={show(beat >= 3)} fill="none" stroke="#e9e2d6" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M520 404h120" /><path d="M530 404v-52" /><path d="M556 404v-52" /><path d="M604 404v-52" /><path d="M630 404v-52" />
              <path d="M522 352h116" /><path d="M538 352c0-14 18-22 42-30 24 8 42 16 42 30" /><path d="M573 404v-22h14v22" />
              <text x="650" y="372" fontSize="16" fill="#fbf9f5" stroke="none" fontFamily="Inter, sans-serif">The same college</text>
            </g>
            {/* no link between the two bureaus */}
            <g style={show(beat >= 4)}>
              <path d="M586 96 L714 96" stroke="#cfc6b8" strokeWidth="3" strokeDasharray="3 8" strokeLinecap="round" />
              <circle cx="650" cy="96" r="14" fill="#26221e" stroke="#e8967a" strokeWidth="2.5" />
              <path d="M644 90l12 12M656 90l-12 12" stroke="#e8967a" strokeWidth="2.5" strokeLinecap="round" />
              <text x="650" y="130" textAnchor="middle" fontSize="13" fill="#cfc6b8" fontFamily="Inter, sans-serif">no connection</text>
            </g>
          </svg>
          <p className="font-display mt-1 min-h-[2.4em] text-center text-3xl font-semibold leading-snug">{LINES[beat]}</p>
        </section>
        <p className="mt-3 text-center text-base text-muted">Illustrative scenario: invented for this demo, not a real case or person.</p>
        <div className="mt-5 flex justify-center">
          <Link to="/login" className="rounded-lg bg-accent px-5 py-2.5 text-lg font-semibold text-white hover:opacity-90">Start with the demo</Link>
        </div>
      </main>
      <Footer width="max-w-6xl" />
      <CaptionBar />
    </div>
  );
}
