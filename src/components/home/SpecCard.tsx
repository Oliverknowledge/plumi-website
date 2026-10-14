"use client";
import { useEffect, useRef } from "react";

/**
 * One board's units. Open on a wide screen, where the three sit side by side; folded on
 * a phone, where three long lists would run for screens. Rendered open, so the units are
 * in the page for search engines and for anyone without JavaScript.
 */
export function SpecCard({ board, code, units }: { board: string; code: string; units: readonly string[] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (ref.current && window.matchMedia("(max-width: 760px)").matches) ref.current.open = false;
  }, []);
  return (
    <details ref={ref} className="hp-spec-card" open data-reveal>
      <summary><strong>{board}</strong><span>{code}</span><span className="hp-faq-plus" aria-hidden="true" /></summary>
      <ul>{units.map(u => <li key={u}>{u}</li>)}</ul>
    </details>
  );
}
