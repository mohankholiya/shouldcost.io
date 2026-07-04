"use client";

import { useEffect, useRef, useState } from "react";

/** Smoothly eases the displayed value toward `valueMinor` (used for the live rollup total). */
export function AnimatedCounter({
  valueMinor,
  durationMs = 400,
}: {
  valueMinor: number;
  durationMs?: number;
}) {
  const [display, setDisplay] = useState(valueMinor);
  const fromRef = useRef(valueMinor);

  useEffect(() => {
    const from = fromRef.current;
    const to = valueMinor;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [valueMinor, durationMs]);

  return (
    <span className="num">
      {(display / 100).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
    </span>
  );
}
