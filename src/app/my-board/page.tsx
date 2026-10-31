import type { Metadata } from "next";
import { subjectColours } from "@/components/cosy/Book";
import { CosyPage } from "@/components/cosy/Chrome";
import { MyBoard } from "@/components/questionBank/MyBoard";
import { bankSubjects, bankTitle, baseSubject } from "@/content/questionBank";
import "@/app/pages.css";
import "@/app/question-bank.css";
import "@/app/question-bank-board.css";
import "@/app/question-bank-hub.css";

// A student's own page: nothing on it until their browser fills it, so not for search.
export const metadata: Metadata = {
  title: "My board",
  description: "Every subject you’re revising on one board: the topics to start, practise, revise and the ones you’ve got.",
  robots: { index: false, follow: true },
};

export default function Page() {
  const catalogue = bankSubjects.map(s => ({ slug: s.slug, title: bankTitle(s), colour: subjectColours[baseSubject(s)] ?? "#c9b79c" }));
  return (
    <CosyPage>
      <article className="pp qb-page mb-page">
        <header className="lp-wrap qb-hub-hero mb-hero">
          <p className="qb-hub-eyebrow">Saved in this browser · free</p>
          <h1>My board</h1>
          <p className="qb-hub-lead">Every subject you’re revising, on one board. Drag a card to where it’s at; open one to practise it.</p>
        </header>
        <div className="lp-wrap">
          <MyBoard catalogue={catalogue} />
        </div>
      </article>
    </CosyPage>
  );
}
