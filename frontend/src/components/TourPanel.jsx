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
  const current = TOUR_STEPS[tour.step - 1];
  const onTimeline = tour.timelineUrl && pathname === tour.timelineUrl;
  const other = tour.otherBureau;

  async function switchToOther() {
    const users = await api("/auth/demo-users");
    const u = users.find((x) => x.bureau === other);
    if (!u) return;
    await login(u.id);
    tour.patch({ switchedTo: other });
    navigate("/");
  }

  return (
    <aside
      aria-label="Guided demo"
      className="sticky top-6 w-[19rem] shrink-0 self-start overflow-hidden rounded-xl border border-line bg-surface shadow-lg"
    >
      <div className="flex items-center justify-between bg-navy px-5 py-3 text-white">
        <span className="font-semibold">Guided demo · step {tour.step} of {TOUR_STEPS.length}</span>
        <button type="button" onClick={tour.end} className="text-base text-white/80 hover:text-white">
          Exit
        </button>
      </div>
      <ol className="flex gap-1.5 px-5 pt-4" aria-hidden>
        {TOUR_STEPS.map((s, i) => (
          <li key={s.title} className={`h-1.5 flex-1 rounded-full ${i < tour.step ? "bg-accent" : "bg-line"}`} />
        ))}
      </ol>
      <div className="space-y-3 px-5 py-4">
        <h2 className="text-xl font-semibold">{current.title}</h2>
        <p className="text-base text-ink-2">{current.body}</p>
        {current.hint && <p className="rounded-lg bg-sand px-3 py-2 text-base text-ink">{current.hint}</p>}
        {tour.step === 5 && other && (
          <p className="rounded-lg bg-sand px-3 py-2 text-base text-ink">
            {tour.switchedTo === other
              ? `You are now the ${bureauName(other)} officer. Click the bell at the top: the note is there.`
              : `Click “Show the ${bureauName(other)}’s bell” to sign in as them.`}
          </p>
        )}
        {tour.step >= 4 && (
          <div className="flex flex-wrap gap-3 pt-1">
            {!onTimeline && tour.timelineUrl && tour.step === 4 && (
              <Button variant="secondary" onClick={() => navigate(tour.timelineUrl)}>See the shared timeline</Button>
            )}
            {tour.step === 5 && other && tour.switchedTo !== other && (
              <Button onClick={switchToOther}>Show the {bureauName(other)}’s bell</Button>
            )}
            <Button
              variant="secondary"
              onClick={() => {
                tour.end();
                navigate("/");
              }}
            >
              Finish tour
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
