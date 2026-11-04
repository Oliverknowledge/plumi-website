"use client";

import { useEffect, useRef, useState } from "react";
import { buildFraction } from "@/lib/studyapp/questions/fraction";
import { holdTray } from "./inkBus";

/** The little stacked-fraction picture on the key and in the box. */
export const FractionIcon = () => (
  <svg viewBox="0 0 16 22" width="14" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M8 3v5M5.5 5.5h5" /><path d="M2 11h12" /><path d="M5 15.5h6" /></svg>
);

/**
 * The Fraction box: a top number over a bar over a bottom number. Type the top, Tab / Enter / the down arrow go to the bottom, Enter puts the fraction in the answer, Escape puts the box
 * away with nothing inserted. Focus stays inside it while it is open (Tab goes round), and goes back to the answer when it closes. `top` is what was selected in the answer, if anything.
 */
export function FractionBox({ top = "", left, onInsert, onCancel }: { top?: string; left: number; onInsert(text: string, spoken: string): void; onCancel(): void }) {
  const [a, setA] = useState(top);
  const [b, setB] = useState("");
  const [hint, setHint] = useState("");
  const topIn = useRef<HTMLInputElement>(null);
  const botIn = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => { topIn.current?.focus({ preventScroll: true }); topIn.current?.select(); }, []);
  // While the box is open the pen tray stands aside (it is fixed to the foot of the screen and would cover Insert and Cancel), and the box is brought fully into view: after the page has
  // settled, and again when the keyboard (a smaller visual viewport) takes room from it.
  useEffect(() => {
    const release = holdTray();
    const el = root.current;
    const show = () => el?.scrollIntoView({ block: "nearest", behavior: "instant" as ScrollBehavior });
    show();
    const raf = requestAnimationFrame(show);
    const t1 = setTimeout(show, 120), t2 = setTimeout(show, 450);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", show);
    return () => { release(); cancelAnimationFrame(raf); clearTimeout(t1); clearTimeout(t2); vv?.removeEventListener("resize", show); };
  }, []);
  const go = () => {
    const r = buildFraction(a, b);
    if (!r.ok) { setHint(r.hint); (a.trim() ? botIn : topIn).current?.focus(); return; }
    onInsert(r.text, r.spoken);
  };
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onCancel(); return; }
    if (e.key === "Tab") {
      const f = [...(root.current?.querySelectorAll<HTMLElement>("input, button") ?? [])];
      if (!f.length) return;
      const i = f.indexOf(document.activeElement as HTMLElement);
      const to = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i === f.length - 1 ? 0 : i + 1);
      e.preventDefault(); f[to].focus();
    }
  };
  return (
    <div ref={root} className="qs-frac" role="dialog" aria-label="Fraction" style={{ marginLeft: left }} onKeyDown={keys} data-testid="fraction-box">
      <div className="qs-frac-stack">
        <input
          ref={topIn} className="qs-frac-in" enterKeyHint="next" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} placeholder="top" aria-label="Top number" value={a} data-testid="frac-top"
          onChange={(e) => { setA(e.target.value); setHint(""); }}
          onKeyDown={(e) => { if (e.nativeEvent.isComposing) return; if (e.key === "Enter" || e.key === "ArrowDown") { e.preventDefault(); botIn.current?.focus(); } }}
        />
        <span className="qs-frac-bar" aria-hidden="true" />
        <input
          ref={botIn} className="qs-frac-in" enterKeyHint="done" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} placeholder="bottom" aria-label="Bottom number" value={b} data-testid="frac-bottom"
          onChange={(e) => { setB(e.target.value); setHint(""); }}
          onKeyDown={(e) => { if (e.nativeEvent.isComposing) return; if (e.key === "Enter") { e.preventDefault(); go(); } else if (e.key === "ArrowUp") { e.preventDefault(); topIn.current?.focus(); } }}
        />
      </div>
      <div className="qs-frac-acts">
        <button type="button" className="qs-mini qs-frac-ok" onClick={go} data-testid="frac-insert">Insert</button>
        <button type="button" className="qs-mini" onClick={onCancel} data-testid="frac-cancel">Cancel</button>
      </div>
      <p className="qs-frac-hint" role="status">{hint}</p>
    </div>
  );
}
