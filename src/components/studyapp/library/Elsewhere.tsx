"use client";

/**
 * Two calm stops of the visit, one card:
 *   elsewhere  the student is already in the library in another tab of this browser. One tab at a time (the server holds
 *              one place per student), so this one waits until told to move here. Nothing is asked of the server meanwhile.
 *   away       the tab sat hidden or untouched for a long while, so the visit ended (nobody stands in an empty room);
 *              one tap and they are back.
 */
export function Elsewhere({ kind, onAction }: { kind: "elsewhere" | "away"; onAction: () => void }) {
  const away = kind === "away";
  return (
    <main className="wrap lb" data-testid={away ? "library-away" : "library-elsewhere"}>
      <section className="card lb-card lb-hidden">
        <h2>{away ? "You stepped away" : "You’re in the library in another tab"}</h2>
        <p>{away ? "You left the room while it was quiet." : "One at a time."}</p>
        <button type="button" className="btn gold" data-testid={away ? "rejoin" : "move-here"} onClick={onAction}>{away ? "Rejoin" : "Move here"}</button>
      </section>
    </main>
  );
}
