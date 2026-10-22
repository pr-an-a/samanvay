import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { ROLES } from "../labels";
import { BureauTag } from "./ui";

const NAV = [
  ["/", "Dashboard"],
  ["/cases", "Cases"],
  ["/alerts", "Overlap review"],
  ["/new", "New complaint"],
  ["/accuracy", "Matcher accuracy"],
];

export const FOOTER_TEXT = "Prototype on synthetic data. Not integrated with AICTE systems. SLA values are demo settings.";

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface px-6 py-4 text-center text-base text-ink-2">{FOOTER_TEXT}</footer>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-brand-dark text-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-6 py-3">
          <div>
            <div className="text-2xl font-bold tracking-wide">Samanvay</div>
            <div className="text-base text-white/85">Integrated complaint monitoring across AICTE bureaus</div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-lg font-semibold">{user?.name}</div>
              <div className="text-base text-white/85">{ROLES[user?.role] || user?.role}</div>
            </div>
            {user?.bureau && (
              <span className="hidden sm:inline">
                <BureauTag bureau={user.bureau} />
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="rounded-md border border-white/40 px-3 py-1.5 text-base font-semibold hover:bg-white/10"
            >
              Switch user
            </button>
          </div>
        </div>
        <nav className="border-t border-white/15">
          <ul className="mx-auto flex max-w-[1400px] flex-wrap gap-1 px-4">
            {NAV.map(([to, label]) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === "/"}
                  className={({ isActive }) =>
                    `block border-b-4 px-4 py-2.5 text-lg font-medium ${isActive ? "border-white text-white" : "border-transparent text-white/80 hover:text-white"}`
                  }
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
