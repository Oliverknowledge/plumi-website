import { subjectColours } from "@/components/cosy/Book";
import { boardPapers, display, fileUrl } from "@/content/pastPapers";
import { bankPapersPath, bankTitle, baseSubject, type BankSubject } from "@/content/questionBank";
import type { BoardPaper, BoardSubject } from "./TopicBoard";

/**
 * What a revision board needs of a subject (TopicBoard.tsx), made on the server: its topics, their
 * areas, its colour on the shelves, and its current past papers. The bank's page passes its own;
 * My board fetches each of a student's subjects from /my-board/subjects/<slug>.
 */
export function boardSubjectOf(s: BankSubject): BoardSubject {
  return {
    slug: s.slug,
    title: bankTitle(s),
    name: s.subject,
    colour: subjectColours[baseSubject(s)] ?? "#c9b79c",
    topics: s.topics.map(t => ({ code: t.code, ref: t.ref, title: t.title, short: t.short, section: t.section, slug: t.slug, count: t.count, year: t.year })),
    sections: s.sections.map(x => ({ code: x.code, title: x.title })),
    papers: boardPapersOf(s),
  };
}

/**
 * The subject's current papers from the Past papers pages, for the board's paper cards: each keyed
 * as the pages tick it done ("<paper>|<session>"), the last eight sittings of each.
 */
function boardPapersOf(subject: BankSubject): BoardPaper[] {
  const [, , hub, board] = bankPapersPath(subject).split("/");
  const b = boardPapers(hub, board);
  if (!b) return [];
  return b.groups.filter(g => !g.legacy).flatMap(g => g.papers.map(p => ({
    track: `${g.id}-${p.id}`, name: display(p.name), title: p.title,
    sessions: p.rows.slice(0, 8).map(r => ({ session: r.session, qp: r.files.qp && fileUrl(r.files.qp), ms: r.files.ms && fileUrl(r.files.ms) })),
  })));
}
