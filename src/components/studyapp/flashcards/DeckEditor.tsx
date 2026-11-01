"use client";

import { useState } from "react";
import { useNow } from "@/lib/studyapp/clock";
import { deckStats, exportDeck } from "@/lib/studyapp/model";
import { actions, useApp } from "@/lib/studyapp/store";
import { toast } from "../toast";
import { CardFields } from "./CardFields";

/** One deck: rename it, add cards, edit or delete them, paste a list in, copy the deck out, review it, or delete it. */
export function DeckEditor({ deckId, onBack, onReview }: { deckId: string; onBack: () => void; onReview: (id: string) => void }) {
  const { data } = useApp();
  const now = useNow();
  const deck = data.decks.find((d) => d.id === deckId);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [paste, setPaste] = useState("");
  if (!deck) return <div className="fcp-card fcp-empty"><p>That deck is gone.</p><button type="button" className="btn" onClick={onBack}>Back to decks</button></div>;
  const cards = data.cards.filter((c) => c.deckId === deckId).sort((a, b) => a.createdAt - b.createdAt);
  const st = now ? deckStats(data, deckId, now) : { total: cards.length, due: 0, fresh: 0, learning: 0, mature: 0 };

  const copy = async () => {
    const text = exportDeck(data, deckId);
    try { await navigator.clipboard.writeText(text); toast(`${cards.length} card${cards.length === 1 ? "" : "s"} copied`); }
    catch { setPaste(text); toast("Copy it from the box below"); }
  };
  const doImport = () => {
    const r = actions.importCards(deckId, paste);
    toast(r.added === 0 ? "No cards found. Put one card on each line, with the question and answer split by a tab, a semicolon or a |" : `${r.added} card${r.added === 1 ? "" : "s"} added${r.skipped ? `, ${r.skipped} line${r.skipped === 1 ? "" : "s"} skipped` : ""}`);
    if (r.added > 0) setPaste("");
  };

  return (
    <div className="fcp-editor">
      <div className="fcp-bar">
        <button type="button" className="btn ghost" onClick={onBack}>&lsaquo; All decks</button>
        <input key={deck.id} className="fcp-title" defaultValue={deck.title} maxLength={50} aria-label="Deck name" onBlur={(e) => { actions.renameDeck(deckId, e.target.value); }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
        <span className="grow" />
        <button type="button" className="btn gold" disabled={st.due === 0} onClick={() => onReview(deckId)} data-testid="review-deck">{st.due === 0 ? "Nothing due" : `Review ${st.due} due`}</button>
      </div>
      <p className="fcp-counts"><b>{st.total}</b> cards &middot; {st.fresh} new &middot; {st.learning} learning &middot; {st.mature} well known</p>

      <section className="card fcp-add" aria-label="Add a card">
        <h3>Add a card</h3>
        <CardFields idPrefix="add" submitLabel="Add card" resetOnSubmit onSubmit={(f, b) => actions.addCard(deckId, f, b)} />
      </section>

      <section className="card fcp-list" aria-label="Cards in this deck">
        <h3>Cards <small>{cards.length}</small></h3>
        {cards.length === 0 && <p className="fcp-none">No cards yet. Add one above, or paste a list below.</p>}
        <ul>
          {cards.map((c) => (
            <li key={c.id} data-testid="deck-card">
              {editing === c.id ? (
                <CardFields idPrefix={`edit-${c.id}`} initialFront={c.front} initialBack={c.back} submitLabel="Save" onCancel={() => setEditing(null)} onSubmit={(f, b) => { actions.editCard(c.id, f, b); setEditing(null); }} />
              ) : (
                <>
                  <span className="q">{c.front}</span>
                  <span className="a">{c.back}</span>
                  <span className="meta">{c.sch.state === "new" ? "new" : c.sch.state === "learning" ? "learning" : `${c.sch.interval}d`}</span>
                  <button type="button" className="btn ghost" onClick={() => setEditing(c.id)} aria-label={`Edit: ${c.front}`}>Edit</button>
                  <button type="button" className="btn ghost danger" onClick={() => actions.deleteCard(c.id)} aria-label={`Delete: ${c.front}`}>Delete</button>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      <details className="card fcp-import">
        <summary>Paste a list, or copy this deck out</summary>
        <p>One card on each line. Split the question and answer with a tab, a semicolon or a bar (<code>|</code>).</p>
        <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={5} placeholder={"What is the SI unit of force?; The newton (N)"} aria-label="Cards to add" data-testid="import-box" />
        <div className="cf-acts">
          <button type="button" className="btn gold" disabled={!paste.trim()} onClick={doImport} data-testid="import-go">Add these cards</button>
          <button type="button" className="btn" disabled={cards.length === 0} onClick={() => void copy()}>Copy this deck</button>
        </div>
      </details>

      <div className="fcp-danger">
        {confirm ? (
          <>
            <span>Delete &ldquo;{deck.title}&rdquo; and its {cards.length} card{cards.length === 1 ? "" : "s"}? This cannot be undone.</span>
            <button type="button" className="btn danger" onClick={() => { actions.deleteDeck(deckId); onBack(); }} data-testid="delete-confirm">Yes, delete it</button>
            <button type="button" className="btn ghost" onClick={() => setConfirm(false)}>Keep it</button>
          </>
        ) : (
          <button type="button" className="btn ghost danger" onClick={() => setConfirm(true)} data-testid="delete-deck">Delete this deck</button>
        )}
      </div>
    </div>
  );
}
