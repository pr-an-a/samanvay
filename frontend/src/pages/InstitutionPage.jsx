import { Link, useParams } from "react-router-dom";
import CoordinationNotes from "../components/CoordinationNotes";
import ThreadTimeline from "../components/ThreadTimeline";
import LinkList from "../components/LinkList";
import { Bureau, Card, ErrorBox, Loading, SlaTag, PageTitle, Status } from "../components/ui";
import { useApi } from "../hooks";
import { CATEGORIES, bureauName, formatDate } from "../labels";

export default function InstitutionPage() {
  const { id } = useParams();
  const { data: inst, error, loading, reload } = useApi(`/institutions/${id}`);

  if (error) return <ErrorBox error={error} />;
  if (loading || !inst) return <Loading />;

  const bureaus = [...new Set(inst.cases.map((c) => c.source_bureau))];
  const count = (b) => inst.cases.filter((c) => c.source_bureau === b).length;

  return (
    <div className="space-y-6">
      <PageTitle sub={`${inst.address} · AICTE permanent ID ${inst.permanent_id}`}>{inst.name}</PageTitle>

      <Card>
        <p className="text-lg font-semibold">{inst.summary}</p>
        <p className="mt-3 text-lg">
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

      <Card data-tour-target="timeline" title="Shared timeline" sub="Each bureau has its own thread. Once an officer confirms it is the same college, the threads join into one.">
        <ThreadTimeline entries={inst.timeline} />
      </Card>

      {inst.links.some((l) => l.status === "confirmed") && (
        <CoordinationNotes links={inst.links.filter((l) => l.status === "confirmed")} notes={inst.notes} onPosted={reload} />
      )}

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
