// Plain-language labels for API codes, shared by every screen.

export const BUREAUS = {
  RB: { name: "Regulation Bureau", color: "var(--color-rb)" },
  PGRC: { name: "Grievance Cell", color: "var(--color-pgrc)" },
  REGIONAL: { name: "Regional Office", color: "var(--color-regional)" },
};

export const bureauName = (code) => BUREAUS[code]?.name || code;

export const STATUSES = {
  pending: "New",
  under_process: "In progress",
  transferred: "Transferred",
  escalated: "Escalated",
  disposed: "Closed",
};

export const CATEGORIES = {
  fee_refund: "Fee refund",
  faculty_shortage: "Faculty shortage",
  infrastructure: "Infrastructure",
  admission_irregularity: "Admission irregularity",
  certificate_withholding: "Certificates withheld",
  ragging_admin: "Ragging (college inaction)",
  other: "Other",
};

export const LINK_STATUS = {
  suggested: "Needs your check",
  confirmed: "Confirmed: same college",
  rejected: "Not the same college",
};

export const REGIONS = ["Central", "Eastern", "North-Western", "Northern", "South-Eastern", "South-Western", "Southern", "Western"];

export const ROLES = {
  RB_OFFICER: "Regulation Bureau officer",
  PGRC_OFFICER: "Grievance Cell officer",
  REGIONAL: "Regional Office officer",
  ADMIN: "Administrator",
};

export const PLAIN_TITLE = "Another bureau is already handling this college";
// Official alert wording from the SIH26264 problem statement, shown as a subtitle under the plain headline.
export const OFFICIAL_TITLE = "Potential Overlapping Cases – Coordination Required";

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(value) {
  if (!value) return "—";
  // API timestamps are UTC without a zone suffix.
  const d = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function daysAgo(isoDate) {
  const then = new Date(`${isoDate}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const n = Math.round((now - then) / 86400000);
  if (n <= 0) return "today";
  if (n === 1) return "yesterday";
  return `${n} days ago`;
}

export function isOverdue(c) {
  if (c.status === "disposed" || !c.expected_disposal_date) return false;
  return new Date(`${c.expected_disposal_date}T23:59:59`) < new Date();
}

export const lowerFirst = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);

export const percent = (x) => `${Math.round(x * 100)}%`;

const CODE_NAMES = { RB: "Regulation Bureau", PGRC: "Grievance Cell", REGIONAL: "Regional Office" };

/** Action text from the backend in plain words: no bureau codes, no "overlap". */
export function plainAction(text) {
  if (!text) return text;
  const m = text.match(/^Overlap with (\S+) (confirmed|rejected)$/);
  if (m) return m[2] === "confirmed" ? `Confirmed as the same college as case ${m[1]}` : `Marked as a different college from case ${m[1]}`;
  // Codes as words ("Transferred to RB"), but not inside case numbers like RB/2026/0150.
  return text.replace(/^Disposed:/, "Closed:").replace(/\b(RB|PGRC|REGIONAL)\b(?![/-])/g, (c) => CODE_NAMES[c]);
}
