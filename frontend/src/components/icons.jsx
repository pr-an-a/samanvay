// Small line icons (24px grid, stroke = currentColor), so they take the surrounding text colour.

const PATHS = {
  overview: ["M3 3h7v7H3z", "M14 3h7v7h-7z", "M14 14h7v7h-7z", "M3 14h7v7H3z"],
  check: ["M9 12l2 2 4-4", "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"],
  register: ["M12 5v14", "M5 12h14", "M3 3h18v18H3z"],
  cases: ["M8 6h13", "M8 12h13", "M8 18h13", "M3 6h.01", "M3 12h.01", "M3 18h.01"],
  accuracy: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z", "M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"],
  compare: ["M3 5h7v14H3z", "M14 5h7v14h-7z", "M10 12h4"],
  stress: ["M3 12h4l3-8 4 16 3-8h4"],
  escalate: ["M12 19V5", "M5 12l7-7 7 7"],
  audit: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M8 13h8", "M8 17h8"],
  bell: ["M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9", "M13.7 21a2 2 0 0 1-3.4 0"],
  folder: ["M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"],
  clock: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z", "M12 7v5l3 2"],
  link: ["M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1", "M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"],
  done: ["M20 6L9 17l-5-5"],
  college: ["M3 21h18", "M5 21V10l7-5 7 5v11", "M9 21v-6h6v6"],
  logo: ["M4 12h6", "M14 12h6", "M10 12a2 2 0 1 0 4 0 2 2 0 1 0-4 0", "M7 7l3 3", "M17 7l-3 3", "M7 17l3-3", "M17 17l-3-3"],
};

export default function Icon({ name, size = 18, className = "" }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${className}`}>
      {PATHS[name].map((d) => <path key={d} d={d} />)}
    </svg>
  );
}
