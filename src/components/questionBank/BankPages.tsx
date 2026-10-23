import Image from "next/image";
import Link from "next/link";
import { Book, TopicSquares } from "@/components/cosy/Book";
import { CosyPage } from "@/components/cosy/Chrome";
import { PageStructuredData } from "@/components/StructuredData";
import { display } from "@/content/pastPapers";
import {
  baseSubject, bankOwner, bankPapersPath, bankPath, bankSubjects, bankTitle, bankTopicPath, paperName, seriesLabel, topicName,
  type BankPart, type BankSubject, type BankTopic,
} from "@/content/questionBank";
import { QuestionBank } from "./QuestionBank";
import "@/app/pages.css";
import "@/app/question-bank.css";

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
  const owner = subject ? bankOwner(subject) : "AQA and Pearson Edexcel";
  return (
    <p className="pp-credit">
      Questions, mark schemes and examiner’s reports are © {owner}, from their published past papers. Plumi isn’t affiliated with any exam board.
      Want whole papers? <Link href={subject ? bankPapersPath(subject) : "/past-papers"}>{subject ? `Every ${subject.board} ${subject.level} ${subject.subject} paper` : "Full past papers"}</Link>.
    </p>
  );
}

export function BankHub() {
  return (
    <CosyPage after={<PageStructuredData path="/question-bank" name="GCSE and A-Level Question Bank: Every Exam Question by Topic" description="Every AQA GCSE and A-Level and Edexcel A-Level Biology, Chemistry and Physics, and Edexcel A-Level Maths and Further Maths exam question, by topic, with its mark scheme and examiner's report." type="CollectionPage" breadcrumb={[{ name: "Question bank", path: "/question-bank" }]} />}>
      <article className="pp qb-page qb-hub">
        <header className="lp-wrap pp-hero qb-hub-hero">
          <div>
            <span className="lp-eyebrow">Free · no sign‑up</span>
            <h1>{display("GCSE and A-Level questions,")} <em>one at a time</em></h1>
            <p className="lp-lead">Every question from AQA’s GCSE Biology, Chemistry and Physics papers since 2018, AQA’s and Edexcel’s A‑Level and AS Biology, Chemistry and Physics since 2016, and Edexcel’s A‑Level Maths and Further Maths since 2018, cut out one by one, sorted by topic, with its mark scheme and the examiner’s report beside it.</p>
          </div>
          <Image className="qb-hub-mascot" src="/landing/plumi-mood-starstruck.svg" alt="" width={150} height={150} unoptimized priority />
        </header>
        <section className="pp-group">
          <div className="lp-wrap">
            {(["Edexcel", "AQA"] as const).map(board => (
            <div key={board} className="qb-board">
            <h2 className="qb-board-name">{board}</h2>
            <ul className="qb-subjects">
              {bankSubjects.filter(s => s.board === board).map(s => (
                <li key={s.slug}>
                  <Link href={bankPath(s.slug)} className="lp-book-link qb-subject">
                    <Book subject={baseSubject(s)} kicker={`${s.board} ${display(s.level)}`} plate={s.subject}>
                      <span className="qb-subject-count"><strong>{s.count.toLocaleString("en-GB")}</strong> questions · {s.topics.length} topics</span>
                      <span className="qb-subject-years">{s.firstYear}–{s.lastYear}</span>
                      <TopicSquares count={s.topics.length} />
                      <span className="pp-board-go" aria-hidden="true">Open the bank →</span>
                    </Book>
                  </Link>
                </li>
              ))}
            </ul>
            </div>
            ))}
            <ol className="lp-sp-steps qb-how">
              {[
                ["Pick a topic.", "Or a paper, a year, or search the words in any question or mark scheme."],
                ["Try it, then check.", "The mark scheme and the examiner’s report open right under the question."],
                ["Take a set with you.", "Add questions to a set and download them as one PDF, mark schemes at the back."],
              ].map(([t, l], i) => (
                <li key={t} className="lp-card lp-step"><span className="lp-num">{String(i + 1).padStart(2, "0")}</span><h2 className="qb-step-title">{t}</h2><p>{l}</p></li>
              ))}
            </ol>
            <Credit />
            <QuietPlumi />
          </div>
        </section>
      </article>
    </CosyPage>
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
      <h1>
        {topic
          ? <>{topic.title}: <em>{display(`${subject.board} ${subject.level} ${subject.subject}`)} questions</em></>
          : <>{display(title)} <em>questions by topic</em></>}
      </h1>
      <p className="lp-lead">
        {topic
          ? `Every ${subject.board} ${subject.level} ${subject.subject} exam question on ${topicName(topic)}${topic.points ? ` (specification points ${topic.points})` : ""}, ${subject.firstYear}–${subject.lastYear}, with its mark scheme and examiner’s report.`
          : `Every question from every ${subject.board} ${subject.level} ${subject.fullName ?? subject.subject} paper, ${subject.firstYear}–${subject.lastYear}, ${subject.reportsBy === "question" ? "question by question" : "part by part"}. Filter by topic, paper or year, open the mark scheme under any question, and download a set as a PDF.`}
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
        <div className="lp-wrap">
          <QuestionBank subject={subject} initial={subject.sample} />
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
          <QuestionBank subject={subject} initial={parts} lockedTopic={topic.code} />
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
