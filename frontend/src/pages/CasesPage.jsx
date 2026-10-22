import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, query } from "../api";
import { BureauTag, Button, ErrorBox, Loading, OverdueBadge, PageTitle, StatusBadge } from "../components/ui";
import { useApi } from "../hooks";
import { BUREAUS, CATEGORIES, REGIONS, STATUSES, formatDate } from "../labels";

const FILTER_KEYS = ["q", "bureau", "status", "region", "category", "received_from", "received_to", "overdue"];
const PAGE = 50;

function Select({ label, value, onChange, options }) {
  return (
    <label className="flex flex-col gap-1 text-base text-ink-2">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md border border-line bg-surface px-2 py-2 text-lg text-ink">
        <option value="">All</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
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
      const a = Object.assign(document.createElement("a"), { href: url, download: `samanvay_cases_${new Date().toISOString().slice(0, 10)}.csv` });
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(e);
    }
  }

  const active = FILTER_KEYS.some((k) => filters[k]);

  return (
    <div>
      <PageTitle
        sub="Search across all bureaus. Complainant names from other bureaus are masked."
        actions={<Button variant="secondary" onClick={exportCsv}>⬇ Export CSV</Button>}
      >
        Cases
      </PageTitle>

      <form
        className="rounded-lg border border-line bg-surface p-4 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          set("q", search.trim());
        }}
      >
        <div className="flex flex-wrap gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search institution name, permanent ID or case ID"
            aria-label="Search"
            className="min-w-[18rem] flex-1 rounded-md border border-line px-3 py-2 text-lg"
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
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          <Select label="Bureau" value={filters.bureau} onChange={(v) => set("bureau", v)} options={Object.entries(BUREAUS).map(([k, b]) => [k, b.label])} />
          <Select label="Status" value={filters.status} onChange={(v) => set("status", v)} options={Object.entries(STATUSES)} />
          <Select label="Region" value={filters.region} onChange={(v) => set("region", v)} options={REGIONS.map((r) => [r, r])} />
          <Select label="Category" value={filters.category} onChange={(v) => set("category", v)} options={Object.entries(CATEGORIES)} />
          <Select label="SLA" value={filters.overdue} onChange={(v) => set("overdue", v)} options={[["true", "Overdue"], ["false", "Within SLA / closed"]]} />
          <label className="flex flex-col gap-1 text-base text-ink-2">
            Received from
            <input type="date" value={filters.received_from} onChange={(e) => set("received_from", e.target.value)} className="rounded-md border border-line px-2 py-2 text-lg" />
          </label>
          <label className="flex flex-col gap-1 text-base text-ink-2">
            Received to
            <input type="date" value={filters.received_to} onChange={(e) => set("received_to", e.target.value)} className="rounded-md border border-line px-2 py-2 text-lg" />
          </label>
        </div>
      </form>

      <div className="mt-4 space-y-3">
        <ErrorBox error={error || exportError} />
        {loading && <Loading />}
      </div>

      {cases && (
        <>
          <p className="mt-4 text-lg text-ink-2">
            <span className="font-semibold text-ink">{cases.length}</span> case{cases.length === 1 ? "" : "s"}
          </p>
          <div className="mt-2 overflow-x-auto rounded-lg border border-line bg-surface shadow-sm">
            <table className="w-full text-base">
              <thead className="bg-page text-left text-base text-ink-2">
                <tr>
                  {["Case ID / bureau", "Institution (as filed)", "District / region", "Category", "Status", "Received / SLA due", "Complainant"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-3 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cases.slice(0, shown).map((c) => (
                  <tr key={c.id} className="cursor-pointer border-t border-line hover:bg-brand-wash" onClick={() => navigate(`/cases/${c.id}`)}>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <Link to={`/cases/${c.id}`} className="font-medium text-brand underline-offset-2 hover:underline" onClick={(e) => e.stopPropagation()}>
                        {c.case_id}
                      </Link>
                      <div className="mt-1"><BureauTag bureau={c.source_bureau} /></div>
                    </td>
                    <td className="min-w-[15rem] px-3 py-2.5 text-lg">{c.raw_institution_name}</td>
                    <td className="px-3 py-2.5 text-ink-2">{[c.district, c.region].filter(Boolean).join(", ")}</td>
                    <td className="px-3 py-2.5">{CATEGORIES[c.category] || c.category}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={c.status} /></td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <div className="tabular">{formatDate(c.received_date)}</div>
                      <div className="tabular text-base text-ink-2">due {formatDate(c.expected_disposal_date)}</div>
                      <OverdueBadge caseItem={c} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{c.complainant_name || "—"}</td>
                  </tr>
                ))}
                {cases.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-lg text-ink-2">No cases match these filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {shown < cases.length && (
            <div className="mt-4 text-center">
              <Button variant="secondary" onClick={() => setShown(shown + PAGE)}>
                Show more ({cases.length - shown} remaining)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
