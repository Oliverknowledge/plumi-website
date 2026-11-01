import Image from "next/image";
import Link from "next/link";
import { subjectColours } from "@/components/cosy/Book";
import { CosyPage } from "@/components/cosy/Chrome";
import { PageStructuredData } from "@/components/StructuredData";
import { boardPapers, display } from "@/content/pastPapers";
import {
  baseSubject, bankOwner, bankPapersPath, bankPath, bankSubjects, bankTitle, bankTopicPath, bankYears, paperName, seriesLabel, topicName,
  type BankPart, type BankSubject, type BankTopic,
} from "@/content/questionBank";
import { packFor, packPath } from "@/content/practicePacks";
import { BankShelves, BoardRow, RememberBank, type Shelf } from "./BankShelves";
import { AskForSubject, AskForSubjectHint } from "@/components/cosy/AskForSubject";
import { QuestionBank } from "./QuestionBank";
import { boardSubjectOf } from "./boardData";
import "@/app/pages.css";
import "@/app/question-bank.css";
import "@/app/question-bank-board.css";
import "@/app/question-bank-hub.css";

/**
 * The question bank's three kinds of page, all in the cosy notebook:
 *  - /question-bank: pick a subject.
 *  - /question-bank/aqa-a-level-chemistry: the bank, with every filter.
 *  - /question-bank/aqa-a-level-chemistry/group-2-...: one topic's questions,
 *    server-rendered whole, for the student who searched "AQA group 2 exam questions".
 * Plumi itself gets one quiet line at the foot of each page, and nothing more.
 */

function QuietPlumi() {
  return (
    <p className="qb-quiet">
      Rather write your answers by hand on iPad? <Link href="/">Plumi</Link> marks them against the same mark schemes.
    </p>
  );
}

function Credit({ subject }: { subject?: BankSubject }) {
  const owner = subject ? bankOwner(subject) : "AQA, Pearson Edexcel, OCR, WJEC Eduqas, Cambridge University Press & Assessment and WJEC CBAC Ltd";
  // Not every bank subject has a library page yet (Psychology): then the library's front door.
  const [, , hub, board] = subject ? bankPapersPath(subject).split("/") : [];
  const library = subject && boardPapers(hub, board) ? subject : undefined;
  // Plumi's own pack for this subject, where there is one: still the same one line.
  const pack = subject ? packFor(bankPath(subject.slug)) : undefined;
  return (
    <p className="pp-credit">
      Questions, mark schemes and examiner’s reports are © {owner}, from their published past papers. Plumi isn’t affiliated with any exam board.
      Want whole papers? <Link href={library ? bankPapersPath(library) : "/past-papers"}>{library ? `Every ${library.board} ${library.level} ${library.subject} paper` : "Full past papers"}</Link>{pack
        ? <>, or <Link href={packPath(pack.slug)}>our free {pack.board}-style practice pack</Link>.</>
        : "."}
    </p>
  );
}

/**
 * The hub's shelves, a level each and a book a subject (the founder, 30 October 2026: not three
 * "Maths" books in a row). Cambridge IGCSE shares GCSE's shelf, since an IGCSE student looks for
 * GCSE-level Maths, not for a board. Subjects go biggest first, Maths and the sciences ahead;
 * a book's boards go AQA, Edexcel, OCR, then the rest, the way most students sit them.
 */
const LEVELS = [
  { id: "gcse", name: "GCSE & IGCSE", jump: "GCSE", match: (s: BankSubject) => s.level === "GCSE" || s.level === "IGCSE" || s.level === "Level 2" },
  { id: "a-level", name: display("A-Level"), jump: display("A-Level"), match: (s: BankSubject) => s.level === "A-Level" },
  { id: "level-3", name: "Level 3 vocational", jump: "Level 3", match: (s: BankSubject) => s.level === "Level 3" },
];
const FIRST = ["Maths", "Further Maths", "Biology", "Chemistry", "Physics", "Combined Science"];
const BOARDS = ["AQA", "Edexcel", "OCR", "OCR MEI", "Eduqas", "WJEC", "CAIE"];
const variant = (s: BankSubject) => s.subject.match(/ ([AB])$/)?.[1];
/** The name on a board's key: "AQA", "OCR B", "Cambridge IGCSE", "Edexcel International GCSE". */
const boardKey = (s: BankSubject) =>
  [s.board === "CAIE" ? (s.level === "IGCSE" ? "Cambridge IGCSE" : "Cambridge") : s.level === "IGCSE" ? `${s.board} International GCSE` : s.board, variant(s)].filter(Boolean).join(" ");
/** What the search matches a bank on: its board by every name, its level, subject and specification codes. */
const findText = (s: BankSubject) => [
  s.board, s.board === "CAIE" ? "cambridge cie international" : s.board === "Edexcel" ? "pearson" : "",
  s.level, s.level === "A-Level" ? "alevel a level as" : s.level === "IGCSE" ? "gcse international" : s.level === "Level 2" ? "gcse l2 certificate" : s.level === "Level 3" ? "applied diploma vocational" : "",
  s.subject, s.fullName ?? "", /Maths/.test(s.subject) ? "math mathematics" : "", ...s.specs,
].join(" ").toLowerCase().replace(/[^a-z0-9 ]+/g, " ");

function shelves(): Shelf[] {
  return LEVELS.map(lv => {
    const banks = bankSubjects.filter(lv.match);
    const subjects = [...new Set(banks.map(baseSubject))];
    const books = subjects.map(subject => {
      const mine = banks.filter(s => baseSubject(s) === subject)
        .sort((a, b) => (a.level === "IGCSE" ? 1 : 0) - (b.level === "IGCSE" ? 1 : 0) || BOARDS.indexOf(a.board) - BOARDS.indexOf(b.board) || (variant(a) ?? "").localeCompare(variant(b) ?? ""));
      return {
        subject, colour: subjectColours[subject] ?? "#d8c8ad", count: mine.reduce((a, s) => a + s.count, 0),
        banks: mine.map(s => ({ slug: s.slug, board: boardKey(s), title: display(bankTitle(s)), count: s.count, years: bankYears(s), find: findText(s) })),
      };
    }).sort((a, b) => {
      const fa = FIRST.indexOf(a.subject), fb = FIRST.indexOf(b.subject);
      return (fa < 0 ? 99 : fa) - (fb < 0 ? 99 : fb) || b.count - a.count;
    });
    return { id: lv.id, name: lv.name, jump: lv.jump, books };
  }).filter(sh => sh.books.length);
}

export function BankHub() {
  const all = shelves();
  const total = bankSubjects.reduce((a, s) => a + s.count, 0);
  return (
    <CosyPage after={<PageStructuredData path="/question-bank" name="GCSE and A-Level Question Bank: Every Exam Question by Topic" description="Every AQA and Edexcel GCSE and A-Level, and OCR A-Level, Biology, Chemistry and Physics, AQA GCSE Combined Science, AQA, Edexcel and OCR GCSE Maths (Foundation and Higher), and AQA, Edexcel, OCR and OCR MEI A-Level Maths, Edexcel, OCR and OCR MEI Further Maths exam question, AQA A-Level Psychology, AQA and OCR A-Level Economics, OCR A-Level Law, AQA A-Level Philosophy, AQA A-Level Sociology, AQA A-Level Business, AQA A-Level Geography, AQA GCSE English Literature, English Language and Geography and A-Level English Literature A and B, Edexcel and OCR A-Level English Literature, Edexcel A-Level Economics A and B, Edexcel A-Level Geography and GCSE Geography B, Edexcel A-Level Psychology, Edexcel A-Level Politics, OCR and AQA A-Level Computer Science and Edexcel GCSE Computer Science exam questions, Eduqas A-Level Biology, Chemistry and Physics, AS/A Level Religious Studies and GCSE Religious Studies and History, and every question from the CAIE (Cambridge International) AS & A Level and IGCSE papers Cambridge publishes, and WJEC AS/A Level Biology, Chemistry, Physics and Maths and WJEC Level 3 Applied Diploma in Criminology exam questions, by topic, with its mark scheme and examiner's report." type="CollectionPage" breadcrumb={[{ name: "Question bank", path: "/question-bank" }]} />}>
      <article className="pp qb-page qb-hub">
        <header className="lp-wrap qb-hub-hero">
          <span className="qb-hub-eyebrow">Free · no sign‑up · {total.toLocaleString("en-GB")} questions</span>
          <h1>{display("GCSE and A-Level questions,")} <em>one at a time</em></h1>
          <p className="qb-hub-lead">Every past-paper question from AQA, Edexcel, OCR, Eduqas, Cambridge and WJEC, sorted by topic, with the mark scheme right underneath.</p>
          <AskForSubjectHint />
          <Image className="qb-hub-mascot" src="/landing/plumi-mood-starstruck.svg" alt="" width={84} height={84} unoptimized priority />
        </header>
        <section className="qb-hub-shelves">
          <div className="lp-wrap">
            <BankShelves shelves={all} />
            <AskForSubject placement="bank-hub" />
            <section className="qb-how" aria-labelledby="qb-how-h">
              <h2 id="qb-how-h" className="qb-how-h">How it works</h2>
              <ol>
                {[
                  ["Pick a topic", "Or a paper, a year, or search the words in any question or mark scheme."],
                  ["Try it, then check", "The mark scheme and the examiner’s report open right under the question."],
                  ["Take a set with you", "Add questions to a set and download them as one PDF, mark schemes at the back."],
                ].map(([t, l], i) => (
                  <li key={t}><span className="qb-how-n" aria-hidden="true">{i + 1}</span><h3>{t}</h3><p>{l}</p></li>
                ))}
              </ol>
            </section>
            <Credit />
            <QuietPlumi />
          </div>
        </section>
      </article>
    </CosyPage>
  );
}

/** The same subject at the same level from the other boards: one tap to the right book, without the hub. */
function OtherBoards({ subject }: { subject: BankSubject }) {
  const level = (s: BankSubject) => (s.level === "IGCSE" ? "GCSE" : s.level);
  const near = bankSubjects
    .filter(s => level(s) === level(subject) && baseSubject(s) === baseSubject(subject))
    .sort((a, b) => (a.level === "IGCSE" ? 1 : 0) - (b.level === "IGCSE" ? 1 : 0) || BOARDS.indexOf(a.board) - BOARDS.indexOf(b.board) || (variant(a) ?? "").localeCompare(variant(b) ?? ""));
  if (near.length < 2) return null;
  return (
    <BoardRow>
      <span>Board:</span>
      {near.map(s => s.slug === subject.slug
        ? <span key={s.slug} className="is-on" aria-current="page">{boardKey(s)}</span>
        : <Link key={s.slug} href={bankPath(s.slug)}>{boardKey(s)}</Link>)}
    </BoardRow>
  );
}

function Hero({ subject, topic }: { subject: BankSubject; topic?: BankTopic }) {
  const title = bankTitle(subject);
  return (
    <header className="lp-wrap pp-hero qb-hero">
      <nav className="pp-crumbs" aria-label="Breadcrumb">
        <Link href="/question-bank">Question bank</Link><span aria-hidden="true">›</span>
        {topic ? <><Link href={bankPath(subject.slug)}>{display(title)}</Link><span aria-hidden="true">›</span><span aria-current="page">{topicName(topic)}</span></>
          : <span aria-current="page">{display(title)}</span>}
      </nav>
      {!topic && <OtherBoards subject={subject} />}
      <h1>
        {topic
          ? <>{topic.title}: <em>{display(`${subject.board} ${subject.level} ${subject.subject}`)} questions</em></>
          : <>{display(title)} <em>questions by topic</em></>}
      </h1>
      <p className="lp-lead">
        {topic
          ? `Every ${subject.board} ${subject.level} ${subject.subject} exam question on ${topicName(topic)}${topic.points ? ` (specification points ${topic.points})` : ""}, ${bankYears(subject)}, with its mark scheme and examiner’s report.`
          : subject.scope
            // Cambridge (CAIE) keeps its archive for schools: say plainly what's public, and so here.
            ? `Every question from the ${subject.board} ${subject.level === "IGCSE" ? "IGCSE" : "AS & A Level"} ${subject.fullName ?? subject.subject} papers Cambridge International publishes, ${subject.scope}, ${subject.reportsBy === "question" ? "question by question" : "part by part"}. Cambridge keeps its other papers on its School Support Hub, for schools. Filter by topic or paper, open the mark scheme under any question, and download a set as a PDF.`
            : `Every question from every ${subject.board} ${subject.level} ${subject.fullName ?? subject.subject} paper, ${subject.firstYear}–${subject.lastYear}, ${subject.reportsBy === "question" ? "question by question" : "part by part"}. Filter by topic, paper or year, open the mark scheme under any question, and download a set as a PDF.`}
        {!topic && subject.note ? ` ${subject.note}` : null}
      </p>
    </header>
  );
}

export function BankSubjectPage({ subject }: { subject: BankSubject }) {
  const name = `${bankTitle(subject)} Questions by Topic`;
  return (
    <CosyPage after={<PageStructuredData path={bankPath(subject.slug)} name={name} description={`Every ${subject.board} ${subject.level} ${subject.subject} exam question by topic, with mark schemes and examiner's reports.`} type="CollectionPage"
      breadcrumb={[{ name: "Question bank", path: "/question-bank" }, { name: bankTitle(subject), path: bankPath(subject.slug) }]} />}>
      <article className="pp qb-page">
        <Hero subject={subject} />
        <RememberBank slug={subject.slug} />
        <div className="lp-wrap">
          <QuestionBank subject={subject} initial={subject.sample} board={boardSubjectOf(subject)} />
          <nav className="lp-sp-more qb-topic-index" aria-label={`${subject.subject} topics`}>
            <span>Every topic:</span>
            {subject.topics.filter(t => t.count > 0).map(t => <Link key={t.slug} href={bankTopicPath(subject.slug, t.slug)}>{topicName(t)}</Link>)}
          </nav>
          <Credit subject={subject} />
          <QuietPlumi />
        </div>
      </article>
    </CosyPage>
  );
}

export function BankTopicPage({ subject, topic, parts, index }: { subject: BankSubject; topic: BankTopic; parts: BankPart[]; index: BankPart[] }) {
  const path = bankTopicPath(subject.slug, topic.slug);
  const siblings = subject.topics.filter(t => t.section === topic.section && t.slug !== topic.slug && t.count > 0);
  return (
    <CosyPage after={<PageStructuredData path={path} name={`${topic.title}: ${subject.board} ${subject.level} ${subject.subject} Exam Questions`} description={`Every ${subject.board} ${subject.level} ${subject.subject} question on ${topic.title}, with mark schemes.`} type="CollectionPage"
      breadcrumb={[{ name: "Question bank", path: "/question-bank" }, { name: bankTitle(subject), path: bankPath(subject.slug) }, { name: topic.title, path }]} />}>
      <article className="pp qb-page">
        <Hero subject={subject} topic={topic} />
        <div className="lp-wrap">
          <QuestionBank subject={subject} initial={parts} lockedTopic={topic.code} board={boardSubjectOf(subject)} />
          {/* Every question on the topic as text: what a crawler reads, and a quick contents list for anyone. */}
          <details className="lp-card qb-index">
            <summary>All {index.length} questions on {topic.title}, as a list</summary>
            <ol>
              {index.map(p => (
                <li key={p.id}><strong>{seriesLabel(subject, p.s)}, {paperName(subject, p.p)}, Q{p.l}</strong>{p.m != null ? ` (${p.m} ${p.m === 1 ? "mark" : "marks"})` : ""}: {p.x}</li>
              ))}
            </ol>
          </details>
          {siblings.length > 0 && (
            <nav className="lp-sp-more" aria-label="Nearby topics">
              <span>Nearby topics:</span>
              {siblings.map(t => <Link key={t.slug} href={bankTopicPath(subject.slug, t.slug)}>{topicName(t)}</Link>)}
              <Link href={bankPath(subject.slug)}>The whole bank</Link>
            </nav>
          )}
          <Credit subject={subject} />
          <QuietPlumi />
        </div>
      </article>
    </CosyPage>
  );
}
