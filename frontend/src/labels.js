// Display labels for API codes, shared by every screen.

export const BUREAUS = {
  RB: { label: "RB", long: "Regulation Bureau", color: "var(--color-rb)" },
  PGRC: { label: "PGRC", long: "Public Grievance Redressal Cell", color: "var(--color-pgrc)" },
  REGIONAL: { label: "Regional", long: "Regional Office", color: "var(--color-regional)" },
};

export const STATUSES = {
  pending: "Pending",
  under_process: "Under process",
  transferred: "Transferred",
  escalated: "Escalated",
  disposed: "Disposed",
};

export const CATEGORIES = {
  fee_refund: "Fee refund",
  faculty_shortage: "Faculty shortage",
  infrastructure: "Infrastructure",
  admission_irregularity: "Admission irregularity",
  certificate_withholding: "Certificate withholding",
  ragging_admin: "Ragging (administrative)",
  other: "Other",
};

export const REGIONS = ["Central", "Eastern", "North-Western", "Northern", "South-Eastern", "South-Western", "Southern", "Western"];

export const ROLES = {
  RB_OFFICER: "RB officer",
  PGRC_OFFICER: "PGRC officer",
  REGIONAL: "Regional officer",
  ADMIN: "Admin",
};

export const OVERLAP_TITLE = "Potential Overlapping Cases – Coordination Required";

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value) {
  if (!value) return "—";
  // API timestamps are UTC without a zone suffix.
  const d = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function isOverdue(c) {
  if (c.status === "disposed" || !c.expected_disposal_date) return false;
  return new Date(`${c.expected_disposal_date}T23:59:59`) < new Date();
}
