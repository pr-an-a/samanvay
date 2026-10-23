import { useEffect, useState } from "react";

/** A number that counts up when it appears (instantly for people who prefer reduced motion). */
export default function CountUp({ value, ms = 700 }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || !value) return setN(value);
    let raf;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / ms);
      setN(Math.round(value * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return <span className="tabular">{n.toLocaleString("en-IN")}</span>;
}
