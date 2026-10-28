import { readFileSync } from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { EmbedQuestionList } from "@/components/questionBank/EmbedQuestionList";
import { bankSubject, bankTopic, bankTopicPath, type BankPart } from "@/content/questionBank";
import { sortNewest } from "@/lib/embed";

type Params = Promise<{ subject: string; topic: string }>;

/**
 * Built the first time each topic is asked for and cached after that, rather than all
 * 1,200 at build time: the topic pages already cost that once, and an embed is asked
 * for far less often. An unknown subject or topic is a 404.
 */
export function generateStaticParams() {
  return [];
}
export const dynamicParams = true;

/** The topic's parts, read from the same list the topic page reads. */
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

/**
 * Never indexed, and credited to the real page: the canonical is the normal topic
 * page, so whatever a search engine makes of an embed counts for Plumi's own URL.
 * `googleBot` is spelled out because the root layout's robots says index there, and
 * a nested layout's robots replaces rather than merges.
 */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const found = await resolve(params);
  if (!found) return {};
  const { s, t } = found;
  return {
    title: { absolute: `${t.title}: ${s.board} ${s.level} ${s.subject} practice questions` },
    description: `${s.board} ${s.level} ${s.subject} questions on ${t.title}, from Plumi.`,
    alternates: { canonical: bankTopicPath(s.slug, t.slug) },
    robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
    openGraph: null,
    twitter: null,
  };
}

export default async function Page({ params }: { params: Params }) {
  const found = await resolve(params);
  if (!found) notFound();
  const { s, t } = found;
  const parts = sortNewest(s.papers, topicParts(s.slug, t.code));
  // The client gets what a row reads and no more: the bank's sample and whole-paper links stay on the server.
  const subject = { ...s, sample: [], wholes: {} };
  return <EmbedQuestionList subject={subject} topic={t} initial={parts.slice(0, 20)} total={parts.length} />;
}
