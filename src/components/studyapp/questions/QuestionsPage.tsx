"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { clearFocusIntent, peekFocusIntent } from "@/lib/studyapp/focusIntent";
import { routeFor } from "@/lib/studyapp/focusSubject";
import { baseSubject } from "@/lib/studyapp/questions/subject";
import { viewFor } from "@/lib/studyapp/questions/feedView";
import { currentFeedPrefs, updateFeedPrefs, useFeedPrefs } from "@/lib/studyapp/questions/feedStore";
import { droppedLine } from "@/lib/studyapp/questions/model";
import { effectiveMine } from "@/lib/studyapp/questions/mine";
import { takeHeldScroll } from "@/lib/studyapp/questions/feedStore";
import { onSetsDropped, qa, useQuestions } from "@/lib/studyapp/questions/store";
import type { CatalogueSubject } from "@/lib/studyapp/questions/subject";
import { toast } from "../toast";
import { Home } from "./Home";
import { Picker } from "./Picker";
import { Setup } from "./Setup";
import { Sheet } from "./Sheet";
import { useDocumentTitle } from "./useDocumentTitle";

type View = { kind: "home" } | { kind: "setup" } | { kind: "pick"; mix: boolean };

/**
 * Questions: a shelf of past papers for each subject the student does (Home), a setup for choosing those subjects and their boards
 * (Setup), the picker for choosing questions by hand (Picker), and the sheet they are written on (docs/study/questions.md).
 * The set on the desk is remembered, so closing the tab and coming back returns to it; closing it returns to where it was opened from.
 */
export function QuestionsPage({ catalogue }: { catalogue: CatalogueSubject[] }) {
  const { ready, q } = useQuestions();
  const [view, setView] = useState<View>({ kind: "home" });
  /** A subject the seat card sent them for and they have no book of: the setup brings its book into view. */
  const [want, setWant] = useState<string | null>(null);
  const [arrival] = useState(() => peekFocusIntent());
  const known = useMemo(() => new Set(catalogue.map((c) => c.slug)), [catalogue]);
  // A new set that pushed an older one out (the cap) says so, so nothing is deleted without a word.
  useEffect(() => onSetsDropped((n) => toast(droppedLine(n))), []);
  const open = ready && q.open ? q.sets.find((s) => s.id === q.open) : undefined;
  const mine = useMemo(() => effectiveMine(q, known), [q, known]);
  // Arriving from "Do Plumi questions" in the library: the book of the subject they are focusing on (see focusSubject.ts), decided once, as soon as their own books are known.
  const [decided, setDecided] = useState(false);
  const [toFeed, setToFeed] = useState<string | null>(null);
  if (ready && arrival && !decided) {
    setDecided(true);
    const p = currentFeedPrefs();
    const r = routeFor(arrival.subject, mine, catalogue, p.last, Object.keys(p.pos).reverse());
    if (r.kind === "feed") setToFeed(r.slug);
    else if (r.kind === "setup") { setWant(r.base); setView({ kind: "setup" }); }
  }
  const prefs = useFeedPrefs();
  // Until the feed has been pointed at that book, the page waits (it never opens the subject they were on and then jumps).
  const [pointed, setPointed] = useState(false);
  if (toFeed !== null && !pointed && prefs.last === toFeed && viewFor(prefs, toFeed) === "questions") setPointed(true);
  const pointing = toFeed !== null && !pointed;
  useEffect(() => {
    if (!decided) return;
    clearFocusIntent();
    if (toFeed) updateFeedPrefs((x) => ({ ...x, last: toFeed, view: { ...x.view, [toFeed]: "questions" } }));
  }, [decided, toFeed]);
  const screen = !ready || pointing ? "wait" : open ? `sheet:${open.id}` : view.kind === "pick" ? "pick" : view.kind === "setup" || mine.length === 0 ? "setup" : "home";
  // Each screen is its own page: it opens at the top (the sheet puts itself back where the student was), and the tab says where they are.
  useEffect(() => { if (screen !== "wait" && !takeHeldScroll()) window.scrollTo(0, 0); }, [screen]);
  useDocumentTitle(screen === "pick" ? "Pick questions \u00b7 Plumi" : screen === "setup" ? "What are you studying? \u00b7 Plumi" : screen === "home" ? "Questions \u00b7 Plumi" : null);
  if (!ready || pointing) {
    return (
      <main className="qs-page qs-wait" role="status" aria-label="Opening your questions">
        <Image src="/study/mascot/plumi-lofi-cozy.svg" alt="" width={64} height={64} unoptimized />
      </main>
    );
  }
  if (open) return <Sheet key={open.id} set={open} q={q} />;
  const goHome = () => { setWant(null); setView({ kind: "home" }); };
  if (view.kind === "pick") return <Picker catalogue={catalogue} q={q} mine={mine} autoMix={view.mix} onHome={goHome} />;
  if (view.kind === "setup" || mine.length === 0) {
    return (
      <Setup
        catalogue={catalogue} mine={mine} tiers={q.tiers ?? {}} first={mine.length === 0} want={want ?? undefined} onCancel={goHome}
        onDone={(slugs, tiers) => {
          qa.mine(slugs);
          for (const [slug, t] of Object.entries(tiers)) qa.tiers(slug, t, catalogue.find((c) => c.slug === slug)?.tiers ?? []);
          // The book they came for, now ticked, is the one that opens.
          const got = want ? slugs.find((slug) => baseSubject(catalogue.find((c) => c.slug === slug)?.subject ?? "") === want) : undefined;
          if (got) updateFeedPrefs((x) => ({ ...x, last: got, view: { ...x.view, [got]: "questions" } }));
          goHome();
        }}
      />
    );
  }
  return (
    <Home
      catalogue={catalogue} q={q} mine={mine} onSetup={() => setView({ kind: "setup" })}
      onPick={(slug, mix) => { qa.pick(slug, slug === q.pick.subject ? q.pick.topics : []); setView({ kind: "pick", mix }); }}
    />
  );
}
