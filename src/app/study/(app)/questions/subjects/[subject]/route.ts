import { bankHasPracticals, bankHasTiers, bankHasYears, bankLevel, bankSubject, bankSubjects, bankTitle } from "@/content/questionBank";
import type { SubjectMeta } from "@/lib/studyapp/questions/subject";

/** One subject's names and topic tree for the Questions picker, built for every bank subject at build time (the lists of parts are the bank's own files). */
export function generateStaticParams() {
  return bankSubjects.map((s) => ({ subject: s.slug }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ subject: string }> }) {
  const s = bankSubject((await params).subject);
  if (!s) return Response.json({ error: "No such subject" }, { status: 404 });
  const files = (k: "tr" | "ins" | "code" | "qp" | "ms" | "er") => {
    const e = Object.entries(s.wholes).filter(([, w]) => w[k]).map(([key, w]) => [key, w[k] as string]);
    return e.length ? Object.fromEntries(e) : undefined;
  };
  const trs = files("tr"), ins = files("ins"), code = files("code"), qps = files("qp"), mss = files("ms"), ers = files("er");
  const meta: SubjectMeta = {
    slug: s.slug,
    title: bankTitle(s),
    board: s.board,
    level: bankLevel(s),
    subject: s.subject,
    cv: s.cropVersion,
    ...(s.reportsBy === "question" ? { rq: 1 as const } : {}),
    ...(s.noCalc ? { noCalc: 1 as const } : {}),
    ...(s.calcPapers ? { calcPapers: 1 as const } : {}),
    topics: s.topics.map((t) => ({ code: t.code, ref: t.ref, title: t.title, short: t.short, section: t.section, count: t.count })),
    sections: s.sections.map((x) => ({ code: x.code, title: x.title, ...(x.option ? { option: x.option } : {}) })),
    papers: s.papers.map((p) => ({ id: p.id, name: p.name, ...(p.title ? { title: p.title } : {}), ...(p.option ? { option: p.option } : {}) })),
    ...(s.options ? { options: { label: s.options.label, list: s.options.list.map((o) => ({ id: o.id, name: o.name, ...(o.takes ? { takes: o.takes } : {}) })) } } : {}),
    ...(trs ? { trs } : {}),
    ...(ins ? { ins } : {}),
    ...(code ? { code } : {}),
    ...(qps ? { qps } : {}),
    ...(mss ? { mss } : {}),
    ...(ers ? { ers } : {}),
    // The parts, the search text and the reports; and the extra files the public bank's filters read, only where the bank offers that filter for this subject (as QuestionBank.tsx decides).
    data: Object.fromEntries(Object.entries(s.data ?? {}).filter(([k]) => k === "parts" || k === "text" || k === "reports"
      || (k === "practicals" && bankHasPracticals(s)) || (k === "year13" && bankHasYears(s)) || (k === "tiers" && bankHasTiers(s)))),
    series: s.series.map((x) => ({ id: x.id, label: x.label })),
  };
  return Response.json(meta);
}
