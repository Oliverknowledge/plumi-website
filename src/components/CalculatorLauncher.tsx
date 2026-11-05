"use client";

import { useState, type ComponentType } from "react";
import { calculator as copy } from "@/content/calculator";

/** Keep panel controls, drag handlers and the emulator off the initial page load. */
export function CalculatorLauncher() {
  const [Panel, setPanel] = useState<ComponentType | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function open() {
    setLoading(true);
    setFailed(false);
    try {
      const { Calculator } = await import("./questionBank/Calculator");
      setPanel(() => Calculator);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  if (Panel) return <Panel />;
  return <button type="button" className="qb-calculator-restore" aria-label={failed ? copy.retry : copy.label} title={failed ? copy.error : copy.open} aria-expanded={false} aria-busy={loading} disabled={loading} onClick={open}>
    <svg width="16" height="22" viewBox="0 0 16 22" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="1" y="1" width="14" height="20" rx="3" /><path d="M4 5h8v4H4zM4 13h2m3 0h3M4 17h2m3 0h3" />
    </svg>
  </button>;
}
