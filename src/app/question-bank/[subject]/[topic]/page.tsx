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

/** Google shows about 60 characters of a title, and AQA's topic names can run to 70 on their own. */
const TITLE_MAX = 60;

/** A topic name cut at a word to fit `room` characters, with an ellipsis when it had to be cut. */
function fitTopic(name: string, room: number) {
  if (name.length <= room) return name;
  const cut = name.slice(0, room - 1).replace(/[\s,;:–-]+\S*$/, "")
    .replace(/(?:[\s,;:–-]+(?:and|or|of|the|a|an|to|for|by|in|on|as|is|are|its|their|both))+$/i, "");   // never end on "and…"
  return `${cut}…`;
}

/**
 * The topic page's title: the longest of these that fits. The topic is what people search for, so it
 * keeps its full name for as long as anything else can give way: "| Plumi", then "Exam", then
 * "Questions". Only a topic too long to fit beside its course (AQA's longer statements) is cut.
 */
function topicTitle(topic: string, board: string, level: string, subject: string) {
  const course = `${board} ${level} ${subject}`;
  for (const title of [`${topic}: ${course} Exam Questions | Plumi`, `${topic}: ${course} Exam Questions`, `${topic}: ${course} Questions`, `${topic}: ${course}`]) {
    if (title.length <= TITLE_MAX) return title;
  }
  return `${fitTopic(topic, TITLE_MAX - course.length - 2)}: ${course}`;
}

/** Under about 160 characters: "Free." goes first, then the year range, then a very long topic name is cut. */
function topicDescription(count: number, board: string, level: string, subject: string, topic: string, years: string) {
  const base = (t: string, y: string) => `All ${count} ${board} ${level} ${subject} exam questions on ${t}${y}, each with its mark scheme and examiner's report.`;
  for (const d of [`${base(topic, `, ${years}`)} Free.`, base(topic, `, ${years}`), base(topic, "")]) if (d.length <= 160) return d;
  return base(fitTopic(topic, topic.length - (base(topic, "").length - 160)), "");
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const found = await resolve(params);
  if (!found) return {};
  const { s, t } = found;
  return pastPaperMetadata(bankTopicPath(s.slug, t.slug), {
    // A topic with a hand-written short name (GCSE's longer ones) uses it rather than a cut-off title.
    title: topicTitle(t.short ?? t.title, s.board, s.level, s.subject),
    description: topicDescription(t.count, s.board, s.level, s.subject, t.title, `${s.firstYear}–${s.lastYear}`),
  }, `/og-${s.subject.toLowerCase()}.png`);
}

export default async function Page({ params }: { params: Params }) {
  const found = await resolve(params);
  if (!found) notFound();
  const parts = topicParts(found.s.slug, found.t.code);
  return <BankTopicPage subject={found.s} topic={found.t} parts={parts.slice(0, 20)} index={parts} />;
}
