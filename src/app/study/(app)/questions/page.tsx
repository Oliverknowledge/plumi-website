import type { Metadata } from "next";
import { QuestionsPage } from "@/components/studyapp/questions/QuestionsPage";
import { bankLevel, bankSubjects, bankTitle } from "@/content/questionBank";
import type { CatalogueSubject } from "@/lib/studyapp/questions/subject";
import "../questions.css";
import "../questions-home.css";
import "../questions-ink.css";
import "../questions-sheet.css";

export const metadata: Metadata = { title: "Questions" };

/** Every subject in the question bank, one short line each (the picker's subject chooser). The subject's topics are fetched when it is chosen. */
const catalogue: CatalogueSubject[] = bankSubjects
  .map((s) => ({ slug: s.slug, title: bankTitle(s), board: s.board, level: bankLevel(s), subject: s.subject, count: s.count }))
  .sort((a, b) => a.title.localeCompare(b.title));

export default function Questions() {
  return <QuestionsPage catalogue={catalogue} />;
}
