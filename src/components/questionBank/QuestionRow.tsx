"use client";

import Link from "next/link";
import { useState } from "react";
import { track } from "@/lib/analytics";
import {
  bankDataPath, bankTopicPath, paperName, papersBase, partImage, questionKey, questionOf, reportKey, seriesLabel, topicName,
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
 *
 * `parts` is one part, or, in the whole-question view, every part of a question in
 * order: then its start is shown open above them, the marks are the question's, and
 * the scheme unfolds part by part.
 */
export function QuestionRow({ n, parts, subject, inSet, setFull, onToggleSet, onTopic }: {
  n: number; parts: BankPart[]; subject: BankSubject; inSet: boolean; setFull?: boolean; onToggleSet: () => void; onTopic?: (code: string) => void;
}) {
  const [open, setOpen] = useState<{ ms?: boolean; er?: boolean; stem?: boolean }>({});
  const [report, setReport] = useState<string | null>(null);
  const part = parts[0];
  const many = parts.length > 1;
  const q = questionOf(part.l);
  const shown = many ? q : part.l;
  const label = `${seriesLabel(subject, part.s)} ${paperName(subject, part.p)}, question ${shown}`;
  const whole = subject.wholes[`${part.p}-${part.s}`];
  const marked = parts.filter(p => p.m != null);
  const marks = marked.length ? marked.reduce((sum, p) => sum + (p.m ?? 0), 0) : null;
  const topics = [...new Set(parts.flatMap(p => p.t))].slice(0, many ? 3 : 2);
  const withScheme = parts.filter(p => p.ms || p.k);
  const schemePdf = !withScheme.length ? parts.find(p => p.msf)?.msf : undefined;
  const stem = parts.find(p => p.st);
  const stemOpen = open.stem || many;

  function flip(key: "ms" | "er" | "stem") {
    const next = !open[key];
    setOpen(o => ({ ...o, [key]: next }));
    if (next && key !== "stem") track("bank_reveal", { subject: subject.slug, kind: key, part: many ? questionKey(part) : part.id });
    if (key === "er" && next && report === null) reportsFor(subject.slug).then(r => setReport(r[reportKey(subject, part.id)] ?? ""));
  }

  return (
    <li className={`qb-row${inSet ? " is-in-set" : ""}`} aria-label={label}>
      <div className="qb-left">
        <span className="qb-num" aria-hidden="true">{n}</span>
        <p className="qb-q">Q{shown}</p>
        <p className="qb-meta">{seriesLabel(subject, part.s)} · {paperName(subject, part.p)}</p>
        <div className="qb-tags">
          {marks != null && <span className="qb-marks">{marks} {marks === 1 ? "mark" : "marks"}</span>}
          {topics.map(code => {
            const topic = subject.topics.find(t => t.code === code);
            if (!topic) return null;
            // In the bank a topic filters in place, keeping your place; elsewhere it's the topic's page.
            return onTopic
              ? <button key={code} type="button" className="qb-topic" title={`Only ${topicName(topic)}`} onClick={() => onTopic(code)}>{topicName(topic)}</button>
              : <Link key={code} className="qb-topic" href={bankTopicPath(subject.slug, topic.slug)}>{topicName(topic)}</Link>;
          })}
        </div>
        <div className="qb-keys">
          {withScheme.length > 0 && (
            <button type="button" className={`qb-key${open.ms ? " is-open" : ""}`} aria-expanded={!!open.ms} onClick={() => flip("ms")}>{!many && part.k ? "Answer" : "Mark scheme"}</button>
          )}
          {schemePdf && (
            <a className="qb-key" href={`${papersBase}/${schemePdf}`} target="_blank" rel="noopener">Mark scheme (PDF)</a>
          )}
          <button type="button" className={`qb-key qb-add${inSet ? " is-on" : ""}`} aria-pressed={inSet} onClick={onToggleSet} disabled={!inSet && setFull}>
            {inSet ? "✓ In your set" : setFull ? "Set full" : "+ Add to set"}
          </button>
        </div>
        {whole?.qp && <a className="qb-wholelink" href={`${papersBase}/${whole.qp}`} target="_blank" rel="noopener">The whole paper ↗</a>}
      </div>

      <div className="qb-sheet">
        {inSet && <span className="qb-stamp" aria-hidden="true">In your set</span>}
        {stem && (
          <div className="qb-stem">
            {!many && (
              <button type="button" className="qb-link" aria-expanded={!!open.stem} onClick={() => flip("stem")}>
                {open.stem ? "− Hide" : "+ Show"} how question {q} starts
              </button>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {stemOpen && <img className="qb-img" src={partImage(stem.id, "stem", subject.cropVersion)} alt={`The start of question ${q}`} loading="lazy" />}
          </div>
        )}
        <div className="qb-paper">
          {parts.map(p => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p.id} className="qb-img" src={partImage(p.id, "qp", subject.cropVersion)} width={p.w} height={p.h} loading="lazy" decoding="async"
              alt={`${seriesLabel(subject, p.s)} ${paperName(subject, p.p)}, question ${p.l}: ${p.x}`} />
          ))}
        </div>
        <p className="qb-swipe" aria-hidden="true">Swipe the paper sideways to read it all.</p>
        {open.ms && withScheme.map(p => p.k
          ? <p key={p.id} className="qb-note qb-answer">{many ? <>{p.l}: the answer is </> : "The answer is "}<strong>{p.k}</strong></p>
          : (
            <div key={p.id} className="qb-note qb-reveal-ms">
              <span className="lp-tape" aria-hidden="true" />
              <p className="qb-note-label">Mark scheme for {p.l}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="qb-scroll"><img className="qb-img" src={partImage(p.id, "ms", subject.cropVersion)} alt={`Mark scheme for ${seriesLabel(subject, p.s)} ${paperName(subject, p.p)}, question ${p.l}`} loading="lazy" /></div>
            </div>
          ))}
      </div>

      <div className="qb-right">
        {parts.some(p => p.er) && (
          <button type="button" className={`qb-key${open.er ? " is-open" : ""}`} aria-expanded={!!open.er} onClick={() => flip("er")}>Examiner’s report</button>
        )}
        {open.er && (
          <div className="qb-note qb-reveal-er">
            {report === null ? <p>Opening…</p> : !report ? <p>No report for this question.</p> : (() => {
              const { mine, rest } = splitReport(report, shown);
              return <>
                {mine.length > 0 && <><p className="qb-note-label">The examiners on {shown}</p><ReportText paras={mine} /></>}
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
