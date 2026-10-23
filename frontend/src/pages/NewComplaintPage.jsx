import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import Evidence from "../components/Evidence";
import { Bureau, Button, Card, ErrorBox, PageTitle } from "../components/ui";
import { BUREAUS, CATEGORIES, OFFICIAL_TITLE, PLAIN_TITLE, REGIONS, bureauName, daysAgo, lowerFirst, plainAction } from "../labels";

const EMPTY = {
  source_bureau: "", raw_institution_name: "", raw_address: "", district: "", region: "", category: "",
  description: "", complainant_name: "", permanent_id: "", received_date: "",
};
const INPUT = "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-lg text-ink";

function Label({ text, required, children, wide }) {
  return (
    <label className={`flex flex-col gap-1.5 text-base text-ink-2 ${wide ? "md:col-span-2" : ""}`}>
      <span>{text}{required && <span className="text-muted"> (required)</span>}</span>
      {children}
    </label>
  );
}

/** The most important screen: calm, plain, and clear about what to do next. */
function MatchBanner({ result }) {
  const mine = result.case;
  return (
    <section role="alert" className="mb-8 rounded-xl border border-amber/30 bg-amber-wash p-6">
      <h2 className="text-3xl font-semibold">{PLAIN_TITLE}</h2>
      <p className="mt-1 text-lg font-semibold text-amber">{OFFICIAL_TITLE}</p>
      <p className="mt-3 text-lg text-ink-2">
        Your complaint was saved as <Link to={`/cases/${mine.id}`} className="text-ink underline decoration-line underline-offset-4 hover:decoration-ink">{mine.case_id}</Link>.
        Nothing has been merged: please check the match below before acting.
      </p>

      {result.overlap_alerts.map((link) => {
        const other = link.case_a.id === mine.id ? link.case_b : link.case_a;
        return (
          <div key={link.id} className="mt-5 rounded-xl bg-surface p-5">
            <p className="text-2xl leading-snug">
              The <span className="font-semibold">{bureauName(other.source_bureau)}</span> opened case{" "}
              <span className="font-semibold">{other.case_id}</span> on this college {daysAgo(other.received_date)}.
            </p>
            <p className="mt-2 text-xl text-ink-2">
              Last action: {lowerFirst(plainAction(other.last_action))}.
            </p>
            <p className="mt-1 text-lg text-muted">Their record: {other.raw_institution_name}{other.district ? `, ${other.district}` : ""}</p>
            <div className="mt-6 border-t border-line pt-6">
              <Evidence link={link} />
            </div>
            <Button to={`/links/${link.id}`} size="lg" className="mt-6">Check and confirm</Button>
          </div>
        );
      })}
    </section>
  );
}

export default function NewComplaintPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [form, setForm] = useState({ ...EMPTY, source_bureau: user?.bureau || "" });
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function fillDemo() {
    setError(null);
    try {
      const demo = await api("/demo/complaint");
      setForm({ ...EMPTY, ...Object.fromEntries(Object.entries(demo).map(([k, v]) => [k, v ?? ""])) });
      setNote(
        !isAdmin && user?.bureau !== demo.source_bureau
          ? `The demo complaint belongs to the ${bureauName(demo.source_bureau)}. Sign in as its officer (or as Administrator) to register it.`
          : "Demo complaint filled in: the college name is misspelled and there is no AICTE ID.",
      );
    } catch (e) {
      setError(e);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    const body = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ""));
    try {
      const res = await api("/cases", { method: "POST", body });
      setResult(res);
      setForm({ ...EMPTY, source_bureau: user?.bureau || "" });
      setNote(null);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {result && result.overlap_alerts.length > 0 && <div data-tour-target="overlap-banner"><MatchBanner result={result} /></div>}
      {result && result.overlap_alerts.length === 0 && (
        <div role="status" className="mb-6 rounded-xl border border-line bg-surface p-5 text-lg">
          <span className="font-semibold text-ok">✓ Saved as {result.case.case_id}.</span> No other bureau is handling this college.{" "}
          <Link to={`/cases/${result.case.id}`} className="text-ink underline decoration-line underline-offset-4 hover:decoration-ink">Open the case</Link>
        </div>
      )}

      {result ? (
        <Button variant="secondary" onClick={() => setResult(null)}>Register another complaint</Button>
      ) : (
      <>
      <PageTitle
        sub="When you register a complaint, Samanvay immediately checks whether another bureau is already handling the same college."
        actions={<Button variant="secondary" onClick={fillDemo}>Fill in demo complaint</Button>}
      >
        Register a complaint
      </PageTitle>

      {note && <p className="mb-6 rounded-lg bg-sand px-4 py-3 text-lg text-ink">{note}</p>}
      <div className="mb-6"><ErrorBox error={error} /></div>

      <Card data-tour-target="complaint-form">
        <form onSubmit={submit} className="grid gap-5 md:grid-cols-2">
          <Label text="Registering bureau">
            {isAdmin ? (
              <select required value={form.source_bureau} onChange={set("source_bureau")} className={INPUT}>
                <option value="">Choose…</option>
                {Object.entries(BUREAUS).map(([k, b]) => <option key={k} value={k}>{b.name}</option>)}
              </select>
            ) : (
              <span className="py-2.5 text-lg"><Bureau code={user?.bureau} /></span>
            )}
          </Label>
          <Label text="AICTE permanent ID, if known">
            <input name="permanent_id" value={form.permanent_id} onChange={set("permanent_id")} className={INPUT} placeholder="e.g. SYN-100057" />
          </Label>
          <Label text="College name, as written by the complainant" required wide>
            <input name="raw_institution_name" required minLength={3} value={form.raw_institution_name} onChange={set("raw_institution_name")} className={INPUT} />
          </Label>
          <Label text="College address" wide>
            <input name="raw_address" value={form.raw_address} onChange={set("raw_address")} className={INPUT} />
          </Label>
          <Label text="District">
            <input name="district" value={form.district} onChange={set("district")} className={INPUT} />
          </Label>
          <Label text="Region" required>
            <select required value={form.region} onChange={set("region")} className={INPUT}>
              <option value="">Choose…</option>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Label>
          <Label text="What is the complaint about?" required>
            <select required value={form.category} onChange={set("category")} className={INPUT}>
              <option value="">Choose…</option>
              {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Label>
          <Label text="Received on (leave empty for today)">
            <input name="received_date" type="date" value={form.received_date} onChange={set("received_date")} className={INPUT} />
          </Label>
          <Label text="Complaint" required wide>
            <textarea name="description" required minLength={5} rows={3} value={form.description} onChange={set("description")} className={INPUT} />
          </Label>
          <Label text="Complainant name">
            <input name="complainant_name" value={form.complainant_name} onChange={set("complainant_name")} className={INPUT} />
          </Label>
          <div className="flex items-end justify-end">
            <Button type="submit" size="lg" disabled={busy}>{busy ? "Checking…" : "Register complaint"}</Button>
          </div>
        </form>
      </Card>
      </>
      )}
    </div>
  );
}
