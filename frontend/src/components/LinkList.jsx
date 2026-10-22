import { Bureau, Button, LinkStatus, MatchStrength } from "./ui";

/** Same-college matches between bureaus, each with a button to check it. */
export default function LinkList({ links, empty = "Nothing here." }) {
  if (!links?.length) return <p className="text-lg text-ink-2">{empty}</p>;
  return (
    // Container queries: the layout follows the card width, not the screen (the guided demo narrows the content).
    <ul className="@container divide-y divide-line">
      {links.map((l) => (
        <li key={l.id} className="grid gap-4 py-5 @3xl:grid-cols-[1fr_auto] @3xl:items-center">
          <div className="space-y-2">
            {[l.case_a, l.case_b].map((c) => (
              <div key={c.id} className="grid gap-x-4 text-lg @xl:grid-cols-[12rem_1fr]">
                <Bureau code={c.source_bureau} className="text-base" />
                <span>
                  {c.raw_institution_name} <span className="text-base text-muted">· {c.case_id}</span>
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 @3xl:flex-col @3xl:items-end">
            <LinkStatus status={l.status} />
            <MatchStrength value={l.scores.final_confidence} />
            <Button to={`/links/${l.id}`} variant={l.status === "suggested" ? "primary" : "secondary"}>
              {l.status === "suggested" ? "Check now" : "View"}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
