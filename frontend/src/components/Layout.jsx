import { useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useApi } from "../hooks";
import { ROLES } from "../labels";
import { useTour } from "../tour";
import AlertsBell from "./AlertsBell";
import Icon from "./icons";
import TourPanel from "./TourPanel";

const NAV = [
  ["/", "Overview", "overview"],
  ["/alerts", "Needs check", "check"],
  ["/new", "Register", "register"],
  ["/cases", "All cases", "cases"],
  ["/accuracy", "Accuracy", "accuracy"],
];
const ADMIN_NAV = [
  ["/escalations", "Escalations", "escalate"],
  ["/audit", "Audit log", "audit"],
];

export const FOOTER_TEXT = "Prototype on synthetic data. Not integrated with AICTE systems. SLA values are demo settings, not official AICTE timelines.";

export function Footer() {
  return <footer className="px-8 py-6 text-base text-ink-2">{FOOTER_TEXT}</footer>;
}

export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-ink text-white">
        <Icon name="logo" size={22} />
      </span>
      <span className="text-xl font-semibold text-ink">Samanvay</span>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function NavItem({ to, label, icon, count }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-4 py-2.5 text-lg ${isActive ? "bg-ink text-white" : "text-ink hover:bg-surface"}`
      }
    >
      <Icon name={icon} size={20} />
      <span className="flex-1 whitespace-nowrap">{label}</span>
      {count > 0 && (
        <span className="tabular rounded-full bg-amber-wash px-2.5 py-0.5 text-base text-amber" aria-label={`${count} need your check`}>
          {count}
        </span>
      )}
    </NavLink>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const tour = useTour();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data: stats, reload } = useApi("/dashboard/stats");
  const isAdmin = user?.role === "ADMIN";

  // Keep the "Needs check" count current as the officer moves around.
  useEffect(() => {
    reload();
  }, [pathname, reload]);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-line bg-sand px-4 py-6">
        <div className="px-2">
          <Logo />
        </div>
        <nav className="mt-8 flex-1 space-y-1.5" aria-label="Main">
          {NAV.map(([to, label, icon]) => (
            <NavItem key={to} to={to} label={label} icon={icon} count={to === "/alerts" ? stats?.overlaps.suggested : 0} />
          ))}
          {isAdmin && (
            <>
              <div className="px-4 pb-1 pt-6 text-base text-ink-2">Admin</div>
              {ADMIN_NAV.map(([to, label, icon]) => <NavItem key={to} to={to} label={label} icon={icon} />)}
            </>
          )}
        </nav>
        <div className="border-t border-line px-2 pt-4">
          <div className="font-semibold text-ink">{user?.name}</div>
          <div className="text-base text-ink-2">{ROLES[user?.role] || user?.role}</div>
          <button
            type="button"
            onClick={() => {
              tour.end();
              logout(); // the next person starts on the overview (see RequireAuth)
              navigate("/login", { replace: true });
            }}
            className="mt-3 rounded-lg border border-line bg-surface px-3 py-1.5 text-base text-ink hover:border-ink"
          >
            Switch user
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-start justify-between gap-6 px-8 pt-8">
          {pathname === "/" ? (
            // The greeting belongs to the overview; other pages start with their own title.
            <div>
              <div className="text-3xl font-semibold text-ink">
                {greeting()}, {user?.name?.split(" ")[0]}
              </div>
              <div className="mt-1 text-lg text-ink-2">{ROLES[user?.role] || user?.role}</div>
            </div>
          ) : (
            <div />
          )}
          <AlertsBell />
        </header>
        <main className="w-full max-w-[1280px] flex-1 px-8 py-8">
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
    </div>
  );
}
