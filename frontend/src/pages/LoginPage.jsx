import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { Footer } from "../components/Layout";
import { BureauTag, ErrorBox, Loading } from "../components/ui";
import { useApi } from "../hooks";
import { ROLES } from "../labels";

const ROLE_HELP = {
  RB_OFFICER: "Regulation Bureau cases, full complainant details for RB.",
  PGRC_OFFICER: "Public Grievance Redressal Cell. Use this role for the demo complaint.",
  REGIONAL: "Regional Office cases across the eight regions.",
  ADMIN: "Sees everything, including all complainant names.",
};

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: users, error, loading } = useApi("/auth/demo-users");
  const [busy, setBusy] = useState(null);
  const [loginError, setLoginError] = useState(null);

  async function choose(user) {
    setBusy(user.id);
    setLoginError(null);
    try {
      await login(user.id);
      navigate(location.state?.from || "/", { replace: true });
    } catch (e) {
      setLoginError(e);
      setBusy(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-brand-dark px-6 py-6 text-white">
        <div className="mx-auto max-w-4xl">
          <div className="text-3xl font-bold">Samanvay</div>
          <div className="text-lg text-white/85">Integrated complaint monitoring across AICTE bureaus</div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <h1 className="text-3xl font-semibold">Sign in with a demo role</h1>
        <p className="mt-2 text-lg text-ink-2">No passwords: this prototype uses demo users only.</p>
        <div className="mt-6">
          <ErrorBox error={error || loginError} />
          {loading && <Loading />}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {users?.map((u) => (
            <button
              key={u.id}
              type="button"
              disabled={busy !== null}
              onClick={() => choose(u)}
              className="rounded-lg border-2 border-line bg-surface p-5 text-left shadow-sm hover:border-brand disabled:opacity-60"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-2xl font-semibold text-ink">{ROLES[u.role] || u.role}</span>
                {u.bureau && <BureauTag bureau={u.bureau} />}
              </div>
              <div className="mt-1 text-lg text-ink-2">{u.name}</div>
              <div className="mt-2 text-base text-muted">{ROLE_HELP[u.role]}</div>
              {busy === u.id && <div className="mt-2 text-base text-brand">Signing in…</div>}
            </button>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
