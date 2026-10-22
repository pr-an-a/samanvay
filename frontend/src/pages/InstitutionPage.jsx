import { Link, useParams } from "react-router-dom";
import LinkList from "../components/LinkList";
import { Bureau, Card, ErrorBox, Loading, SlaTag, PageTitle, Status } from "../components/ui";
import { useApi } from "../hooks";
import { BUREAUS, CATEGORIES, bureauName, formatDate, formatDateTime, plainAction } from "../labels";

export default function InstitutionPage() {
  const { id } = useParams();
  const { data: inst, error, loading } = useApi(`/institutions/${id}`);

  if (error) return <ErrorBox error={error} />;
  if (loading || !inst) return <Loading />;

  const bureaus = [...new Set(inst.cases.map((c) => c.source_bureau))];
  const count = (b) => inst.cases.filter((c) => c.source_bureau === b).length;

  return (
    <div className="space-y-6">
      <PageTitle sub={`${inst.address} · AICTE permanent ID ${inst.permanent_id}`}>{inst.name}</PageTitle>

      <Card>
        <p className="text-lg">
          {bureaus.length > 1 ? (
            <>
              <span className="font-semibold">{bureaus.map(bureauName).join(" and ")}</span> are both working on this college.
              Their actions appear together on the timeline below.
            </>
          ) : (
            <>Only the <span className="font-semibold">{bureauName(bureaus[0])}</span> is working on this college.</>
          )}
        </p>
        <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-base">
          {bureaus.map((b) => (
            <li key={b} className="flex items-center gap-2">
              <Bureau code={b} />
              <span className="text-ink-2">{count(b)} case{count(b) === 1 ? "" : "s"}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-base text-muted">
          Includes cases filed with this AICTE ID and cases an officer has confirmed as the same college. Unchecked matches are not
          added.
        </p>
      </Card>

      <Card title="Shared timeline" sub="Every action on this college, from every bureau, in date order.">
        <ol className="@container space-y-1">
          {inst.timeline.map((t, i) => (
            <li
              key={i}
              className="grid gap-1 border-l-4 py-3 pl-5 @3xl:grid-cols-[12rem_14rem_1fr] @3xl:gap-6"
              style={{ borderColor: BUREAUS[t.case_bureau]?.color }}
            >
              <div className="tabular text-base text-muted">{formatDateTime(t.timestamp)}</div>
              <div className="flex flex-wrap gap-x-3 text-base @3xl:block">
                <Bureau code={t.case_bureau} />
                <div>
                  <Link to={`/cases/${t.case_pk}`} className="text-ink underline decoration-line underline-offset-4 hover:decoration-ink">{t.case_id}</Link>
                </div>
              </div>
              <div>
                <div className="text-lg font-semibold">{plainAction(t.action)}</div>
                <div className="text-base text-ink-2">
                  {t.actor}
                  {t.remarks && <> · “{t.remarks}”</>}
                </div>
                {t.via_confirmed_link && <div className="text-base text-ok">✓ Added because an officer confirmed it is the same college</div>}
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={`Cases (${inst.cases.length})`}>
          <ul className="divide-y divide-line">
            {inst.cases.map((c) => (
              <li key={c.id} className="py-3">
                <div className="flex flex-wrap items-center gap-x-4">
                  <Link to={`/cases/${c.id}`} className="text-lg text-ink underline decoration-line underline-offset-4 hover:decoration-ink">{c.case_id}</Link>
                  <Bureau code={c.source_bureau} />
                </div>
                <div className="text-base text-ink-2">
                  {CATEGORIES[c.category]} · <Status status={c.status} /> · received {formatDate(c.received_date)} <SlaTag caseItem={c} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Matches with other bureaus">
          <LinkList links={inst.links} empty="No matches with other bureaus." />
        </Card>
      </div>
    </div>
  );
}
