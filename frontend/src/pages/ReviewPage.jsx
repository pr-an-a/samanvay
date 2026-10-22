import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import Evidence from "../components/Evidence";
import { Bureau, Button, Card, ErrorBox, Field, LinkStatus, Loading, OverdueTag, Status, TextLink } from "../components/ui";
import { useApi } from "../hooks";
import { CATEGORIES, OFFICIAL_TITLE, PLAIN_TITLE, daysAgo, formatDate, formatDateTime, plainAction } from "../labels";
import { useTour } from "../tour";

function CaseSide({ c }) {
  return (
    <Card>
      <Bureau code={c.source_bureau} className="text-lg font-semibold" />
      <div className="mt-1 text-base text-muted">
        Case <Link to={`/cases/${c.id}`} className="text-accent underline-offset-4 hover:underline">{c.case_id}</Link> · opened {daysAgo(c.received_date)}
      </div>
      <p className="mt-4 text-xl font-semibold">{c.raw_institution_name}</p>
      <p className="text-lg text-ink-2">{c.raw_address || "No address given"}</p>
      <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <Field label="District">{c.district}</Field>
        <Field label="AICTE ID">{c.institution_id ? <TextLink to={`/institutions/${c.institution_id}`}>Registered: open profile</TextLink> : "Not given"}</Field>
        <Field label="Complaint about">{CATEGORIES[c.category]}</Field>
        <Field label="Status">
          <Status status={c.status} /> <OverdueTag caseItem={c} />
        </Field>
        <div className="sm:col-span-2"><Field label="Last action">{plainAction(c.last_action)}</Field></div>
        <div className="sm:col-span-2"><Field label="Complaint">{c.description}</Field></div>
      </dl>
    </Card>
  );
}

export default function ReviewPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const tour = useTour();
  const { data: link, error, loading, reload } = useApi(`/links/${id}`);
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    if (link?.status === "suggested") tour.reach(3);
  }, [link?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const institutionId = link && (link.case_a.institution_id || link.case_b.institution_id);

  async function decide(action) {
    setBusy(true);
    setActionError(null);
    try {
      await api(`/links/${id}/${action}`, { method: "POST", body: { remarks: remarks.trim() || null } });
      if (action === "confirm") tour.reach(4, { timelineUrl: institutionId ? `/institutions/${institutionId}` : null });
      reload();
    } catch (e) {
      setActionError(e);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorBox error={error} />;
  if (loading || !link) return <Loading />;

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-2"><LinkStatus status={link.status} /></div>
        <h1 className="text-3xl font-semibold">Is this the same college?</h1>
        <p className="mt-1 text-lg font-semibold text-amber">{OFFICIAL_TITLE}</p>
        <p className="mt-2 text-lg text-ink-2">{PLAIN_TITLE}. Compare the two cases, then decide.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <CaseSide c={link.case_a} />
        <CaseSide c={link.case_b} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <Evidence link={link} />
        </Card>

        <Card title="Your decision" className="lg:col-span-2">
          {link.status === "suggested" ? (
            <>
              <label className="block text-base text-ink-2" htmlFor="remarks">Note for both bureaus (optional)</label>
              <textarea
                id="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                className="mt-2 w-full rounded-lg border border-line p-3 text-lg"
                placeholder="e.g. Coordinate with the Regulation Bureau before the next hearing"
              />
              <div className="mt-4 flex flex-col gap-3">
                <Button size="lg" disabled={busy} onClick={() => decide("confirm")}>Yes, same college</Button>
                <Button size="lg" variant="secondary" disabled={busy} onClick={() => decide("reject")}>No, different colleges</Button>
              </div>
              <p className="mt-4 text-base text-muted">
                Deciding as {user?.name}. “Yes” links the two cases so both bureaus see each other’s actions. Nothing is merged.
              </p>
            </>
          ) : (
            <div className="space-y-4 text-lg">
              <p>
                {link.status === "confirmed" ? "Confirmed as the same college" : "Marked as different colleges"} by{" "}
                <span className="font-semibold">{link.reviewer_name || `user #${link.reviewed_by}`}</span>
                <br />
                <span className="tabular text-ink-2">{formatDateTime(link.reviewed_at)}</span>
              </p>
              <p className="text-base text-ink-2">The decision and note are in both cases’ history.</p>
              {link.status === "confirmed" && institutionId && (
                <Button to={`/institutions/${institutionId}`} size="lg">See the shared timeline</Button>
              )}
            </div>
          )}
          <div className="mt-4"><ErrorBox error={actionError} /></div>
        </Card>
      </div>
      <p className="text-base text-muted">Match found {formatDate(link.created_at)}.</p>
    </div>
  );
}
