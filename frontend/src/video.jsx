import { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { stepCaption, useTour } from "./tour";

// Video mode (press V): a large caption bar, a soft outline on the element being discussed, and no admin clutter.

const KEY = "samanvay.video";
const VideoContext = createContext({ on: false, toggle() {}, setCaption() {} });

// Captions for people who open a screen without the guided demo.
const ROUTE_CAPTIONS = {
  "/login": "Officers don’t need another dashboard. Samanvay checks across bureaus at the moment they’re about to act.",
  "/": "Your coordination inbox: what needs agreeing with another bureau.",
  "/reports": "Reports: the numbers and charts, away from the daily work.",
  "/how-it-works": "Match the college. Show the evidence. Check before acting. A person decides.",
  "/alerts": "Matches waiting for an officer to check.",
  "/new": "Register a complaint: Samanvay checks the other bureaus’ cases at once.",
  "/cases": "Every case from every bureau, in one list.",
  "/without-with": "Each bureau sees only its own cases.",
  "/stress": "Twenty ways to misspell one college. The real matcher, row by row.",
  "/accuracy": "Tested on made-up complaints where we know the right answer. Synthetic data.",
  "/audit": "Every decision is logged: who, what, when and why.",
  "/escalations": "Long-overdue cases can be escalated to a senior officer.",
};

function routeCaption(pathname) {
  if (pathname.startsWith("/links/")) return "Both bureaus’ cases, one timeline, and the notes between them.";
  if (pathname.startsWith("/institutions/")) return "One college, one timeline, across bureaus.";
  if (pathname.startsWith("/cases/")) return "Every action is checked against other bureaus before it is sent.";
  return ROUTE_CAPTIONS[pathname] || null;
}

function typing(el) {
  return el && (["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable);
}

export function VideoProvider({ children }) {
  const [on, setOn] = useState(() => {
    try {
      return sessionStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  });
  const [override, setOverride] = useState(null);

  const toggle = () =>
    setOn((v) => {
      try {
        sessionStorage.setItem(KEY, v ? "0" : "1");
      } catch {
        // not remembered; fine
      }
      return !v;
    });

  useEffect(() => {
    document.documentElement.dataset.video = on ? "on" : "off";
  }, [on]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key.toLowerCase() === "v" && !e.ctrlKey && !e.metaKey && !e.altKey && !typing(e.target)) toggle();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return <VideoContext.Provider value={{ on, toggle, override, setOverride }}>{children}</VideoContext.Provider>;
}

export const useVideo = () => useContext(VideoContext);

/** A screen with its own live caption (e.g. before/after a button) sets it here; it wins over the guided demo's. */
export function useVideoCaption(caption, target) {
  const { setOverride } = useVideo();
  useEffect(() => {
    setOverride(caption ? { caption, target } : null);
    return () => setOverride(null);
  }, [caption, target, setOverride]);
}

export function CaptionBar() {
  const { on, override } = useVideo();
  const tour = useTour();
  const { pathname } = useLocation();
  const current = override || (tour.active ? stepCaption(tour) : { caption: routeCaption(pathname), target: null });

  // Soft outline on the element being discussed. Polled because it may appear later (e.g. after "Register").
  useEffect(() => {
    if (!on || !current.target) return;
    let scrolled = false;
    const mark = () => {
      document.querySelectorAll("[data-tour-target]").forEach((el) => {
        const hit = el.dataset.tourTarget === current.target;
        el.classList.toggle("video-highlight", hit);
        // Bring the element into view once, so a long page does not hide what the caption is about.
        if (hit && !scrolled) {
          scrolled = true;
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    };
    mark();
    const t = setInterval(mark, 300);
    return () => {
      clearInterval(t);
      document.querySelectorAll(".video-highlight").forEach((el) => el.classList.remove("video-highlight"));
    };
  }, [on, current.target]);

  if (!on || !current.caption) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[70] flex justify-center bg-ink px-10 py-5 text-center font-semibold leading-snug text-white shadow-2xl"
      style={{ fontSize: "28px" }}
    >
      <span className="max-w-5xl">{current.caption}</span>
    </div>
  );
}
