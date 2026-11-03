import type { Metadata } from "next";
import { QuestionsPage } from "@/components/studyapp/questions/QuestionsPage";
import { bankLevel, bankSubjects, bankTitle } from "@/content/questionBank";
import { bankFile, subjectFile } from "@/lib/studyapp/questions/cropUrls";
import { FEED_KEY } from "@/lib/studyapp/questions/feedView";
import { QUESTIONS_KEY } from "@/lib/studyapp/questions/persist";
import { tiersOf, type CatalogueSubject } from "@/lib/studyapp/questions/subject";
import "../questions.css";
import "../questions-home.css";
import "../questions-ink.css";
import "../questions-sheet.css";
import "../questions-setup.css";
import "../questions-feed.css";

export const metadata: Metadata = { title: "Questions" };

/** Every subject in the question bank, one short line each (the picker's subject chooser). The subject's topics are fetched when it is chosen. */
const catalogue: CatalogueSubject[] = bankSubjects
  .map((s) => {
    const level = bankLevel(s);
    const tiers = tiersOf(s.papers, level);
    return { slug: s.slug, title: bankTitle(s), board: s.board, level, subject: s.subject, count: s.count, ...(tiers.length ? { tiers } : {}) };
  })
  .sort((a, b) => a.title.localeCompare(b.title));

/**
 * Before the app has started, ask for the questions of the subject the student was last in (the feed opens on it): the two small files go on their way
 * at once and are picked up by bankData.ts. It reads only what this device remembers, quietly: no student, no subject, a bad slug or a failure is nothing.
 */
const warm = `(function(){try{var f=JSON.parse(localStorage.getItem(${JSON.stringify(FEED_KEY)})||"null")||{};var d=JSON.parse(localStorage.getItem(${JSON.stringify(QUESTIONS_KEY)})||"null");var m=(d&&d.q&&d.q.mine)||[];var s=f.last&&m.indexOf(f.last)>=0?f.last:m[0];if(!s||!/^[a-z0-9-]+$/.test(s)||(f.view&&f.view[s]==="papers"))return;var w=window.__pw=window.__pw||{};[${JSON.stringify(subjectFile("__S__"))},${JSON.stringify(bankFile("__S__", "parts"))}].forEach(function(t){var u=t.replace("__S__",s),c=new AbortController(),p;setTimeout(function(){c.abort()},15000);p=fetch(u,{signal:c.signal}).then(function(r){if(!r.ok)throw 0;return r.json()});p.catch(function(){});w[u]=p})}catch(e){}})();`;

export default function Questions() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: warm }} />
      <QuestionsPage catalogue={catalogue} />
    </>
  );
}
