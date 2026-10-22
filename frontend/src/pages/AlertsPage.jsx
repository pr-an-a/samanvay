import { useSearchParams } from "react-router-dom";
import LinkList from "../components/LinkList";
import { Card, ErrorBox, Loading, PageTitle } from "../components/ui";
import { useApi } from "../hooks";
import { OVERLAP_TITLE } from "../labels";

const TABS = [
  ["suggested", "Awaiting review"],
  ["confirmed", "Confirmed"],
  ["rejected", "Rejected"],
];

export default function AlertsPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("status") || "suggested";
  const { data, error, loading } = useApi(tab === "suggested" ? "/alerts/overlaps" : `/links?status=${tab}`);

  return (
    <div>
      <PageTitle sub="Links are suggestions until an officer confirms them. Cases are never merged automatically.">{OVERLAP_TITLE}</PageTitle>
      <div role="tablist" className="mb-4 flex gap-2">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => setParams(key === "suggested" ? {} : { status: key })}
            className={`rounded-md px-4 py-2 text-lg font-semibold ${tab === key ? "bg-brand text-white" : "border border-line bg-surface text-ink hover:bg-page"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <ErrorBox error={error} />
      <Card>
        {loading ? <Loading /> : <LinkList links={data} empty="Nothing here." />}
      </Card>
    </div>
  );
}
