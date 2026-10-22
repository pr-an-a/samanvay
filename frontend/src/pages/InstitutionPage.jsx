import { Link, useParams } from "react-router-dom";
import LinkList from "../components/LinkList";
import { BureauTag, Card, ErrorBox, Field, Loading, OverdueBadge, PageTitle, StatusBadge } from "../components/ui";
import { useApi } from "../hooks";
import { BUREAUS, CATEGORIES, formatDate, formatDateTime } from "../labels";

export default function InstitutionPage() {
  const { id } = useParams();
  const { data: inst, error, loading } = useApi(`/institutions/${id}`);

  if (error) return <ErrorBox error={error} />;
  if (loading || !inst) return <Loading />;

  const bureaus = [...new Set(inst.cases.map((c) => c.source_bureau))];

  return (
    <div>
      <PageTitle sub={`Permanent ID ${inst.permanent_id}`}>{inst.name}</PageTitle>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Institution">
          <dl className="space-y-4">
            <Field label="Address">{inst.address}</Field>
            <Field label="District / region">{inst.district}, {inst.region}</Field>
            <Field label="Cases across bureaus">
              <span className="flex flex-wrap gap-2">
                {bureaus.map((b) => (
                  <span key={b} className="flex items-center gap-1">
                    <BureauTag bureau={b} /> <span className="tabular">× {inst.cases.filter((c) => c.source_bureau === b).length}</span>
                  </span>
                ))}
              </span>
            </Field>
          </dl>
          <p className="mt-4 text-base text-ink-2">
            Includes cases filed with this permanent ID and cases an officer has confirmed as the same institution.
            Suggested links are not merged until confirmed.
          </p>
        </Card>

        <Card title="Unified timeline" className="lg:col-span-2">
          <div className="mb-3 flex flex-wrap gap-3 text-base text-ink-2">
            Bureau key:
            {Object.keys(BUREAUS).map((b) => (
              <BureauTag key={b} bureau={b} long />
            ))}
          </div>
          <ol className="max-h-[38rem] overflow-y-auto pr-2">
            {inst.timeline.map((t, i) => (
              <li
                key={i}
                className="grid grid-cols-[11rem_1fr] gap-4 border-l-4 py-2.5 pl-4"
                style={{ borderColor: BUREAUS[t.case_bureau]?.color }}
              >
                <div className="tabular text-base text-muted">{formatDateTime(t.timestamp)}</div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <BureauTag bureau={t.case_bureau} />
                    <Link to={`/cases/${t.case_pk}`} className="text-lg font-medium text-brand underline-offset-2 hover:underline">
                      {t.case_id}
                    </Link>
                    {t.via_confirmed_link && (
                      <span className="rounded bg-[#e6f4e6] px-2 py-0.5 text-base font-semibold text-good-text">✓ via confirmed link</span>
                    )}
                  </div>
                  <div className="text-lg font-semibold">{t.action}</div>
                  <div className="text-base text-ink-2">
                    {t.actor}
                    {t.remarks && <span> · “{t.remarks}”</span>}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title={`Cases (${inst.cases.length})`}>
          <ul className="divide-y divide-line">
            {inst.cases.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <BureauTag bureau={c.source_bureau} />
                  <Link to={`/cases/${c.id}`} className="text-lg font-medium text-brand underline-offset-2 hover:underline">
                    {c.case_id}
                  </Link>
                  <span className="text-base text-ink-2">{CATEGORIES[c.category]}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tabular text-base text-muted">{formatDate(c.received_date)}</span>
                  <StatusBadge status={c.status} />
                  <OverdueBadge caseItem={c} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Overlap links">
          <LinkList links={inst.links} empty="No overlap links for this institution's cases." />
        </Card>
      </div>
    </div>
  );
}
