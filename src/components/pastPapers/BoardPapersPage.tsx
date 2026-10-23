import Link from "next/link";
import { CosyPage, WindowBar } from "@/components/cosy/Chrome";
import { PageStructuredData } from "@/components/StructuredData";
import { HowToUse, MarkItCard, SourceCredit } from "./PastPaperChrome";
import { PaperClickTracker } from "./PaperClickTracker";
import { PaperTable } from "./PaperTable";
import {
  boardHeading, boardPath, boardsFor, display, fileUrl, hasKind, isOwnBoard, otherLevel, revisionPage, sessionCount, shareImage, subjectPath, subjectTitle,
  type BoardPapers, type Paper, type SubjectHub,
} from "@/content/pastPapers";
import { boardPageMeta } from "@/lib/pastPaperMeta";
import "@/app/pages.css";
import "@/app/past-papers.css";

/**
 * One board's past papers for one subject, e.g. /past-papers/a-level-chemistry/aqa:
 * the page for "AQA A-Level Chemistry past papers". The whole board is on one page,
 * every paper a pinned card with its sessions as rows, newest first. Legacy
 * specifications are folded into <details> under the current one — still in the
 * HTML, so still indexed, but out of the way of this year's students.
 *
 * One page per board rather than per paper, on purpose: ~60 substantial pages
 * rather than ~600 near-identical ones, which is the line between a library and
 * scaled thin content (docs/seo/content-plan.md).
 */
export function BoardPapersPage({ hub, board }: { hub: SubjectHub; board: BoardPapers }) {
  const heading = boardHeading(hub, board);
  const meta = boardPageMeta(hub, board);
  const path = boardPath(hub.slug, board.slug);
  const current = board.groups.filter(g => !g.legacy);
  const legacy = board.groups.filter(g => g.legacy);
  const jumpGroups = current.length > 0 ? current : legacy;
  const jumpNames = jumpGroups.flatMap(g => g.papers.map(p => p.name));
  const uniqueNames = new Set(jumpNames).size === jumpNames.length;
  const siblings = boardsFor(hub.slug).filter(b => b.slug !== board.slug);
  const other = otherLevel(hub);
  const revision = revisionPage(hub);
  const extras = [hasKind(board, "er") && "examiner’s reports", hasKind(board, "ma") && "model answers", hasKind(board, "vs") && "video solutions"].filter(Boolean);
  const years = board.firstYear === board.lastYear ? `${board.lastYear}` : `${board.firstYear} to ${board.lastYear}`;

  return (
    <CosyPage after={<>
      <PageStructuredData path={path} name={meta.title} description={meta.description} image={shareImage(hub)} type="CollectionPage"
        breadcrumb={[{ name: "Past papers", path: "/past-papers" }, { name: subjectTitle(hub), path: subjectPath(hub.slug) }, { name: board.label, path }]} />
      <PaperClickTracker page={path} />
    </>}>
      <article className="pp">
        <header className="lp-wrap pp-hero">
          <nav className="pp-crumbs" aria-label="Breadcrumb">
            <Link href="/past-papers">Past papers</Link><span aria-hidden="true">›</span>
            <Link href={subjectPath(hub.slug)}>{subjectTitle(hub)}</Link><span aria-hidden="true">›</span>
            <span aria-current="page">{board.label}</span>
          </nav>
          <h1>{display(heading)} <em>past papers</em></h1>
          <p className="lp-lead">
            Every {heading} question paper and mark scheme{extras.length ? `, with ${extras.join(" and ")}` : ""}, from {years}.
            Free, no sign‑up. Each session is one row, so the paper and its scheme are side by side.
          </p>
          <ul className="pp-facts" aria-label="At a glance">
            {board.specCodes.length > 0 && <li><strong>{board.specCodes.join(" · ")}</strong><span>specification</span></li>}
            <li><strong>{sessionCount(board)}</strong><span>papers</span></li>
            <li><strong>{board.fileCount}</strong><span>files</span></li>
            <li><strong>{board.lastYear}</strong><span>latest series</span></li>
          </ul>
          {jumpGroups.length > 0 && (
            <nav className="pp-jump" aria-label="Jump to a paper">
              {jumpGroups.flatMap((g, i) => g.papers.map(p => (
                <a key={`${g.id}-${p.id}`} href={`#${g.id}-${p.id}`}>{jumpLabel(g, p.name, i === 0 && uniqueNames)}</a>
              )))}
            </nav>
          )}
        </header>

        {current.map(group => (
          <section key={group.id} id={group.id} aria-labelledby={`${group.id}-title`} className="pp-group">
            <div className="lp-wrap">
              <h2 id={`${group.id}-title`} className="pp-group-title">{display(group.heading)}</h2>
              <div className="pp-papers">
                {group.papers.map(paper => <PaperCard key={paper.id} groupId={group.id} paper={paper} heading={heading} />)}
              </div>
            </div>
          </section>
        ))}

        <section className="pp-mark-wrap" aria-label="Get your paper marked">
          <div className="lp-wrap"><MarkItCard level={hub.level} placement={`papers-${hub.slug}-${board.slug}`} /></div>
        </section>

        {legacy.length > 0 && (
          <section aria-labelledby="legacy-title" className="pp-group pp-legacy">
            <div className="lp-wrap">
              <h2 id="legacy-title" className="pp-group-title">Older specifications</h2>
              <p className="lp-lead">Papers from {board.board}’s earlier {hub.name} specifications. Topics overlap, so they’re good extra practice, but check a question is still on your spec before you rely on it.</p>
              {legacy.map(group => (
                <details key={group.id} id={group.id} className="lp-card pp-old" open={current.length === 0}>
                  <summary><span>{group.heading}</span><span className="pp-count">{group.papers.reduce((n, p) => n + p.rows.length, 0)} papers</span></summary>
                  <div className="pp-papers">
                    {group.papers.map(paper => <PaperCard key={paper.id} groupId={group.id} paper={paper} heading={heading} />)}
                  </div>
                </details>
              ))}
            </div>
          </section>
        )}

        <HowToUse subject={heading} />

        <section aria-labelledby="more-title" className="pp-more">
          <div className="lp-wrap">
            <h2 id="more-title" className="pp-group-title">More {subjectTitle(hub)} past papers</h2>
            <nav className="lp-sp-more" aria-label={`Other ${subjectTitle(hub)} exam boards`}>
              {siblings.map(b => <Link key={b.slug} href={boardPath(hub.slug, b.slug)}>{b.label} {hub.name}</Link>)}
              <Link href={subjectPath(hub.slug)}>All {subjectTitle(hub)} boards</Link>
            </nav>
            <nav className="lp-sp-more" aria-label="Related">
              {other && <Link href={subjectPath(other.slug)}>{subjectTitle(other)} past papers</Link>}
              {revision && <Link href={revision.path}>{revision.label} on Plumi</Link>}
              <Link href="/past-papers">Every subject</Link>
            </nav>
            {isOwnBoard(board)
              ? <p className="pp-credit">Past papers, mark schemes and examiner’s reports are © AQA, from AQA’s published papers. Plumi isn’t affiliated with AQA. Want single questions by topic? <Link href={`/question-bank/aqa-${hub.slug}`}>The {hub.name} question bank</Link>.</p>
              : <SourceCredit source={board.groups[0]?.papers[0]?.source} />}
          </div>
        </section>
      </article>
    </CosyPage>
  );
}

/** A jump chip: the paper's name, with its specification in front when the page has more than one. */
function jumpLabel(group: { heading: string }, name: string, plain: boolean) {
  const spec = group.heading.replace(/\s*\([^)]*\)$/, "");
  return display(plain || name.startsWith(spec) ? name : `${spec}: ${name}`);
}

function PaperCard({ paper, groupId, heading }: { paper: Paper; groupId: string; heading: string }) {
  const id = `${groupId}-${paper.id}`;
  return (
    <section id={id} className="lp-card pp-paper" aria-labelledby={`${id}-title`}>
      <WindowBar label={`${paper.rows.length} sessions`} />
      <div className="pp-paper-body">
        <h3 id={`${id}-title`}>{paper.title}</h3>
        {paper.extras.length > 0 && (
          <p className="pp-extras">
            {paper.extras.map(x => (
              <a key={x.href} href={fileUrl(x.href)} target="_blank" rel="noopener" data-paper={id} data-kind="extra" data-session={x.label}>{x.label}</a>
            ))}
          </p>
        )}
        <PaperTable paper={paper} heading={heading} track={id} />
      </div>
    </section>
  );
}
