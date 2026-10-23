import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { Footer, Logo } from "../components/Layout";
import { ThreadsHero } from "../components/threads";
import { Bureau, Button, ErrorBox, Loading } from "../components/ui";
import { useApi } from "../hooks";
import { ROLES } from "../labels";
import { useTour } from "../tour";
import { CaptionBar } from "../video";

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
      navigate("/without-with");
    });
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto w-full max-w-6xl px-8 pt-6">
        <Logo />
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-8 py-6">
        <section className="moment anim-rise grid items-center gap-6 overflow-hidden rounded-3xl md:grid-cols-[1.15fr_1fr]" data-tour-target="hero">
          <div className="px-9 py-10">
            <p className="text-sm uppercase tracking-[0.16em] text-[#e0c9b4]">Samanvay · for AICTE bureaus</p>
            <h1 className="font-display mt-3 text-[44px] font-semibold leading-[1.08]">Check across bureaus before you act.</h1>
            <p className="mt-4 max-w-md text-xl text-[#e9e2d6]">
              Officers don’t need another dashboard. Samanvay checks across bureaus at the moment they’re about to act.
            </p>
            {users && (
              <div className="mt-7 flex flex-wrap items-center gap-4">
                <Button size="lg" className="!bg-[#fbf9f5] !text-ink" onClick={startTour} disabled={busy}>Start guided demo</Button>
                <span className="text-base text-[#cfc6b8]">About 3½ minutes</span>
                <Link to="/story" className="text-base text-[#e9e2d6] underline decoration-white/30 underline-offset-4 hover:decoration-white">Watch the story first</Link>
              </div>
            )}
          </div>
          <div className="h-[19rem] px-6 pb-4 md:h-[21rem]"><ThreadsHero /></div>
        </section>

        <ErrorBox error={error || loginError} />
        {loading && <Loading />}

        {users && (
          <>
            <h2 className="font-display mt-9 text-2xl font-semibold">Or sign in as a demo user</h2>
            <p className="mt-1 text-base text-muted">No passwords: this prototype uses demo users only.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  disabled={busy}
                  onClick={() => signIn(u, () => navigate(location.state?.from || "/", { replace: true }))}
                  className="rounded-xl border border-line bg-surface p-5 text-left transition-colors hover:border-ink disabled:opacity-60"
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
      <Footer width="max-w-6xl" />
      <CaptionBar />
    </div>
  );
}
