"use client";

import { useCallback, useEffect, useState } from "react";
import { AppLink } from "@/components/studyapp/AppLink";
import { useNow } from "@/lib/studyapp/clock";
import { dueNow, subjectsInUse } from "@/lib/studyapp/model";
import { useApp } from "@/lib/studyapp/store";
import { DeckEditor } from "./DeckEditor";
import { AddCardSheet, NewDeckSheet, StartersSheet } from "./DeckSheets";
import { FlashDesk } from "./FlashDesk";
import { ImportSheet } from "./ImportSheet";
import { ALL, decksInScope, NONE, SidePanel, subjectOf, type Source } from "./SidePanel";

/**
 * Flashcards, laid out like the iPad's page: on the left the subject toggle, My sessions, the decks (tick them
 * to mix) and the dashed buttons; on the right the wooden desk with the card on it. Spaced repetition is real:
 * each grade schedules the card (src/lib/studyapp/srs.ts) and every button says when it will return. Saved on
 * this device.
 *
 * What is on the desk follows one rule: decks ticked in the list win (a mix); otherwise the deck or session
 * that was clicked; otherwise everything due in the chosen subject.
 */
type Sheet = { kind: "import"; deckId?: string } | { kind: "starters" } | { kind: "newdeck" } | { kind: "card"; current: string | null };

/** While the desk fills the screen: the page behind cannot scroll or be reached, and Escape leaves. Undone however the page goes away. */
function useFocusMode(active: boolean, exit: () => void) {
  useEffect(() => {
    if (!active) return;
    const html = document.documentElement;
    const was = html.style.overflow;
    html.style.overflow = "hidden";
    const main = document.querySelector("main.fcl-page");
    const hidden: Element[] = [];
    for (const el of Array.from(main?.parentElement?.children ?? [])) {
      if (el !== main && !el.hasAttribute("inert") && !el.classList.contains("toast")) { el.setAttribute("inert", ""); hidden.push(el); }
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented && !document.querySelector("dialog[open]")) exit(); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      html.style.overflow = was;
      for (const el of hidden) el.removeAttribute("inert");
    };
  }, [active, exit]);
}

/**
 * Put the keyboard on the desk (or the editor), so Space turns the card over instead of pressing the button just
 * clicked, and where the page is stacked bring it into view.
 */
function showPane(id: string, scroll = true) {
  requestAnimationFrame(() => {
    const el = document.getElementById(id);
    if (!el) return;
    if (scroll && window.matchMedia("(max-width: 899px)").matches) el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    el.focus({ preventScroll: true });
  });
}

export function FlashcardsPage() {
  const { ready, data } = useApp();
  const now = useNow(1000);
  const [scopeRaw, setScopeRaw] = useState(ALL);
  const [sourceRaw, setSource] = useState<Source>({ kind: "scope" });
  const [tickedRaw, setTicked] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [expanded, setExpanded] = useState(false);
  const leave = useCallback(() => setExpanded(false), []);
  useFocusMode(expanded, leave);

  // What the page was told, checked against what exists now (a deck, a session or a subject can be deleted under it).
  const subjects = subjectsInUse(data);
  const scope = scopeRaw !== ALL && subjects.some((s) => (s ?? NONE) === scopeRaw) ? scopeRaw : ALL;
  const ticked = data.decks.filter((d) => tickedRaw.includes(d.id)).map((d) => d.id);
  const deck = sourceRaw.kind === "deck" ? data.decks.find((d) => d.id === sourceRaw.id) : undefined;
  const session = sourceRaw.kind === "session" ? data.sessions.find((s) => s.id === sourceRaw.id) : undefined;
  const source: Source = deck || session ? sourceRaw : { kind: "scope" };
  const editingDeck = editing && data.decks.some((d) => d.id === editing) ? editing : null;

  let view: { key: string; label: string; ids: string[] | undefined };
  if (ticked.length > 0) view = { key: `mix:${ticked.join(",")}`, label: ticked.length === 1 ? data.decks.find((d) => d.id === ticked[0])?.title ?? "" : `${ticked.length} decks mixed`, ids: ticked };
  else if (deck) view = { key: `deck:${deck.id}`, label: deck.title, ids: [deck.id] };
  else if (session) view = { key: `session:${session.id}`, label: session.name, ids: session.deckIds };
  else if (scope === ALL) view = { key: "scope:all", label: "All subjects", ids: undefined };
  else { const subject = subjectOf(scope); view = { key: `scope:${scope}`, label: subject ? `All ${subject}` : "No subject", ids: decksInScope(data, scope).map((d) => d.id) }; }

  const total = ready && now ? dueNow(data, now).ids.length : 0;
  const atToday = ticked.length === 0 && source.kind === "scope";

  const reset = () => { setSource({ kind: "scope" }); setTicked([]); setEditing(null); };
  const pickDeck = (id: string) => { setSource({ kind: "deck", id }); setTicked([]); setEditing(null); showPane("fc-desk"); };
  const pickSession = (id: string) => { setSource({ kind: "session", id }); setTicked([]); setEditing(null); showPane("fc-desk"); };
  const tick = (id: string, on: boolean) => setTicked((t) => (on ? [...t.filter((x) => x !== id), id] : t.filter((x) => x !== id)));
  const edit = (id: string) => { setEditing(id); setExpanded(false); showPane("fc-editor"); };
  const importDone = (id: string) => { setSheet(null); if (editingDeck) setEditing(id); else pickDeck(id); };

  if (!ready) {
    return (
      <main className="wrap fcp fcl-page">
        <div className="fcl-grid" aria-hidden="true"><div className="fcl-side" style={{ minHeight: 420 }} /><div className="fcl-desk" style={{ minHeight: 420 }} /></div>
      </main>
    );
  }

  return (
    <main className="wrap fcp fcl-page">
      <div className="ph" inert={expanded}>
        <div>
          <div className="crumb"><AppLink href="/study">Desk</AppLink> <span>&rsaquo;</span> Flashcards</div>
          <h1>Flashcards<em>{!now ? " " : total === 0 ? "Nothing due right now" : `${total} due today`}</em></h1>
        </div>
      </div>

      <div className="fcl-grid">
        <div className="fcl-side-wrap" inert={expanded}>
          <SidePanel
            scope={scope} onScope={(s, pointer) => { setScopeRaw(s); reset(); if (pointer) showPane("fc-desk", false); }} source={source} ticked={ticked}
            onTick={tick} onClearTicks={() => setTicked([])} onReviewTicked={() => showPane("fc-desk")}
            onPickDeck={pickDeck} onPickSession={pickSession} onEdit={edit}
            onImport={() => setSheet({ kind: "import" })} onNewDeck={() => setSheet({ kind: "newdeck" })} onStarters={() => setSheet({ kind: "starters" })}
          />
        </div>

        <div className="fcl-main">
          <FlashDesk
            key={view.key} label={view.label} deckIds={view.ids} expanded={expanded} hidden={!!editingDeck} keysOn={!sheet}
            onToggleExpand={() => { setExpanded((e) => !e); showPane("fc-desk"); }}
            onAddCard={(current) => setSheet({ kind: "card", current })}
            onStarters={() => setSheet({ kind: "starters" })}
            onBackToToday={atToday ? undefined : reset}
          />
          {editingDeck && (
            <div id="fc-editor" tabIndex={-1} className="fcl-editor">
              <DeckEditor deckId={editingDeck} onBack={() => setEditing(null)} onReview={pickDeck} onImport={(id) => setSheet({ kind: "import", deckId: id })} />
            </div>
          )}
        </div>
      </div>

      {sheet?.kind === "import" && <ImportSheet deckId={sheet.deckId} onClose={() => setSheet(null)} onDone={importDone} />}
      {sheet?.kind === "starters" && <StartersSheet onClose={() => setSheet(null)} />}
      {sheet?.kind === "newdeck" && <NewDeckSheet onClose={() => setSheet(null)} onMade={(id) => { setSheet(null); edit(id); }} />}
      {sheet?.kind === "card" && <AddCardSheet deckIds={view.ids ?? data.decks.map((d) => d.id)} current={sheet.current} onClose={() => setSheet(null)} onNeedDeck={() => setSheet({ kind: "newdeck" })} />}
    </main>
  );
}
