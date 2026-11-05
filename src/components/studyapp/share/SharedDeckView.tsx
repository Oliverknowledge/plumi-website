"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppLink } from "@/components/studyapp/AppLink";
import { site } from "@/config/site";
import { ADDED_KEY, addedDeckFor, readCodes, writeCodes, type SharedDeck } from "@/lib/studyapp/sharing";
import { actions, useApp } from "@/lib/studyapp/store";
import { ReportSheet } from "./ReportSheet";

/** How big the words on a card are, from how much there is: a short question is big, a page still scrolls inside the card. */
export function sizeFor(text: string): "xl" | "l" | "m" | "s" | "xs" {
  const lines = text.split("\n").length;
  const n = text.length + (lines - 1) * 28;
  return n <= 40 ? "xl" : n <= 110 ? "l" : n <= 240 ? "m" : n <= 460 ? "s" : "xs";
}

const DOTS_UP_TO = 24;
const TURN_MS = 130;
const plural = (n: number) => `${n} ${n === 1 ? "card" : "cards"}`;
const local = (): Storage | null => { try { return window.localStorage; } catch { return null; } };

/**
 * A deck someone shared, one card at a time: tap, click, Space or Enter turns the card over; Back and Next (or the arrow keys) move
 * through the deck; "Add to my decks" puts a private copy in this browser's flashcards. Nothing here knows who shared it or who is
 * looking, and nothing is recorded about which deck was opened.
 */
export function SharedDeckView({ code, deck }: { code: string; deck: SharedDeck }) {
  const n = deck.cards.length;
  const [i, setI] = useState(0);
  const [back, setBack] = useState(false);
  const [turn, setTurn] = useState<"out" | "in" | null>(null);
  const [report, setReport] = useState(false);
  const [reported, setReported] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [problem, setProblem] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const openRef = useRef<HTMLAnchorElement>(null);
  const { ready, data } = useApp();

  const card = deck.cards[i];
  const text = back ? card.back : card.front;
  const addedId = ready ? addedDeckFor(data, readCodes(local(), ADDED_KEY), code) : null;
  const isAdded = fresh || addedId !== null;

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);
  useEffect(() => { if (fresh) openRef.current?.focus(); }, [fresh]);

  const flip = useCallback(() => {
    if (turn) return;
    setTurn("out");
    timers.current.push(setTimeout(() => {
      setBack((b) => !b);
      setTurn("in");
      timers.current.push(setTimeout(() => setTurn(null), TURN_MS));
    }, TURN_MS));
  }, [turn]);

  const go = useCallback((to: number) => {
    timers.current.forEach(clearTimeout); timers.current = [];
    setTurn(null); setBack(false);
    setI(Math.min(n - 1, Math.max(0, to)));
  }, [n]);

  // Keys: Space and Enter turn the card (a focused button or link keeps its own), the arrows move. Not while a sheet is open or text is being typed.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      if (document.querySelector("dialog[open]")) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === "ArrowRight") { e.preventDefault(); go(i + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(i - 1); }
      else if ((e.key === " " || e.key === "Enter") && !/^(BUTTON|A|SUMMARY)$/.test(t?.tagName ?? "")) { e.preventDefault(); if (!e.repeat) flip(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, flip, i]);

  const add = () => {
    const r = actions.addSharedDeck(deck);
    if (!r.deckId) { setProblem(true); return; }
    setProblem(false);
    writeCodes(local(), ADDED_KEY, { ...readCodes(local(), ADDED_KEY), [code]: r.deckId });
    setFresh(true);
  };

  const onCardClick = () => {
    if (typeof window !== "undefined" && window.getSelection()?.toString()) return;   // a student selecting words is not turning the card
    flip();
  };

  return (
    <main id="main" className="sh-main" data-testid="shared-deck">
      <header className="sh-top">
        <span className="sh-brand"><Image src="/study/mascot/plumi-lofi-cozy.svg" alt="" width={34} height={34} unoptimized priority /><span>Plumi</span></span>
      </header>

      <section className="sh-head" aria-labelledby="sh-title">
        <div className="sh-titles">
          <h1 id="sh-title" data-testid="deck-title">{deck.title}</h1>
          <p className="sh-count" data-testid="deck-count">{plural(n)}</p>
        </div>
        <div className="sh-add" role="group" aria-label="Add this deck">
          {isAdded ? (
            <>
              <p className="sh-added" role="status" data-testid="add-done"><i aria-hidden="true" />{fresh ? "Added" : "Already in your decks"}</p>
              <AppLink href="/study/flashcards" className="btn gold" ref={openRef} data-testid="open-decks">Open my decks</AppLink>
            </>
          ) : (
            <>
              <button type="button" className="btn gold sh-addbtn" onClick={add} data-testid="add-deck">Add to my decks</button>
              {problem && <p className="sh-soft" role="status">That did not work. Try again.</p>}
            </>
          )}
        </div>
      </section>

      <section className="sh-stage" aria-label="The cards">
        <div className="sh-card" data-turn={turn ?? undefined} data-side={back ? "back" : "front"} onClick={onCardClick} data-testid="card">
          <div className="sh-card-h"><span data-testid="card-side">{back ? "Answer" : "Question"}</span><span>{i + 1} / {n}</span></div>
          <div className="sh-body" tabIndex={0} role="region" aria-label={`Card ${i + 1} of ${n}, ${back ? "answer" : "question"}`} aria-live="polite">
            <p key={`${i}:${back}`} className="sh-text" data-size={sizeFor(text)} data-testid="card-text">{text}</p>
          </div>
        </div>

        <div className="sh-progress" data-testid="progress">
          {n <= DOTS_UP_TO ? (
            <ol className="sh-dots" aria-hidden="true">{deck.cards.map((_, k) => <li key={k} className={k === i ? "now" : k < i ? "seen" : undefined} />)}</ol>
          ) : (
            <div className="sh-bar" aria-hidden="true"><i style={{ width: `${((i + 1) / n) * 100}%` }} /></div>
          )}
          <p className="sh-pos" data-testid="position">{i + 1} / {n}</p>
        </div>

        <div className="sh-controls">
          <button type="button" className="btn sh-nav" onClick={() => go(i - 1)} disabled={i === 0} data-testid="back"><span aria-hidden="true">&lsaquo;</span> Back</button>
          <button type="button" className="btn gold sh-turn" onClick={flip} data-testid="turn">Turn over</button>
          <button type="button" className="btn sh-nav" onClick={() => go(i + 1)} disabled={i === n - 1} data-testid="next">Next <span aria-hidden="true">&rsaquo;</span></button>
        </div>
        <p className="sh-keys" aria-hidden="true"><kbd>Space</kbd> turn over <kbd>&larr;</kbd><kbd>&rarr;</kbd> move</p>
      </section>

      <footer className="sh-foot">
        <button type="button" className="sh-link" onClick={() => setReport(true)} disabled={reported} data-testid="report-open">{reported ? "Reported" : "Report this deck"}</button>
        <a className="sh-link" href={site.domain}>Made with Plumi</a>
      </footer>

      <noscript>
        <ol className="sh-plain">{deck.cards.map((c, k) => <li key={k}><b>{c.front}</b><span>{c.back}</span></li>)}</ol>
      </noscript>

      {report && <ReportSheet code={code} onClose={() => setReport(false)} onSent={() => setReported(true)} />}
    </main>
  );
}
