import { Link, useParams } from "react-router-dom";
import LinkList from "../components/LinkList";
import { BureauTag, Card, ErrorBox, Field, Loading, OverdueBadge, PageTitle, StatusBadge } from "../components/ui";
import { useApi } from "../hooks";
import { CATEGORIES, formatDate, formatDateTime } from "../labels";

export default function CaseDetailPage() {
  const { id } = useParams();
  const { data: c, error, loading } = useApi(`/cases/${id}`);
  const { data: events } = useApi(`/cases/${id}/events`);
  const { data: links } = useApi(`/links?case_pk=${id}`);

  if (error) return <ErrorBox error={error} />;
  if (loading || !c) return <Loading />;

  return (
    <div>
      <PageTitle sub={c.raw_institution_name}>
        <span className="mr-3">{c.case_id}</span>
        <BureauTag bureau={c.source_bureau} long />
      </PageTitle>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Case details" className="lg:col-span-2">
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <Field label="Institution (as filed)">{c.raw_institution_name}</Field>
            <Field label="Registered institution">
              {c.institution_id ? (
                <Link to={`/institutions/${c.institution_id}`} className="text-brand underline underline-offset-2">
                  Open institution profile
                </Link>
              ) : (
                <span className="text-ink-2">No permanent ID on this complaint</span>
              )}
            </Field>
            <Field label="Address">{c.raw_address}</Field>
            <Field label="District / region">{[c.district, c.region].filter(Boolean).join(", ") || "—"}</Field>
            <Field label="Category">{CATEGORIES[c.category] || c.category}</Field>
            <Field label="Status">
              <span className="flex flex-wrap gap-2">
                <StatusBadge status={c.status} /> <OverdueBadge caseItem={c} />
              </span>
            </Field>
            <Field label="Received">{formatDate(c.received_date)}</Field>
            <Field label="Expected disposal (demo SLA)">{formatDate(c.expected_disposal_date)}</Field>
            <Field label="Assigned officer">{c.assigned_officer}</Field>
            <Field label="Complainant">
              {c.complainant_name || "—"}
              {c.complainant_masked && <span className="ml-2 text-base text-muted">(masked: another bureau's case)</span>}
            </Field>
            <Field label="Last action">{c.last_action}</Field>
            <Field label="Next action">{c.next_action}</Field>
          </dl>
          <div className="mt-5">
            <dt className="text-base text-muted">Description</dt>
            <dd className="mt-1 text-lg">{c.description}</dd>
          </div>
        </Card>

        <Card title="Overlap links">
          <LinkList links={links} empty="No overlap with other bureaus' cases." />
        </Card>
      </div>

      <Card title="Action history" className="mt-6">
        <ol className="relative ml-3 border-l-2 border-line">
          {events?.map((e) => (
            <li key={e.id} className="mb-5 ml-6">
              <span className="absolute -left-[9px] mt-1.5 h-4 w-4 rounded-full border-2 border-surface bg-brand" />
              <div className="tabular text-base text-muted">{formatDateTime(e.timestamp)}</div>
              <div className="text-lg font-semibold">{e.action}</div>
              <div className="text-base text-ink-2">
                {e.actor} · {e.bureau}
                {e.remarks && <span> · “{e.remarks}”</span>}
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
