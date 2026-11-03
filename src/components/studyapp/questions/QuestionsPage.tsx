"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { droppedLine } from "@/lib/studyapp/questions/model";
import { effectiveMine } from "@/lib/studyapp/questions/mine";
import { onSetsDropped, qa, useQuestions } from "@/lib/studyapp/questions/store";
import type { CatalogueSubject } from "@/lib/studyapp/questions/subject";
import { toast } from "../toast";
import { Home } from "./Home";
import { Picker } from "./Picker";
import { Setup } from "./Setup";
import { Sheet } from "./Sheet";

type View = { kind: "home" } | { kind: "setup" } | { kind: "pick"; mix: boolean };

/**
 * Questions: a shelf of past papers for each subject the student does (Home), a setup for choosing those subjects and their boards
 * (Setup), the picker for choosing questions by hand (Picker), and the sheet they are written on (docs/study/questions.md).
 * The set on the desk is remembered, so closing the tab and coming back returns to it; closing it returns to where it was opened from.
 */
export function QuestionsPage({ catalogue }: { catalogue: CatalogueSubject[] }) {
  const { ready, q } = useQuestions();
  const [view, setView] = useState<View>({ kind: "home" });
  const known = useMemo(() => new Set(catalogue.map((c) => c.slug)), [catalogue]);
  // A new set that pushed an older one out (the cap) says so, so nothing is deleted without a word.
  useEffect(() => onSetsDropped((n) => toast(droppedLine(n))), []);
  if (!ready) {
    return (
      <main className="qs-page qs-wait" role="status" aria-label="Opening your questions">
        <Image src="/study/mascot/plumi-lofi-cozy.svg" alt="" width={64} height={64} unoptimized />
      </main>
    );
  }
  const open = q.open ? q.sets.find((s) => s.id === q.open) : undefined;
  if (open) return <Sheet key={open.id} set={open} q={q} />;
  const mine = effectiveMine(q, known);
  const goHome = () => setView({ kind: "home" });
  if (view.kind === "pick") return <Picker catalogue={catalogue} q={q} mine={mine} autoMix={view.mix} onHome={goHome} />;
  if (view.kind === "setup" || mine.length === 0) {
    return <Setup catalogue={catalogue} mine={mine} first={mine.length === 0} onCancel={goHome} onDone={(slugs) => { qa.mine(slugs); goHome(); }} />;
  }
  return (
    <Home
      catalogue={catalogue} q={q} mine={mine} onSetup={() => setView({ kind: "setup" })}
      onPick={(slug, mix) => { qa.pick(slug, slug === q.pick.subject ? q.pick.topics : []); setView({ kind: "pick", mix }); }}
    />
  );
}
