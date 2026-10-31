import Image from "next/image";
import Link from "next/link";
import { Book } from "@/components/cosy/Book";
import { CosyPage } from "@/components/cosy/Chrome";
import { PageStructuredData } from "@/components/StructuredData";
import { intentFor } from "@/config/routes";
import { SourceCredit } from "./PastPaperChrome";
import { boardPath, boardsFor, display, pastPaperSubjects, subjectPath, subjectTitle, type Level } from "@/content/pastPapers";
import "@/app/pages.css";
import "@/app/past-papers.css";

/**
 * /past-papers: the library's front door, for "GCSE and A-Level past papers".
 * Every subject at each level as a book (Book.tsx), with each board one tap away,
 * so a student is two clicks from any paper and a crawler reaches every page.
 */
export function PastPapersHub() {
  const intent = intentFor("/past-papers");
  const levels: Level[] = ["A-Level", "GCSE"];
  return (
    <CosyPage after={
      <PageStructuredData path="/past-papers" name={intent.title} description={intent.description} type="CollectionPage"
        breadcrumb={[{ name: "Past papers", path: "/past-papers" }]} />
    }>
      <article className="pp">
        <header className="lp-wrap pp-hero pp-hub-hero">
          <div>
            <nav className="pp-crumbs" aria-label="Breadcrumb">
                            <span aria-current="page">Past papers</span>
            </nav>
            <span className="lp-eyebrow">Free · no sign‑up</span>
            <h1>{display(intent.h1.replace(/ past papers$/, ""))} <em>past papers</em></h1>
            <p className="lp-lead">
              Maths, Further Maths, Biology, Chemistry and Physics, for AQA, Edexcel, OCR, WJEC, Eduqas and Cambridge, AQA GCSE English Language and Geography, and Edexcel GCSE Computer Science.
              Every paper each board publishes, with its mark scheme, a whole board on one page.
            </p>
          </div>
          <Image className="pp-hub-mascot" src="/landing/plumi-mood-thinking.svg" alt="" width={150} height={150} unoptimized priority />
        </header>

        {levels.map(level => (
          <section key={level} aria-labelledby={`${level}-title`} className="pp-group">
            <div className="lp-wrap">
              <h2 id={`${level}-title`} className="pp-group-title">{level === "GCSE" ? "GCSE & IGCSE" : "A-Level & International A-Level"}</h2>
              <div className="pp-subjects">
                {pastPaperSubjects.filter(s => s.level === level).map(s => (
                  <Book key={s.slug} as="article" className="pp-subject" subject={s.name} aria-labelledby={`${s.slug}-title`}
                    kicker={display(level === "GCSE" ? "GCSE & IGCSE" : "A-Level")}
                    plate={<h3 id={`${s.slug}-title`}><Link href={subjectPath(s.slug)}>{s.name}{" "}<small>{display(subjectTitle(s))} past papers</small></Link></h3>}>
                    <ul className="lp-boards">
                      {boardsFor(s.slug).map(b => (
                        <li key={b.slug}><Link href={boardPath(s.slug, b.slug)} aria-label={`${b.board} ${b.qualification} ${s.name} past papers`}>{b.label}</Link></li>
                      ))}
                    </ul>
                  </Book>
                ))}
              </div>
            </div>
          </section>
        ))}

        <section className="pp-more">
          <div className="lp-wrap"><SourceCredit /></div>
        </section>
      </article>
    </CosyPage>
  );
}
