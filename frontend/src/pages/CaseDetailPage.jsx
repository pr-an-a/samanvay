import { useParams } from "react-router-dom";
import LinkList from "../components/LinkList";
import { Bureau, Card, ErrorBox, Field, Loading, SlaTag, PageTitle, Status, TextLink } from "../components/ui";
import { useApi } from "../hooks";
import { CATEGORIES, formatDate, formatDateTime, plainAction } from "../labels";

export default function CaseDetailPage() {
  const { id } = useParams();
  const { data: c, error, loading } = useApi(`/cases/${id}`);
  const { data: events } = useApi(`/cases/${id}/events`);
  const { data: links } = useApi(`/links?case_pk=${id}`);

  if (error) return <ErrorBox error={error} />;
  if (loading || !c) return <Loading />;

  return (
    <div className="space-y-6">
      <PageTitle sub={<Bureau code={c.source_bureau} />}>
        Case {c.case_id}
      </PageTitle>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title={c.raw_institution_name} sub="College name as written in the complaint" className="lg:col-span-2">
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <Field label="Address">{c.raw_address}</Field>
            <Field label="District, region">{[c.district, c.region].filter(Boolean).join(", ") || "—"}</Field>
            <Field label="AICTE ID">
              {c.institution_id ? <TextLink to={`/institutions/${c.institution_id}`}>Registered: open college profile</TextLink> : "Not given in the complaint"}
            </Field>
            <Field label="Topic">{CATEGORIES[c.category] || c.category}</Field>
            <Field label="Status">
              <Status status={c.status} /> <SlaTag caseItem={c} />
            </Field>
            <Field label="Received">{formatDate(c.received_date)}</Field>
            <Field label="Due date (demo setting, not an official AICTE timeline)">{formatDate(c.expected_disposal_date)}</Field>
            <Field label="Officer">{c.assigned_officer}</Field>
            <Field label="Last action">{plainAction(c.last_action)}</Field>
            <Field label="Next step">{plainAction(c.next_action)}</Field>
            <Field label="Complainant">
              {c.complainant_name || "—"}
              {c.complainant_masked && <span className="ml-2 text-base text-muted">(hidden: another bureau’s case)</span>}
            </Field>
          </dl>
          <div className="mt-6 border-t border-line pt-5">
            <Field label="Complaint">{c.description}</Field>
          </div>
        </Card>

        <Card title="Other bureaus on this college">
          <LinkList links={links} empty="No other bureau is handling this college." />
        </Card>
      </div>

      <Card title="History">
        <ol className="space-y-5">
          {events?.map((e) => (
            <li key={e.id} className="grid gap-1 border-l-2 border-line pl-5 sm:grid-cols-[13rem_1fr]">
              <div className="tabular text-base text-muted">{formatDateTime(e.timestamp)}</div>
              <div>
                <div className="text-lg font-semibold">{plainAction(e.action)}</div>
                <div className="text-base text-ink-2">
                  {e.actor}
                  {e.remarks && <> · “{e.remarks}”</>}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
