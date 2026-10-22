import { useSearchParams } from "react-router-dom";
import LinkList from "../components/LinkList";
import { Card, ErrorBox, Loading, PageTitle } from "../components/ui";
import { useApi } from "../hooks";
import { LINK_STATUS } from "../labels";

const TABS = ["suggested", "confirmed", "rejected"];

export default function AlertsPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("status") || "suggested";
  const { data, error, loading } = useApi(tab === "suggested" ? "/alerts/overlaps" : `/links?status=${tab}`);

  return (
    <div>
      <PageTitle sub="Samanvay thinks each pair below is the same college, handled by two bureaus. Nothing is merged until an officer checks it.">
        Needs your check
      </PageTitle>
      <div role="tablist" className="mb-6 inline-flex rounded-lg border border-line bg-surface p-1">
        {TABS.map((key) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => setParams(key === "suggested" ? {} : { status: key })}
            className={`rounded-md px-4 py-2 text-base ${tab === key ? "bg-accent font-semibold text-white" : "text-ink-2 hover:text-ink"}`}
          >
            {LINK_STATUS[key]}
          </button>
        ))}
      </div>
      <ErrorBox error={error} />
      <Card>{loading ? <Loading /> : <LinkList links={data} />}</Card>
    </div>
  );
}
