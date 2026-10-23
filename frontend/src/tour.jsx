import { createContext, useContext, useState } from "react";

// Guided demo: nine steps. Some advance as the viewer acts on the page, the rest with the panel's "Next" button.
// caption: the one line shown in video mode. captionAfter: the line once the step's own action is done.
// target / targetAfter: data-tour-target of the element to highlight in video mode.
export const TOUR_STEPS = [
  {
    title: "Without Samanvay",
    body: "Two bureaus, each with its own inbox. They hold cases about the same colleges, but neither can see the other’s.",
    hint: "Click “Turn on Samanvay”.",
    hintAfter: "Samanvay found the same college three times, even with different spellings. Click “Next” to see a new complaint arrive.",
    caption: "Each bureau sees only its own cases.",
    captionAfter: "Samanvay finds the same college across bureaus — even when the name is spelt differently.",
    target: "inboxes",
    targetAfter: "inboxes",
    go: "/without-with",
  },
  {
    title: "A new complaint arrives",
    body: "A student complains to the Grievance Cell about ragging at a college. The college name is misspelled and there is no AICTE ID.",
    hint: "Click “Fill in demo complaint”, then “Register complaint”.",
    caption: "A complaint reaches the Grievance Cell: misspelt college name, no AICTE ID.",
    target: "complaint-form",
    go: "/new",
  },
  {
    title: "Samanvay finds the other bureau’s case",
    body: "As soon as the complaint is saved, Samanvay checks every other bureau’s cases. It finds the Regulation Bureau already working on the same college.",
    hint: "Read the warning, then click “Check and confirm”.",
    caption: "Samanvay warns the officer: the Regulation Bureau is already handling this college.",
    target: "overlap-banner",
  },
  {
    title: "An officer confirms",
    body: "Nothing is merged automatically. The officer sees why Samanvay thinks it is the same college, and decides.",
    hint: "Click “Yes, same college”.",
    caption: "Nothing is merged automatically. An officer sees the evidence and decides.",
    target: "decision",
  },
  {
    title: "Both bureaus share one timeline",
    body: "The college now has one timeline with both bureaus’ actions, so neither acts without knowing what the other has done.",
    hint: "Add a note for the other bureau, then click “Post note”.",
    caption: "One shared timeline. The bureaus can now leave each other notes.",
    target: "notes",
  },
  {
    title: "The other bureau’s bell rings",
    body: "The note is saved in the audit log and the other bureau gets an alert. Neither bureau can edit or delete it later.",
    hint: null,
    caption: "The note rings the other bureau’s bell straight away.",
    target: "bell",
  },
  {
    title: "Stress test: twenty ways to spell one college",
    body: "Samanvay’s real matcher runs on twenty ways a complainant might write one college’s name. Two simpler methods run alongside it.",
    hint: "Click “Run”. Failures are shown, not hidden.",
    caption: "Twenty ways to misspell one college. The real matcher, row by row.",
    target: "stress-table",
    go: "/stress",
  },
  {
    title: "Compared with simpler methods",
    body: "On fifty planted overlaps, matching by AICTE ID alone or by exact name misses most of them. This is synthetic data: a prototype, not a proof.",
    hint: null,
    caption: "On 50 planted overlaps, simpler methods miss most. Synthetic data: a prototype, not a proof.",
    target: "baseline",
    go: "/accuracy",
  },
  {
    title: "Deadlines are watched too",
    body: "Overdue and due-soon cases raise alerts for each bureau. The time limits are demo settings, not official AICTE timelines.",
    hint: "Sign in as the Administrator, open the bell and click “Run check now”.",
    caption: "Overdue and due-soon cases alert each bureau. Demo time limits, not official ones.",
    target: "bell",
    go: "/",
  },
];

const KEY = "samanvay.tour";
const TourContext = createContext(null);
const FRESH = { active: false, step: 1, timelineUrl: null };

function load() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY)) || FRESH;
  } catch {
    return FRESH;
  }
}

/** The caption and highlight target for the tour's current state. */
export function stepCaption(tour) {
  const s = TOUR_STEPS[Math.min(tour.step, TOUR_STEPS.length) - 1];
  const after = tour.step === 1 && tour.turnedOn;
  return { caption: (after && s.captionAfter) || s.caption, target: (after && s.targetAfter) || s.target };
}

export function TourProvider({ children }) {
  const [tour, setTour] = useState(load);

  function save(next) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // private mode: the tour still works for this page load
    }
    setTour(next);
  }

  const api = {
    ...tour,
    start: () => save({ active: true, step: 1, timelineUrl: null }),
    end: () => save(FRESH),
    /** Remember something without moving the step (e.g. that the presenter switched user). */
    patch: (extra) => tour.active && save({ ...tour, ...extra }),
    /** Move forward to step n (never backwards); no-op when the tour is off. */
    reach: (n, extra = {}) => {
      if (tour.active && n > tour.step) save({ ...tour, ...extra, step: n });
    },
  };
  return <TourContext.Provider value={api}>{children}</TourContext.Provider>;
}

export const useTour = () => useContext(TourContext);
