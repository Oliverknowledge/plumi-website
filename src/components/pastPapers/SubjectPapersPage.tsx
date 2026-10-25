import Link from "next/link";
import { CosyPage } from "@/components/cosy/Chrome";
import { PageStructuredData } from "@/components/StructuredData";
import { HowToUse, MarkItCard, SourceCredit } from "./PastPaperChrome";
import {
  boardPath, boardsFor, display, otherLevel, pastPaperSubjects, revisionPage, sessionCount, shareImage, subjectPath, subjectTitle,
  type SubjectHub,
} from "@/content/pastPapers";
import { subjectPageMeta } from "@/lib/pastPaperMeta";
import { packFor } from "@/content/practicePacks";
import { PackPromo } from "@/components/practicePacks/Pack";
import "@/app/pages.css";
import "@/app/past-papers.css";

/**
 * One subject at one level, e.g. /past-papers/a-level-chemistry: the page for
 * "A-Level Chemistry past papers". It does one job — get the student to their
 * board — so it is a card per board, each carrying the facts that tell boards
 * apart (specification codes, which years, how many papers).
 */
export function SubjectPapersPage({ hub }: { hub: SubjectHub }) {
  const boards = boardsFor(hub.slug);
  const meta = subjectPageMeta(hub);
  const path = subjectPath(hub.slug);
  const other = otherLevel(hub);
  const revision = revisionPage(hub);
  const pack = packFor(path);
  const sameLevel = pastPaperSubjects.filter(s => s.level === hub.level && s.slug !== hub.slug);

  return (
    <CosyPage after={
      <PageStructuredData path={path} name={meta.title} description={meta.description} image={shareImage(hub)} type="CollectionPage"
        breadcrumb={[{ name: "Practice papers", path: "/practice-papers" }, { name: "Past papers", path: "/past-papers" }, { name: subjectTitle(hub), path }]} />
    }>
      <article className="pp">
        <header className="lp-wrap pp-hero">
          <nav className="pp-crumbs" aria-label="Breadcrumb">
            <Link href="/practice-papers">Practice papers</Link><span aria-hidden="true">›</span>
            <Link href="/past-papers">Past papers</Link><span aria-hidden="true">›</span>
            <span aria-current="page">{subjectTitle(hub)}</span>
          </nav>
          <h1>{display(subjectTitle(hub))} <em>past papers</em></h1>
          <p className="lp-lead">{meta.description.replace(/ Pick your (exam )?board; every paper is on one page\.$/, "")} Pick your exam board below: every paper it has set is on one page, with its mark scheme beside it.</p>
        </header>

        <section aria-labelledby="boards-title" className="pp-group">
          <div className="lp-wrap">
            <h2 id="boards-title" className="pp-group-title">Choose your exam board</h2>
            <ul className="pp-boards">
              {boards.map(b => (
                <li key={b.slug}>
                  <Link href={boardPath(hub.slug, b.slug)} className="lp-card pp-board">
                    <span className="pp-board-name">{b.label}</span>
                    <span className="pp-board-qual">{b.qualification} {hub.name}</span>
                    {b.specCodes.length > 0 && <span className="pp-board-spec">{b.specCodes.join(" · ")}</span>}
                    <span className="pp-board-meta">{sessionCount(b)} papers · {b.firstYear}–{b.lastYear}</span>
                    <span className="pp-board-go" aria-hidden="true">Open →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {pack && (
          <section className="pp-mark-wrap" aria-label="Plumi practice pack">
            <div className="lp-wrap"><PackPromo pack={pack} placement={`papers-${hub.slug}`} /></div>
          </section>
        )}

        <section className="pp-mark-wrap" aria-label="Get your paper marked">
          <div className="lp-wrap"><MarkItCard level={hub.level} placement={`papers-${hub.slug}`} /></div>
        </section>

        <HowToUse subject={subjectTitle(hub)} />

        <section aria-labelledby="more-title" className="pp-more">
          <div className="lp-wrap">
            <h2 id="more-title" className="pp-group-title">Other {hub.level} past papers</h2>
            <nav className="lp-sp-more" aria-label={`Other ${hub.level} subjects`}>
              {sameLevel.map(s => <Link key={s.slug} href={subjectPath(s.slug)}>{subjectTitle(s)}</Link>)}
              {other && <Link href={subjectPath(other.slug)}>{subjectTitle(other)}</Link>}
              {revision && <Link href={revision.path}>{revision.label} on Plumi</Link>}
            </nav>
            <SourceCredit />
          </div>
        </section>
      </article>
    </CosyPage>
  );
}
