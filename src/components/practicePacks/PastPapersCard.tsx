import Link from "next/link";
import { boardsFor, display, pastPaperSubjects, subjectPath, subjectTitle } from "@/content/pastPapers";
import { packCopy } from "@/content/practicePacks";
import "@/app/practice-packs.css";

/**
 * The way from Practice papers to the boards' own past papers (/past-papers, which keeps its
 * address). Past papers sit inside Practice papers (founder, 25 October 2026): Plumi's packs
 * come first, and this card follows them on the homepage and at the foot of /practice-papers.
 * Subjects and boards are read from the library, so they stay true as it grows.
 */
const levels = ["A-Level", "GCSE"] as const;
const boards = new Set(pastPaperSubjects.flatMap(s => boardsFor(s.slug).map(b => b.board)));

const PapersIcon = () => <svg viewBox="0 0 16 16" aria-hidden="true" shapeRendering="crispEdges"><path fill="currentColor" d="M2 3h5l1 1 1-1h5v10H9l-1 1-1-1H2zm1 1v8h4l1 1V5L7 4zm6 1v8l1-1h4V4h-4z" /></svg>;

export function PastPapersCard({ placement, strip = false }: { placement: string; strip?: boolean }) {
  const c = packCopy.pastPapers;
  return (
    <aside className={`pk-past${strip ? " pk-past-strip" : " lp-card"}`} aria-labelledby={`${placement}-past-title`} data-testid={`${placement}-past-papers`}>
      <div className="pk-past-copy">
        <span className="pk-past-icon" aria-hidden="true"><PapersIcon /></span>
        <div>
          <span className="lp-eyebrow">{c.eyebrow}</span>
          {strip
            ? <h4 id={`${placement}-past-title`}>{c.title}</h4>
            : <h2 id={`${placement}-past-title`}>{c.title}</h2>}
          <p>{c.line} {pastPaperSubjects.length} subjects, {boards.size} exam boards.</p>
        </div>
      </div>
      <div className="pk-past-subjects">
        {levels.map(level => (
          <ul key={level} aria-label={`${level} past papers`}>
            {pastPaperSubjects.filter(s => s.level === level).map(s => (
              <li key={s.slug}><Link href={subjectPath(s.slug)}>{display(subjectTitle(s))}</Link></li>
            ))}
          </ul>
        ))}
      </div>
      <Link href="/past-papers" className="lp-btn pk-past-go" data-testid={`${placement}-past-papers-link`}>{c.cta} ›</Link>
    </aside>
  );
}
