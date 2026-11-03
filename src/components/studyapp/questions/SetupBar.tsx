"use client";

import type { CSSProperties } from "react";
import type { PileBook } from "@/lib/studyapp/questions/setupBooks";

const SHOWN = 5;

/**
 * The bar at the foot of the setup: the books they have picked up, stacked into a small pile with a count, what is still to do (or which
 * books they are), and the button. A book with no board yet leaves the button waiting, and pressing it takes them to that book.
 */
export function SetupBar({ pile, line, ready, onDone, onFix }: {
  pile: PileBook[]; line: { kind: "missing" | "ready" | "none"; text: string }; ready: boolean; onDone(): void; onFix(): void;
}) {
  const n = pile.length;
  const shown = pile.slice(-SHOWN);
  return (
    <div className="qk-bar" role="region" aria-label="Your books">
      <span className="qk-bar-tape" aria-hidden="true" />
      <span className="qk-pile" aria-hidden="true">
        {shown.map((b, i) => (
          <i key={b.key} className="qk-mini" style={{ "--tint": b.tint, "--i": i } as CSSProperties} />
        ))}
        <b className="qk-count" data-testid="setup-count">{n}</b>
      </span>
      <p id="qk-bar-line" className={`qk-line${line.kind === "missing" ? " ask" : ""}`} role="status" aria-live="polite">
        <span className="qs-sr">{n} {n === 1 ? "book" : "books"} chosen. </span>{line.text}
      </p>
      <button type="button" className="btn gold qk-go" aria-disabled={!ready} onClick={() => (ready ? onDone() : onFix())} data-testid="setup-done"
        aria-label="Show my papers" aria-describedby={!ready ? "qk-bar-line" : undefined}>
        <span className="qk-go-long" aria-hidden="true">Show my papers</span><span className="qk-go-short" aria-hidden="true">Let&apos;s go</span>
      </button>
    </div>
  );
}
