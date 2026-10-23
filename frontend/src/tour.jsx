import { createContext, useContext, useState } from "react";

// Guided demo: eleven steps. Some advance as the viewer acts on the page, the rest with the panel's "Next" button.
// caption: the one line shown in video mode. captionAfter: the line once the step's own action is done.
// target / targetAfter: data-tour-target of the element to highlight in video mode.
export const TOUR_STEPS = [
  {
    title: "Without Samanvay",
    body: "Two bureaus, each with its own inbox. They hold cases about the same colleges, but neither can see the other’s.",
    hint: "Click “Turn on Samanvay”.",
    hintAfter: "Samanvay found the same college three times, even with different spellings. Click “Next” to follow an officer.",
    caption: "Each bureau sees only its own cases.",
    captionAfter: "Samanvay finds the same college across bureaus — even when the name is spelt differently.",
    target: "inboxes",
    go: "/without-with",
  },
  {
    title: "An officer drafts a request",
    body: "A Grievance Cell officer is about to ask a college for its laboratory report. Nothing has been sent.",
    hint: "Click “Use demo example”, then “Check and send”.",
    caption: "A Grievance Cell officer is about to ask a college for its lab report.",
    target: "new-action",
    go: "case",
  },
  {
    title: "The pre-action check stops them",
    body: "Before anything is saved, Samanvay checks the same college’s cases at other bureaus. The Regulation Bureau already asked for the same thing.",
    hint: "Read the panel, then click “Coordinate with Regulation Bureau”.",
    caption: "Samanvay stops the officer first: the Regulation Bureau already asked, six days ago.",
    target: "check-panel",
  },
  {
    title: "Coordinate instead of duplicating",
    body: "The officer sends a short note instead. The request to the college is held, so the college is not asked twice.",
    hint: "Click “Send note”.",
    caption: "Instead of a second request, the officer sends a note. The college is not asked twice.",
    target: "check-panel",
  },
  {
    title: "The other bureau gets the note",
    body: "The note is in the audit log and the Regulation Bureau’s bell has rung. Neither side can edit or delete it.",
    hint: null,
    caption: "The Regulation Bureau’s bell rings straight away.",
    target: "bell",
  },
  {
    title: "One merged timeline",
    body: "On the college page each bureau has its own thread. Where an officer confirmed it is the same college, the threads join into one.",
    hint: null,
    caption: "Two bureau threads, one shared timeline.",
    target: "timeline",
    go: "institution",
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
    title: "How it works",
    body: "Find the same college, show the evidence, check before acting, and leave the decision to a person.",
    hint: null,
    caption: "Match the college. Show the evidence. Check before acting. A person decides.",
    target: "how-steps",
    go: "/how-it-works",
  },
  {
    title: "Inbox, deadlines and privacy",
    body: "One inbox for what needs coordinating. Overdue and due-soon cases alert each bureau (demo time limits). Other bureaus never see complainant names.",
    hint: "Sign in as the Administrator, open the bell and click “Run check now”.",
    caption: "One inbox, deadline alerts for each bureau, and complainant names stay private.",
    target: "inbox-list",
    go: "/",
  },
  {
    title: "Check across bureaus before you act",
    body: "One view across bureaus, a check before every action, and a person making every decision.",
    hint: null,
    caption: "Samanvay checks across bureaus at the moment they’re about to act.",
    target: null,
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
