import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { BureauTag, Button, Card, ErrorBox, PageTitle, Pct, StatusBadge } from "../components/ui";
import { BUREAUS, CATEGORIES, REGIONS, formatDate } from "../labels";

const EMPTY = {
  source_bureau: "", raw_institution_name: "", raw_address: "", district: "", region: "", category: "",
  description: "", complainant_name: "", permanent_id: "", received_date: "",
};

function Input({ label, name, form, setForm, required, as = "input", ...rest }) {
  const Tag = as;
  return (
    <label className="flex flex-col gap-1 text-base text-ink-2">
      <span>{label}{required && <span className="text-critical"> *</span>}</span>
      <Tag
        name={name}
        required={required}
        value={form[name]}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
        className="rounded-md border border-line bg-surface px-3 py-2 text-lg text-ink"
        {...rest}
      />
    </label>
  );
}

function OverlapBanner({ result }) {
  const mine = result.case;
  return (
    <section role="alert" className="mb-8 rounded-lg border-4 border-critical bg-alert-wash p-6 shadow">
      <h2 className="flex items-center gap-3 text-3xl font-bold text-ink">
        <span aria-hidden className="text-critical">⚠</span> {result.alert_title}
      </h2>
      <p className="mt-2 text-lg text-ink-2">
        New complaint <Link to={`/cases/${mine.id}`} className="font-semibold text-brand underline">{mine.case_id}</Link> looks like the
        same institution as {result.overlap_alerts.length === 1 ? "a case" : `${result.overlap_alerts.length} cases`} already handled by
        another bureau. Nothing has been merged — an officer must confirm.
      </p>
      {result.overlap_alerts.map((link) => {
        const other = link.case_a.id === mine.id ? link.case_b : link.case_a;
        return (
          <div key={link.id} className="mt-5 rounded-lg border border-line bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <BureauTag bureau={other.source_bureau} long />
                <span className="text-2xl font-semibold">{other.case_id}</span>
                <StatusBadge status={other.status} />
              </div>
              <span className="text-lg text-ink-2">
                confidence <span className="text-2xl font-semibold text-ink"><Pct value={link.scores.final_confidence} /></span>
              </span>
            </div>
            <dl className="mt-3 grid gap-3 text-lg sm:grid-cols-3">
              <div><dt className="text-base text-muted">Institution on their case</dt><dd className="font-medium">{other.raw_institution_name}</dd></div>
              <div><dt className="text-base text-muted">Their last action</dt><dd className="font-medium">{other.last_action}</dd></div>
              <div><dt className="text-base text-muted">Received</dt><dd>{formatDate(other.received_date)}</dd></div>
            </dl>
            <h3 className="mt-4 text-lg font-semibold">Evidence</h3>
            <ul className="mt-1 list-disc space-y-1 pl-6 text-lg">
              {link.scores.reasons.map((r) => <li key={r}>{r}</li>)}
            </ul>
            <Button to={`/links/${link.id}`} className="mt-4 text-xl">Open overlap review →</Button>
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

  async function loadDemo() {
    setError(null);
    try {
      const demo = await api("/demo/complaint");
      setForm({ ...EMPTY, ...Object.fromEntries(Object.entries(demo).map(([k, v]) => [k, v ?? ""])) });
      setNote(
        !isAdmin && user?.bureau !== demo.source_bureau
          ? `The demo complaint is a ${demo.source_bureau} complaint. Sign in as the ${demo.source_bureau} officer (or Admin) to submit it.`
          : "Demo complaint loaded: misspelled institution name, no permanent ID.",
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
      <PageTitle
        sub="The complaint is checked against other bureaus' cases as soon as it is saved."
        actions={<Button variant="secondary" onClick={loadDemo}>Load demo complaint</Button>}
      >
        New complaint
      </PageTitle>

      {result && result.overlap_alerts.length > 0 && <OverlapBanner result={result} />}
      {result && result.overlap_alerts.length === 0 && (
        <div role="status" className="mb-6 rounded-lg border-2 border-good bg-[#e6f4e6] p-5 text-lg">
          <span className="font-semibold text-good-text">✓ Saved as {result.case.case_id}.</span> No overlapping cases found in other bureaus.{" "}
          <Link to={`/cases/${result.case.id}`} className="font-semibold text-brand underline">Open case</Link>
        </div>
      )}

      {note && <p className="mb-4 rounded-md bg-brand-wash px-4 py-3 text-lg text-brand-dark">{note}</p>}
      <div className="mb-4"><ErrorBox error={error} /></div>

      <Card>
        <form onSubmit={submit} className="grid gap-5 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-base text-ink-2">
            <span>Filing bureau</span>
            {isAdmin ? (
              <select
                required
                value={form.source_bureau}
                onChange={(e) => setForm({ ...form, source_bureau: e.target.value })}
                className="rounded-md border border-line bg-surface px-3 py-2 text-lg text-ink"
              >
                <option value="">Choose…</option>
                {Object.entries(BUREAUS).map(([k, b]) => <option key={k} value={k}>{b.long}</option>)}
              </select>
            ) : (
              <span className="py-2"><BureauTag bureau={user?.bureau} long /> <span className="text-base text-muted">(your bureau)</span></span>
            )}
          </label>
          <Input label="Permanent ID (if known)" name="permanent_id" form={form} setForm={setForm} placeholder="e.g. SYN-100057" />
          <div className="md:col-span-2">
            <Input label="Institution name (as written by the complainant)" name="raw_institution_name" form={form} setForm={setForm} required minLength={3} />
          </div>
          <div className="md:col-span-2">
            <Input label="Institution address" name="raw_address" form={form} setForm={setForm} />
          </div>
          <Input label="District" name="district" form={form} setForm={setForm} />
          <label className="flex flex-col gap-1 text-base text-ink-2">
            <span>Region <span className="text-critical">*</span></span>
            <select required value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} className="rounded-md border border-line bg-surface px-3 py-2 text-lg text-ink">
              <option value="">Choose…</option>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-base text-ink-2">
            <span>Category <span className="text-critical">*</span></span>
            <select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded-md border border-line bg-surface px-3 py-2 text-lg text-ink">
              <option value="">Choose…</option>
              {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <Input label="Received on (defaults to today)" name="received_date" type="date" form={form} setForm={setForm} />
          <div className="md:col-span-2">
            <Input label="Complaint description" name="description" as="textarea" rows={3} form={form} setForm={setForm} required minLength={5} />
          </div>
          <Input label="Complainant name" name="complainant_name" form={form} setForm={setForm} />
          <div className="flex items-end justify-end md:col-span-2">
            <Button type="submit" disabled={busy} className="text-xl">{busy ? "Saving…" : "Save complaint and check for overlaps"}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
