import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useSlaSettings } from "../hooks";
import { useTour } from "../tour";
import { Button, Card, ErrorBox } from "./ui";

/** Administrator, demo mode only: put the demo data back between rehearsals. */
export default function DemoReset() {
  const { user } = useAuth();
  const settings = useSlaSettings();
  const tour = useTour();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  if (user?.role !== "ADMIN" || !settings?.demo_mode) return null;

  async function reset() {
    setBusy(true);
    setError(null);
    try {
      await api("/demo/reset", { method: "POST" });
      tour.end();
      window.location.assign("/"); // reload so every screen starts from the fresh data
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  }

  return (
    <Card title="Demo controls" sub="Only shown to the Administrator in demo mode.">
      {!confirming ? (
        <Button variant="secondary" onClick={() => setConfirming(true)}>Reset demo data</Button>
      ) : (
        <div className="rounded-lg border border-amber-line bg-amber-wash p-4">
          <p className="text-lg">
            Reset everything to the starting demo data? New complaints, decisions, escalations, alerts and audit entries made
            since the last reset will be removed. Everyone stays signed in.
          </p>
          <div className="mt-3 flex gap-3">
            <Button onClick={reset} disabled={busy}>{busy ? "Resetting…" : "Yes, reset demo data"}</Button>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={busy}>Cancel</Button>
          </div>
        </div>
      )}
      <div className="mt-3"><ErrorBox error={error} /></div>
    </Card>
  );
}
