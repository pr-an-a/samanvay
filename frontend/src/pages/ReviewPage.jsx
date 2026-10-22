import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import ScoreBreakdown from "../components/ScoreBreakdown";
import { BureauTag, Button, Card, ErrorBox, Field, LinkStatusBadge, Loading, OverdueBadge, PageTitle, StatusBadge } from "../components/ui";
import { useApi } from "../hooks";
import { CATEGORIES, OVERLAP_TITLE, formatDate, formatDateTime } from "../labels";

function CaseSide({ c }) {
  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-3">
          <BureauTag bureau={c.source_bureau} long />
          <Link to={`/cases/${c.id}`} className="text-brand underline-offset-2 hover:underline">{c.case_id}</Link>
        </span>
      }
    >
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Institution (as filed)"><span className="text-xl font-semibold">{c.raw_institution_name}</span></Field>
        </div>
        <div className="sm:col-span-2"><Field label="Address">{c.raw_address}</Field></div>
        <Field label="District / region">{[c.district, c.region].filter(Boolean).join(", ") || "—"}</Field>
        <Field label="Permanent ID">
          {c.institution_id ? <Link to={`/institutions/${c.institution_id}`} className="text-brand underline">Registered — open profile</Link> : "Not given"}
        </Field>
        <Field label="Category">{CATEGORIES[c.category]}</Field>
        <Field label="Status">
          <span className="flex flex-wrap gap-2"><StatusBadge status={c.status} /><OverdueBadge caseItem={c} /></span>
        </Field>
        <Field label="Received">{formatDate(c.received_date)}</Field>
        <Field label="Last action">{c.last_action}</Field>
        <Field label="Complainant">{c.complainant_name || "—"}</Field>
        <Field label="Assigned officer">{c.assigned_officer}</Field>
        <div className="sm:col-span-2"><Field label="Description">{c.description}</Field></div>
      </dl>
    </Card>
  );
}

export default function ReviewPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: link, error, loading, reload } = useApi(`/links/${id}`);
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  async function decide(action) {
    setBusy(true);
    setActionError(null);
    try {
      await api(`/links/${id}/${action}`, { method: "POST", body: { remarks: remarks.trim() || null } });
      reload();
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorBox error={error} />;
  if (loading || !link) return <Loading />;
  const s = link.scores;

  return (
    <div>
      <PageTitle sub={<span className="flex flex-wrap items-center gap-3">Overlap link #{link.id} <LinkStatusBadge status={link.status} /></span>}>
        {OVERLAP_TITLE}
      </PageTitle>

      <div className="grid gap-6 lg:grid-cols-2">
        <CaseSide c={link.case_a} />
        <CaseSide c={link.case_b} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card title="Score breakdown" className="lg:col-span-3">
          <ScoreBreakdown scores={s} />
        </Card>
        <div className="space-y-6 lg:col-span-2">
          <Card title="Why the matcher suggested this">
            <ul className="list-disc space-y-2 pl-6 text-lg">
              {s.reasons.map((r) => <li key={r}>{r}</li>)}
            </ul>
            {s.issue_label && (
              <p className="mt-4 rounded-md bg-brand-wash px-3 py-2 text-lg font-semibold text-brand-dark">Issue: {s.issue_label}</p>
            )}
          </Card>

          <Card title="Officer decision">
            {link.status === "suggested" ? (
              <>
                <label className="block text-base text-ink-2" htmlFor="remarks">Remarks (recorded on both cases)</label>
                <textarea
                  id="remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-line p-2 text-lg"
                  placeholder="e.g. Same institution; coordinate with RB before next hearing"
                />
                <div className="mt-3 flex flex-wrap gap-3">
                  <Button variant="good" disabled={busy} onClick={() => decide("confirm")}>✓ Confirm same institution</Button>
                  <Button variant="danger" disabled={busy} onClick={() => decide("reject")}>✕ Reject</Button>
                </div>
                <p className="mt-3 text-base text-muted">Deciding as {user?.name}. Confirming links the cases; it never merges them.</p>
              </>
            ) : (
              <div className="space-y-2 text-lg">
                <LinkStatusBadge status={link.status} />
                <p>
                  Reviewed by <span className="font-semibold">{link.reviewer_name || `user #${link.reviewed_by}`}</span> on{" "}
                  <span className="tabular">{formatDateTime(link.reviewed_at)}</span>.
                </p>
                <p className="text-base text-ink-2">The decision and remarks are in both cases' action history.</p>
              </div>
            )}
            <div className="mt-3"><ErrorBox error={actionError} /></div>
          </Card>
        </div>
      </div>
    </div>
  );
}
