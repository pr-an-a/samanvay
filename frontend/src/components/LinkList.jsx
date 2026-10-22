import { BureauTag, Button, LinkStatusBadge, Pct } from "./ui";

/** Compact list of overlap links, each with a button to the review screen. */
export default function LinkList({ links, empty = "No overlap links." }) {
  if (!links?.length) return <p className="text-lg text-ink-2">{empty}</p>;
  return (
    <ul className="divide-y divide-line">
      {links.map((l) => (
        <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0 space-y-1">
            {[l.case_a, l.case_b].map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-2 text-lg">
                <BureauTag bureau={c.source_bureau} />
                <span className="font-medium">{c.case_id}</span>
                <span className="text-ink-2">{c.raw_institution_name}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <LinkStatusBadge status={l.status} />
            <span className="text-base text-ink-2">
              confidence <span className="text-lg font-semibold text-ink"><Pct value={l.scores.final_confidence} /></span>
            </span>
            <Button to={`/links/${l.id}`} variant={l.status === "suggested" ? "primary" : "secondary"}>
              {l.status === "suggested" ? "Review" : "View"}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
