import { bankLevel, bankSubject, bankSubjects, bankTitle } from "@/content/questionBank";
import type { SubjectMeta } from "@/lib/studyapp/questions/subject";

/** One subject's names and topic tree for the Questions picker, built for every bank subject at build time (the lists of parts are the bank's own files). */
export function generateStaticParams() {
  return bankSubjects.map((s) => ({ subject: s.slug }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ subject: string }> }) {
  const s = bankSubject((await params).subject);
  if (!s) return Response.json({ error: "No such subject" }, { status: 404 });
  const meta: SubjectMeta = {
    slug: s.slug,
    title: bankTitle(s),
    board: s.board,
    level: bankLevel(s),
    subject: s.subject,
    cv: s.cropVersion,
    ...(s.reportsBy === "question" ? { rq: 1 as const } : {}),
    topics: s.topics.map((t) => ({ code: t.code, ref: t.ref, title: t.title, short: t.short, section: t.section, count: t.count })),
    sections: s.sections.map((x) => ({ code: x.code, title: x.title })),
    papers: s.papers.map((p) => ({ id: p.id, name: p.name })),
    series: s.series.map((x) => ({ id: x.id, label: x.label })),
  };
  return Response.json(meta);
}
