import { readFileSync } from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { BankTopicPage } from "@/components/questionBank/BankPages";
import { bankSubject, bankSubjects, bankTopic, bankTopicPath, type BankPart } from "@/content/questionBank";
import { pastPaperMetadata } from "@/lib/pastPaperMeta";

type Params = Promise<{ subject: string; topic: string }>;

/** One page per topic that has questions: the pages search finds. */
export function generateStaticParams() {
  return bankSubjects.flatMap(s => s.topics.filter(t => t.count > 0).map(t => ({ subject: s.slug, topic: t.slug })));
}

export const dynamicParams = false;

/** The topic's questions, newest first, read from the same list the browser fetches. */
function topicParts(slug: string, code: string): BankPart[] {
  const all: BankPart[] = JSON.parse(readFileSync(path.join(process.cwd(), "public", "question-bank", slug, "parts.json"), "utf8"));
  return all.filter(p => p.t.includes(code));
}

async function resolve(params: Params) {
  const { subject, topic } = await params;
  const s = bankSubject(subject);
  const t = s && bankTopic(s, topic);
  return s && t ? { s, t } : undefined;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const found = await resolve(params);
  if (!found) return {};
  const { s, t } = found;
  const title = `${t.title}: ${s.board} A-Level ${s.subject} Exam Questions`;
  return pastPaperMetadata(bankTopicPath(s.slug, t.slug), {
    title: title.length + 8 <= 60 ? `${title} | Plumi` : title,
    description: `All ${t.count} ${s.board} A-Level ${s.subject} exam questions on ${t.title}, ${s.firstYear}–${s.lastYear}, each with its mark scheme and examiner's report. Free.`,
  }, `/og-${s.subject.toLowerCase()}.png`);
}

export default async function Page({ params }: { params: Params }) {
  const found = await resolve(params);
  if (!found) notFound();
  const parts = topicParts(found.s.slug, found.t.code);
  return <BankTopicPage subject={found.s} topic={found.t} parts={parts.slice(0, 20)} index={parts} />;
}
