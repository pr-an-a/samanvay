import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { ROLES } from "../labels";
import { useTour } from "../tour";
import AlertsBell from "./AlertsBell";
import TourPanel from "./TourPanel";

const NAV = [
  ["/", "Overview"],
  ["/alerts", "Needs your check"],
  ["/new", "Register complaint"],
  ["/cases", "All cases"],
  ["/accuracy", "How accurate is matching?"],
];
const ADMIN_NAV = [
  ["/escalations", "Escalations"],
  ["/audit", "Audit log"],
];

export const FOOTER_TEXT = "Prototype on synthetic data. Not integrated with AICTE systems. SLA values are demo settings, not official AICTE timelines.";

export function Footer() {
  return <footer className="px-6 py-6 text-center text-base text-muted">{FOOTER_TEXT}</footer>;
}

export function Brand() {
  return (
    <div>
      <div className="text-2xl font-semibold tracking-tight">Samanvay</div>
      <div className="text-base text-white/75">One view of complaints across AICTE bureaus</div>
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const tour = useTour();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-6 px-8 pt-5">
          <Brand />
          <div className="flex items-center gap-5">
            <AlertsBell />
            <div className="text-right">
              <div className="font-semibold">{user?.name}</div>
              <div className="text-base text-white/75">{ROLES[user?.role] || user?.role}</div>
            </div>
            <button
              type="button"
              onClick={() => {
                tour.end();
                logout();
                navigate("/login");
              }}
              className="rounded-lg border border-white/30 px-4 py-2 text-base font-semibold hover:bg-white/10"
            >
              Switch user
            </button>
          </div>
        </div>
        <nav className="mx-auto max-w-[1360px] px-6">
          <ul className="flex flex-wrap gap-2 pt-3">
            {[...NAV, ...(user?.role === "ADMIN" ? ADMIN_NAV : [])].map(([to, label]) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === "/"}
                  className={({ isActive }) =>
                    `block border-b-[3px] px-3 py-3 text-base ${isActive ? "border-white font-semibold text-white" : "border-transparent text-white/75 hover:text-white"}`
                  }
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-[1360px] flex-1 px-8 py-10">
        {tour.active ? (
          // The guided-demo panel gets its own column so it never covers a button.
          <div className="flex items-start gap-8">
            <div className="min-w-0 flex-1">
              <Outlet />
            </div>
            <TourPanel />
          </div>
        ) : (
          <Outlet />
        )}
      </main>
      <Footer />
    </div>
  );
}
