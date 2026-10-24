"use client";

import Link from "next/link";
import { useState } from "react";
import { track } from "@/lib/analytics";
import {
  bankDataPath, bankTopicPath, paperName, papersBase, partImage, questionOf, reportKey, seriesLabel, topicName,
  type BankPart, type BankSubject,
} from "@/content/questionBank";

/** Examiner's reports for a subject, fetched once the first time anyone opens one. */
const reports: Record<string, Promise<Record<string, string>>> = {};
function reportsFor(slug: string) {
  reports[slug] ??= fetch(bankDataPath(slug, "reports")).then(r => r.json()).catch(() => ({}));
  return reports[slug];
}

/**
 * An examiner's report covers a whole question. Put the paragraphs that name this
 * part ("01.4", "In 01.4…") first, and the rest under a quieter label; turn the
 * report's typed bullets into a list. Pearson's science reports head each part's
 * comments ("Question 3(b)(i)"): everything under this part's heading is its own.
 */
function splitReport(report: string, label: string) {
  const paras = report.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  if (label === questionOf(label)) return { mine: [], rest: paras.filter(p => !/^Question \d\S*$/.test(p)) };
  const names = (p: string) => new RegExp(`(^|[^\\d])${label.replace(/[.()]/g, m => `\\${m}`)}(?![\\d(])`).test(p);
  const mine: string[] = [];
  const rest: string[] = [];
  let under: boolean | null = null;
  for (const p of paras) {
    const head = p.match(/^Question (\S+)$/);
    if (head) {
      under = head[1] === label;
      if (!under) rest.push(p); // the other parts keep their headings
      continue;
    }
    (under ?? names(p) ? mine : rest).push(p);
  }
  return { mine, rest };
}

function ReportText({ paras }: { paras: string[] }) {
  return <>{paras.map((para, i) => {
    const bullets = para.split(/\s*[•]\s*/).map(b => b.trim()).filter(Boolean);
    return bullets.length > 1 && /[•]/.test(para)
      ? <ul key={i}>{bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>
      : <p key={i}>{para}</p>;
  })}</>;
}

/**
 * One question in the bank, laid out like a page of the real paper: its number and
 * details in the left margin, the printed question on the paper itself, and the
 * examiner's report as a note in the right margin. The mark scheme unfolds on the
 * paper, under the question. On a phone the margins fold above and below.
 */
export function QuestionRow({ n, part, subject, inSet, onToggleSet, onTopic }: {
  n: number; part: BankPart; subject: BankSubject; inSet: boolean; onToggleSet: () => void; onTopic?: (code: string) => void;
}) {
  const [open, setOpen] = useState<{ ms?: boolean; er?: boolean; stem?: boolean }>({});
  const [report, setReport] = useState<string | null>(null);
  const q = questionOf(part.l);
  const label = `${seriesLabel(subject, part.s)} ${paperName(subject, part.p)}, question ${part.l}`;
  const whole = subject.wholes[`${part.p}-${part.s}`];

  function flip(key: "ms" | "er" | "stem") {
    const next = !open[key];
    setOpen(o => ({ ...o, [key]: next }));
    if (next && key !== "stem") track("bank_reveal", { subject: subject.slug, kind: key, part: part.id });
    if (key === "er" && next && report === null) reportsFor(subject.slug).then(r => setReport(r[reportKey(subject, part.id)] ?? ""));
  }

  return (
    <li className={`qb-row${inSet ? " is-in-set" : ""}`} aria-label={label}>
      <div className="qb-left">
        <span className="qb-num" aria-hidden="true">{n}</span>
        <p className="qb-q">Q{part.l}</p>
        <p className="qb-meta">{seriesLabel(subject, part.s)} · {paperName(subject, part.p)}</p>
        <div className="qb-tags">
          {part.m != null && <span className="qb-marks">{part.m} {part.m === 1 ? "mark" : "marks"}</span>}
          {part.t.slice(0, 2).map(code => {
            const topic = subject.topics.find(t => t.code === code);
            if (!topic) return null;
            // In the bank a topic filters in place, keeping your place; elsewhere it's the topic's page.
            return onTopic
              ? <button key={code} type="button" className="qb-topic" title={`Only ${topicName(topic)}`} onClick={() => onTopic(code)}>{topicName(topic)}</button>
              : <Link key={code} className="qb-topic" href={bankTopicPath(subject.slug, topic.slug)}>{topicName(topic)}</Link>;
          })}
        </div>
        <div className="qb-keys">
          {(part.ms || part.k) && (
            <button type="button" className={`qb-key${open.ms ? " is-open" : ""}`} aria-expanded={!!open.ms} onClick={() => flip("ms")}>{part.k ? "Answer" : "Mark scheme"}</button>
          )}
          {part.msf && !part.ms && !part.k && (
            <a className="qb-key" href={`${papersBase}/${part.msf}`} target="_blank" rel="noopener">Mark scheme (PDF)</a>
          )}
          <button type="button" className={`qb-key qb-add${inSet ? " is-on" : ""}`} aria-pressed={inSet} onClick={onToggleSet}>
            {inSet ? "✓ In your set" : "+ Add to set"}
          </button>
        </div>
        {whole?.qp && <a className="qb-wholelink" href={`${papersBase}/${whole.qp}`} target="_blank" rel="noopener">The whole paper ↗</a>}
      </div>

      <div className="qb-sheet">
        {inSet && <span className="qb-stamp" aria-hidden="true">In your set</span>}
        {part.st && (
          <div className="qb-stem">
            <button type="button" className="qb-link" aria-expanded={!!open.stem} onClick={() => flip("stem")}>
              {open.stem ? "− Hide" : "+ Show"} how question {q} starts
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {open.stem && <img className="qb-img" src={partImage(part.id, "stem")} alt={`The start of question ${q}`} loading="lazy" />}
          </div>
        )}
        <div className="qb-paper">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="qb-img" src={partImage(part.id, "qp")} width={part.w} height={part.h} loading="lazy" decoding="async" alt={`${label}: ${part.x}`} />
        </div>
        <p className="qb-swipe" aria-hidden="true">Swipe the paper sideways to read it all.</p>
        {open.ms && part.k && <p className="qb-note qb-answer">The answer is <strong>{part.k}</strong></p>}
        {open.ms && part.ms && (
          <div className="qb-note qb-reveal-ms">
            <span className="lp-tape" aria-hidden="true" />
            <p className="qb-note-label">Mark scheme for {part.l}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div className="qb-scroll"><img className="qb-img" src={partImage(part.id, "ms")} alt={`Mark scheme for ${label}`} loading="lazy" /></div>
          </div>
        )}
      </div>

      <div className="qb-right">
        {part.er && (
          <button type="button" className={`qb-key${open.er ? " is-open" : ""}`} aria-expanded={!!open.er} onClick={() => flip("er")}>Examiner’s report</button>
        )}
        {open.er && (
          <div className="qb-note qb-reveal-er">
            {report === null ? <p>Opening…</p> : !report ? <p>No report for this question.</p> : (() => {
              const { mine, rest } = splitReport(report, part.l);
              return <>
                {mine.length > 0 && <><p className="qb-note-label">The examiners on {part.l}</p><ReportText paras={mine} /></>}
                {rest.length > 0 && (
                  <details className="qb-er-more" open={!mine.length}>
                    <summary className="qb-note-label">{mine.length ? `The rest of question ${q}` : `The examiners on question ${q}`}</summary>
                    <ReportText paras={rest} />
                  </details>
                )}
              </>;
            })()}
          </div>
        )}
      </div>
    </li>
  );
}
