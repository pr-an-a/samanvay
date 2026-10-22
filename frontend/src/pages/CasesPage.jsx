import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, query } from "../api";
import { Bureau, Button, ErrorBox, Loading, SlaTag, PageTitle, Status } from "../components/ui";
import { useApi } from "../hooks";
import { BUREAUS, CATEGORIES, REGIONS, STATUSES, formatDate } from "../labels";

const FILTER_KEYS = ["q", "bureau", "status", "region", "category", "received_from", "received_to", "overdue", "open"];
const PAGE = 50;
const CONTROL = "rounded-lg border border-line bg-surface px-3 py-2 text-base text-ink";

function Select({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-1.5 text-base text-ink-2">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className={CONTROL}>
        <option value="">All</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

export default function CasesPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || ""]));
  const [search, setSearch] = useState(filters.q);
  const [shown, setShown] = useState(PAGE);
  const [exportError, setExportError] = useState(null);
  const qs = query(filters);
  const { data: cases, error, loading } = useApi(`/cases${qs}`);

  function set(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
    setShown(PAGE);
  }

  async function exportCsv() {
    setExportError(null);
    try {
      const res = await api(`/reports/cases.csv${qs}`, { raw: true });
      const url = URL.createObjectURL(await res.blob());
      Object.assign(document.createElement("a"), { href: url, download: `samanvay_cases_${new Date().toISOString().slice(0, 10)}.csv` }).click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(e);
    }
  }

  const active = FILTER_KEYS.some((k) => filters[k]);

  return (
    <div>
      <PageTitle
        sub="Every complaint from every bureau. Complainant names from other bureaus are hidden."
        actions={<Button variant="secondary" onClick={exportCsv}>Download as spreadsheet (CSV)</Button>}
      >
        All cases
      </PageTitle>

      <form
        className="rounded-xl border border-line bg-surface p-5"
        onSubmit={(e) => {
          e.preventDefault();
          set("q", search.trim());
        }}
      >
        <div className="flex flex-wrap gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by college name, AICTE ID or case number"
            aria-label="Search"
            className="min-w-[18rem] flex-1 rounded-lg border border-line px-4 py-2.5 text-lg"
          />
          <Button type="submit">Search</Button>
          {active && (
            <Button
              variant="secondary"
              onClick={() => {
                setSearch("");
                setParams(new URLSearchParams());
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
          <Select label="Bureau" value={filters.bureau} onChange={(v) => set("bureau", v)} options={Object.entries(BUREAUS).map(([k, b]) => [k, b.name])} />
          <Select label="Status" value={filters.status} onChange={(v) => set("status", v)} options={Object.entries(STATUSES)} />
          <Select label="Region" value={filters.region} onChange={(v) => set("region", v)} options={REGIONS.map((r) => [r, r])} />
          <Select label="Topic" value={filters.category} onChange={(v) => set("category", v)} options={Object.entries(CATEGORIES)} />
          <Select label="Due date" value={filters.overdue} onChange={(v) => set("overdue", v)} options={[["true", "Overdue"], ["false", "Not overdue"]]} />
          <label className="flex flex-col gap-1.5 text-base text-ink-2">
            Received from
            <input type="date" value={filters.received_from} onChange={(e) => set("received_from", e.target.value)} className={CONTROL} />
          </label>
          <label className="flex flex-col gap-1.5 text-base text-ink-2">
            Received to
            <input type="date" value={filters.received_to} onChange={(e) => set("received_to", e.target.value)} className={CONTROL} />
          </label>
        </div>
        {filters.open && <p className="mt-3 text-base text-ink-2">Showing open cases only.</p>}
      </form>

      <div className="mt-4 space-y-3">
        <ErrorBox error={error || exportError} />
        {loading && <Loading />}
      </div>

      {cases && (
        <>
          <p className="mt-6 text-lg text-ink-2">
            <span className="font-semibold text-ink">{cases.length}</span> case{cases.length === 1 ? "" : "s"}
          </p>
          <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full text-base">
              <thead className="border-b border-line text-left text-ink-2">
                <tr>
                  {["Case", "College (as written in the complaint)", "Place", "Topic", "Status", "Received", "Complainant"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cases.slice(0, shown).map((c) => (
                  <tr key={c.id} className="cursor-pointer border-t border-line hover:bg-accent-wash" onClick={() => navigate(`/cases/${c.id}`)}>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link to={`/cases/${c.id}`} className="tabular text-ink underline decoration-line underline-offset-4 hover:decoration-ink" onClick={(e) => e.stopPropagation()}>
                        {c.case_id}
                      </Link>
                      <div className="mt-1"><Bureau code={c.source_bureau} /></div>
                    </td>
                    <td className="min-w-[15rem] px-4 py-3 text-lg">{c.raw_institution_name}</td>
                    <td className="px-4 py-3 text-ink-2">{[c.district, c.region].filter(Boolean).join(", ")}</td>
                    <td className="px-4 py-3">{CATEGORIES[c.category] || c.category}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Status status={c.status} />
                      <div><SlaTag caseItem={c} /></div>
                    </td>
                    <td className="tabular whitespace-nowrap px-4 py-3">{formatDate(c.received_date)}</td>
                    <td className="whitespace-nowrap px-4 py-3">{c.complainant_name || "—"}</td>
                  </tr>
                ))}
                {cases.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-lg text-ink-2">No cases match these filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {shown < cases.length && (
            <div className="mt-5 text-center">
              <Button variant="secondary" onClick={() => setShown(shown + PAGE)}>Show more ({cases.length - shown} remaining)</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
