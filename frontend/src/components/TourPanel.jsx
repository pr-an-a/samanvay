import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { bureauName } from "../labels";
import { TOUR_STEPS, useTour } from "../tour";
import { Button } from "./ui";

export default function TourPanel() {
  const tour = useTour();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { login } = useAuth();
  if (!tour.active) return null;
  const { step } = tour;
  const current = TOUR_STEPS[step - 1];
  const last = step === TOUR_STEPS.length;
  const other = tour.otherBureau || "RB";
  const hint = (step === 1 && tour.turnedOn && current.hintAfter) || current.hint;

  /** Where a step's screen is: some depend on the seeded demo college. */
  async function pathFor(go) {
    if (go !== "case" && go !== "institution") return go;
    const s = await api("/demo/script");
    return go === "case" ? `/cases/${s.action_case_pk}` : `/institutions/${s.institution_id}`;
  }

  /** Move to a later step and open its screen. */
  async function next(to = step + 1) {
    tour.reach(to);
    const go = TOUR_STEPS[to - 1].go;
    if (go) navigate(await pathFor(go));
  }

  async function signInAs(match, extra) {
    const users = await api("/auth/demo-users");
    const u = users.find(match);
    if (!u) return;
    await login(u.id);
    tour.patch(extra);
    navigate("/");
  }

  const onPage = (kind) => (kind === "case" ? pathname.startsWith("/cases/") : true);

  return (
    <aside
      aria-label="Guided demo"
      className="sticky top-6 w-[19rem] shrink-0 self-start overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
    >
      <div className="moment flex items-center justify-between px-5 py-3">
        <span className="font-semibold">Guided demo · step {step} of {TOUR_STEPS.length}</span>
        <button type="button" onClick={tour.end} className="text-base text-white/80 hover:text-white">
          Exit
        </button>
      </div>
      <ol className="flex gap-1 px-5 pt-4" aria-hidden>
        {TOUR_STEPS.map((s, i) => (
          <li key={s.title} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i < step ? "bg-accent" : "bg-line"}`} />
        ))}
      </ol>
      <div className="space-y-3 px-5 py-4">
        <h2 className="font-display text-xl font-semibold">{current.title}</h2>
        <p className="text-base text-ink-2">{current.body}</p>
        {hint && <p className="rounded-lg bg-sand px-3 py-2 text-base text-ink">{hint}</p>}
        {step === 5 && (
          <p className="rounded-lg bg-sand px-3 py-2 text-base text-ink">
            {tour.switchedTo === other
              ? `You are now the ${bureauName(other)} officer. Click the bell at the top: the note is there.`
              : `Click “Show the ${bureauName(other)}’s bell” to sign in as them.`}
          </p>
        )}
        {step === 11 && tour.switchedTo === "ADMIN" && (
          <p className="rounded-lg bg-sand px-3 py-2 text-base text-ink">You are now the Administrator. Open the bell and click “Run check now”.</p>
        )}

        <div className="flex flex-wrap gap-3 pt-1">
          {step === 1 && tour.turnedOn && <Button onClick={() => next()}>Next: an officer drafts a request</Button>}
          {step === 2 && !onPage("case") && <Button variant="secondary" onClick={() => next(2)}>Open the case</Button>}
          {step === 2 && <Button variant="secondary" onClick={() => next(6)}>Skip to the timeline</Button>}
          {step === 5 && (
            <>
              {tour.switchedTo !== other && (
                <Button onClick={() => signInAs((u) => u.bureau === other, { switchedTo: other })}>
                  Show the {bureauName(other)}’s bell
                </Button>
              )}
              <Button variant={tour.switchedTo === other ? "primary" : "secondary"} onClick={() => next()}>Next: the merged timeline</Button>
            </>
          )}
          {step === 6 && <Button onClick={() => next()}>Next: reports</Button>}
          {step === 7 && <Button variant="secondary" onClick={() => next()}>Next: stress test</Button>}
          {step === 8 && <Button variant="secondary" onClick={() => next()}>Next: simpler methods</Button>}
          {step === 9 && <Button onClick={() => next()}>Next: how it works</Button>}
          {step === 10 && <Button onClick={() => next()}>Next: inbox and deadlines</Button>}
          {step === 11 && (
            <>
              {tour.switchedTo !== "ADMIN" && (
                <Button onClick={() => signInAs((u) => u.role === "ADMIN", { switchedTo: "ADMIN" })}>Sign in as Administrator</Button>
              )}
              <Button variant={tour.switchedTo === "ADMIN" ? "primary" : "secondary"} onClick={() => next()}>Next: close</Button>
            </>
          )}
          {step >= 5 && (
            <Button
              variant="secondary"
              onClick={() => {
                tour.end();
                navigate("/");
              }}
            >
              {last ? "Finish tour" : "Finish early"}
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
