import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./auth";
import { ROLES } from "./labels";
import { useLocation } from "react-router-dom";
import { stepCaption, useTour } from "./tour";

// Video mode (press V): a large caption bar, a soft outline on the element being discussed, and no admin clutter.

const KEY = "samanvay.video";
const VideoContext = createContext({ on: false, toggle() {}, setCaption() {} });

// Captions for people who open a screen without the guided demo.
const ROUTE_CAPTIONS = {
  "/story": "Illustrative scenario: a student’s complaint, and another bureau already acting.",
  "/login": "Officers don’t need another dashboard. Samanvay checks across bureaus at the moment they’re about to act.",
  "/": "Your coordination inbox: what needs agreeing with another bureau.",
  "/reports": "One dashboard: every bureau’s pending, ageing and overdue cases together.",
  "/how-it-works": "ID match, fuzzy names, description similarity, clash rules. Explainable, no black-box AI.",
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
  // The video recorder (sessionStorage "samanvay.rec") sets these: the spoken sentence, and who we are watching.
  const [subtitle, setSubtitle] = useState("");
  const [persona, setPersona] = useState(undefined); // undefined = the signed-in user; null = nobody
  useEffect(() => {
    window.__setSubtitle = setSubtitle;
    window.__setPersona = setPersona;
    return () => { delete window.__setSubtitle; delete window.__setPersona; };
  }, []);

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
    document.documentElement.dataset.rec = (() => { try { return sessionStorage.getItem("samanvay.rec") === "1" ? "1" : "0"; } catch { return "0"; } })();
  }, [on]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key.toLowerCase() === "v" && !e.ctrlKey && !e.metaKey && !e.altKey && !typing(e.target)) toggle();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return <VideoContext.Provider value={{ on, toggle, override, setOverride, subtitle, persona }}>{children}</VideoContext.Provider>;
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

const recording = () => { try { return sessionStorage.getItem("samanvay.rec") === "1"; } catch { return false; } };

/** Top-left, in video mode: who we are watching ("Priya · Grievance Cell officer"). */
function PersonaLabel() {
  const { on, persona } = useVideo();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const text = persona !== undefined ? persona : user && pathname !== "/login" && pathname !== "/story" ? `${user.name.split(" ")[0]} · ${ROLES[user.role] || user.role}` : null;
  if (!on || !text) return null;
  return (
    <div data-persona className="fixed left-3 top-2 z-[70] rounded-full bg-ink px-4 py-1.5 text-lg font-semibold text-white shadow-lg" style={{ borderLeft: "5px solid var(--color-accent-line, #e8967a)" }}>
      {text}
    </div>
  );
}

export function CaptionBar() {
  const { on, override, subtitle } = useVideo();
  const tour = useTour();
  const { pathname } = useLocation();
  const rec = recording();
  // While recording, the bar shows the sentence being spoken, nothing else.
  const current = rec ? { caption: subtitle, target: null }
    : override || (tour.active ? stepCaption(tour) : { caption: routeCaption(pathname), target: null });

  // Soft outline on the element being discussed. Polled because it may appear later (e.g. after "Register").
  useEffect(() => {
    if (!on || !current.target || rec) return;
    let scrolled = false;
    const mark = () => {
      document.querySelectorAll("[data-tour-target]").forEach((el) => {
        const hit = el.dataset.tourTarget === current.target;
        el.classList.toggle("video-highlight", hit);
        // Bring the element into view once, so a long page does not hide what the caption is about.
        if (hit && !scrolled) {
          scrolled = true;
          const r = el.getBoundingClientRect();
          const bar = document.querySelector("[role=status][aria-live]");
          const limit = bar ? bar.getBoundingClientRect().top : innerHeight;
          if (r.top < 0 || r.bottom > limit) el.scrollIntoView({ behavior: "smooth", block: r.height > limit * 0.6 ? "start" : "center" });
        }
      });
    };
    mark();
    const t = setInterval(mark, 300);
    return () => {
      clearInterval(t);
      document.querySelectorAll(".video-highlight").forEach((el) => el.classList.remove("video-highlight"));
    };
  }, [on, current.target, rec]);

  if (!on) return null;
  return (
    <>
      <PersonaLabel />
      {current.caption && (
        <div
          role="status"
          aria-live="polite"
          data-caption-bar
          className="fixed inset-x-0 bottom-0 z-[70] flex justify-center bg-ink px-10 py-4 text-center font-semibold leading-snug text-white shadow-2xl"
          style={{ fontSize: rec ? "26px" : "28px" }}
        >
          <span className="max-w-5xl">{current.caption}</span>
        </div>
      )}
    </>
  );
}
