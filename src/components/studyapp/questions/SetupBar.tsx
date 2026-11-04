"use client";

import type { CSSProperties } from "react";
import type { PileBook } from "@/lib/studyapp/questions/setupBooks";

const SHOWN = 5;

/**
 * The bar at the foot of the setup: the books they have picked up, stacked into a small pile with a count, what is still to do (or which
 * books they are), and the button. A book with no board yet turns the button into "Pick a board", and pressing it takes them to that book.
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
        <span className="qs-sr">{n} {n === 1 ? "book" : "books"} chosen. </span><span className="qk-line-text">{line.kind === "missing" && line.text.startsWith("Pick a board ") ? <><span className="qk-pick">Pick a board </span>{line.text.slice("Pick a board ".length)}</> : line.text}</span><span className="qk-line-n" aria-hidden="true">{n} {n === 1 ? "book" : "books"}</span>
      </p>
      <button type="button" className={`btn gold qk-go${ready ? "" : " ask"}`} onClick={() => (ready ? onDone() : onFix())} id="qk-bar-go" data-testid="setup-done" data-ready={ready}
        aria-label={ready ? "Let's go" : line.text} aria-describedby={ready ? undefined : "qk-bar-line"}>
        <span aria-hidden="true">{ready ? "Let\u2019s go" : "Pick a board"}</span>
      </button>
    </div>
  );
}
