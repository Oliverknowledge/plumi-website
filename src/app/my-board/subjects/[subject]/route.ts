import { boardSubjectOf } from "@/components/questionBank/boardData";
import { bankSubject, bankSubjects } from "@/content/questionBank";

/** One subject's board data for My board (boardData.ts), built for every bank subject at build time. */
export function generateStaticParams() {
  return bankSubjects.map(s => ({ subject: s.slug }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ subject: string }> }) {
  const s = bankSubject((await params).subject);
  if (!s) return Response.json({ error: "No such subject" }, { status: 404 });
  return Response.json(boardSubjectOf(s));
}
