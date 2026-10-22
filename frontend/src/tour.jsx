import { createContext, useContext, useState } from "react";

// Guided demo: four steps, advanced by the pages themselves as the viewer acts.
export const TOUR_STEPS = [
  {
    title: "A new complaint arrives",
    body: "A student complains to the Grievance Cell about ragging at a college. The college name is misspelled and there is no AICTE ID.",
    hint: "Click “Fill in demo complaint”, then “Register complaint”.",
  },
  {
    title: "Samanvay finds the other bureau’s case",
    body: "As soon as the complaint is saved, Samanvay checks every other bureau’s cases. It finds the Regulation Bureau already working on the same college.",
    hint: "Read the warning, then click “Check and confirm”.",
  },
  {
    title: "An officer confirms",
    body: "Nothing is merged automatically. The officer sees why Samanvay thinks it is the same college, and decides.",
    hint: "Click “Yes, same college”.",
  },
  {
    title: "Both bureaus share one timeline",
    body: "The college now has one timeline with both bureaus’ actions, so neither acts without knowing what the other has done.",
    hint: null,
  },
];

const KEY = "samanvay.tour";
const TourContext = createContext(null);

function load() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY)) || { active: false, step: 1, timelineUrl: null };
  } catch {
    return { active: false, step: 1, timelineUrl: null };
  }
}

export function TourProvider({ children }) {
  const [tour, setTour] = useState(load);

  function save(next) {
    sessionStorage.setItem(KEY, JSON.stringify(next));
    setTour(next);
  }

  const api = {
    ...tour,
    start: () => save({ active: true, step: 1, timelineUrl: null }),
    end: () => save({ active: false, step: 1, timelineUrl: null }),
    /** Move forward to step n (never backwards); no-op when the tour is off. */
    reach: (n, extra = {}) => {
      if (tour.active && n > tour.step) save({ ...tour, ...extra, step: n });
    },
  };
  return <TourContext.Provider value={api}>{children}</TourContext.Provider>;
}

export const useTour = () => useContext(TourContext);
