import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { Brand, Footer } from "../components/Layout";
import { Bureau, Button, ErrorBox, Loading } from "../components/ui";
import { useApi } from "../hooks";
import { ROLES } from "../labels";
import { useTour } from "../tour";

const ROLE_HELP = {
  RB_OFFICER: "Handles approvals and regulatory action.",
  PGRC_OFFICER: "Handles complaints from students and parents.",
  REGIONAL: "Handles cases in the regional offices.",
  ADMIN: "Sees every bureau, including complainant names.",
};

export default function LoginPage() {
  const { login } = useAuth();
  const tour = useTour();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: users, error, loading } = useApi("/auth/demo-users");
  const [busy, setBusy] = useState(false);
  const [loginError, setLoginError] = useState(null);

  async function signIn(user, then) {
    setBusy(true);
    setLoginError(null);
    try {
      await login(user.id);
      then();
    } catch (e) {
      setLoginError(e);
      setBusy(false);
    }
  }

  function startTour() {
    const officer = users.find((u) => u.role === "PGRC_OFFICER");
    signIn(officer, () => {
      tour.start();
      navigate("/new");
    });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-navy px-8 py-6 text-white">
        <div className="mx-auto max-w-5xl">
          <Brand />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-8 py-12">
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight">
          Spot when two AICTE bureaus are acting on the same college.
        </h1>
        <p className="mt-4 max-w-3xl text-xl text-ink-2">
          Different bureaus can act on the same college without knowing it. Samanvay spots this and warns officers before
          duplicate or conflicting action.
        </p>

        <ErrorBox error={error || loginError} />
        {loading && <Loading />}

        {users && (
          <>
            <section className="mt-10 flex flex-wrap items-center justify-between gap-6 rounded-xl border border-line bg-surface p-6">
              <div className="max-w-2xl">
                <h2 className="text-xl font-semibold">New here? Take the 2-minute guided demo</h2>
                <p className="mt-1 text-lg text-ink-2">
                  Four steps: a complaint arrives, Samanvay finds the other bureau’s case, an officer confirms, and both bureaus
                  share one timeline.
                </p>
              </div>
              <Button size="lg" onClick={startTour} disabled={busy}>
                Start guided demo
              </Button>
            </section>

            <h2 className="mt-12 text-xl font-semibold">Or sign in as a demo user</h2>
            <p className="mt-1 text-base text-muted">No passwords: this prototype uses demo users only.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  disabled={busy}
                  onClick={() => signIn(u, () => navigate(location.state?.from || "/", { replace: true }))}
                  className="rounded-xl border border-line bg-surface p-5 text-left transition-colors hover:border-accent disabled:opacity-60"
                >
                  <div className="text-lg font-semibold">{ROLES[u.role] || u.role}</div>
                  <div className="mt-1 text-base text-ink-2">{ROLE_HELP[u.role]}</div>
                  {u.bureau && <Bureau code={u.bureau} className="mt-3 text-base" />}
                </button>
              ))}
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
