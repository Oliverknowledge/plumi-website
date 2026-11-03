import type { Metadata } from "next";
import { QuestionsPage } from "@/components/studyapp/questions/QuestionsPage";
import { bankLevel, bankSubjects, bankTitle } from "@/content/questionBank";
import { tiersOf, type CatalogueSubject } from "@/lib/studyapp/questions/subject";
import "../questions.css";
import "../questions-home.css";
import "../questions-ink.css";
import "../questions-sheet.css";

export const metadata: Metadata = { title: "Questions" };

/** Every subject in the question bank, one short line each (the picker's subject chooser). The subject's topics are fetched when it is chosen. */
const catalogue: CatalogueSubject[] = bankSubjects
  .map((s) => {
    const level = bankLevel(s);
    const tiers = tiersOf(s.papers, level);
    return { slug: s.slug, title: bankTitle(s), board: s.board, level, subject: s.subject, count: s.count, ...(tiers.length ? { tiers } : {}) };
  })
  .sort((a, b) => a.title.localeCompare(b.title));

export default function Questions() {
  return <QuestionsPage catalogue={catalogue} />;
}
