"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";
import { track } from "@/lib/analytics";
import { AgainTag, ChoicePick, MarginScore, SelfMark } from "./SelfMark";
import { openZoom } from "./ZoomViewer";
import { AnswerBox } from "./AnswerBox";
import { isEssaySubject } from "@/lib/markBands";
import {
  bankDataPath, bankTopicPath, paperName, papersBase, partImage, questionKey, questionOf, reportKey, seriesLabel, topicName,
  type BankPart, type BankSubject,
} from "@/content/questionBank";

/** A worked solution and KaTeX load only when a student opens one. */
const WorkedSolution = dynamic(() => import("./WorkedSolution").then(m => m.WorkedSolution), {
  ssr: false,
  loading: () => <p className="qb-note-label">Opening the worked solution…</p>,
});

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
 *
 * `before` is a single part's earlier parts, if any: "Show question 5 so far" opens the question's start and
 * those parts above it, as a later part can rest on what an earlier one gave (a mass, a table, a graph).
 *
 * `embed` is the partner iframe's version of the same row (EmbedQuestionList): no
 * set, nothing that navigates inside the frame, and `embed.cta` under the paper.
 */
export function QuestionRow({ n, parts, subject, inSet, setFull, onToggleSet, onTopic, before = [], embed }: {
  n: number; parts: BankPart[]; subject: BankSubject; inSet: boolean; setFull?: boolean; onToggleSet: () => void; onTopic?: (code: string) => void;
  before?: BankPart[];
  embed?: { cta: ReactNode };
}) {
  const [open, setOpen] = useState<{ ms?: boolean; sol?: boolean; er?: boolean; stem?: boolean }>({});
  const [report, setReport] = useState<string | null>(null);
  const part = parts[0];
  const many = parts.length > 1;
  const q = questionOf(part.l);
  const shown = many ? q : part.l;
  const label = `${seriesLabel(subject, part.s)} ${paperName(subject, part.p)}, question ${shown}`;
  const whole = subject.wholes[`${part.p}-${part.s}`];
  // A question on the paper's sources (English Language) is read with them open: they're printed in the insert.
  const insert = whole?.ins && parts.some(p => /\bsources?\b|\bextract\b|\blines? \d/i.test(p.x)) ? whole.ins : undefined;
  // An essay choice, "EITHER (d) OR (e)", counts once. A question that is itself the
  // alternative (AQA Sociology's Topic A2, Economics' Context 2, English Literature's Romeo and Juliet or Macbeth) still shows its marks.
  const marked = parts.filter(p => p.m != null && !(p.or && parts.some(o => !o.or)));
  const marks = marked.length ? marked.reduce((sum, p) => sum + (p.m ?? 0), 0) : null;
  const topics = [...new Set(parts.flatMap(p => p.t))].slice(0, many ? 3 : 2);
  const withScheme = parts.filter(p => p.ms || p.k);
  const withSolution = parts.filter(p => p.sol);
  const inWhole = withScheme.filter(p => p.msq).map(p => p.l);
  const inWholeNames = inWhole.length > 1 ? `${inWhole.slice(0, -1).join(", ")} and ${inWhole[inWhole.length - 1]}` : inWhole[0];
  // Parts with no crop of their own keep the PDF, beside the others' schemes when a question has both.
  const pdfOnly = parts.filter(p => p.msf && !p.ms && !p.k);
  const schemePdf = pdfOnly[0]?.msf;
  const stem = parts.find(p => p.st);
  const stemOpen = open.stem || many;
  const earlier = many ? [] : before;

  /**
   * A question or scheme picture that opens full screen to read (ZoomViewer). In the partner
   * embed there's no viewer, so it stays a plain picture.
   */
  const zoomable = (p: BankPart, kind: "qp" | "ms", img: ReactNode) => embed ? img : (
    <button key={`${p.id}-${kind}-zoom`} type="button" className={`qb-zoomable is-${kind}`} aria-label={`Zoom into ${kind === "ms" ? "the mark scheme for" : "question"} ${p.l}`}
      onClick={() => openZoom({ subject, parts, index: Math.max(0, parts.indexOf(p)), kind })}>
      {img}
    </button>
  );

  function flip(key: "ms" | "sol" | "er" | "stem") {
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
        {!embed && <MarginScore subject={subject.slug} parts={parts} />}
        {!embed && <AgainTag subject={subject.slug} parts={parts} />}
        <div className="qb-tags">
          {marks != null && <span className="qb-marks">{marks} {marks === 1 ? "mark" : "marks"}</span>}
          {topics.map(code => {
            const topic = subject.topics.find(t => t.code === code);
            if (!topic) return null;
            // In the bank a topic filters in place, keeping your place; elsewhere it's the topic's page.
            if (embed) return <span key={code} className="qb-topic">{topicName(topic)}</span>;
            return onTopic
              ? <button key={code} type="button" className="qb-topic" title={`Only ${topicName(topic)}`} onClick={() => onTopic(code)}>{topicName(topic)}</button>
              : <Link key={code} className="qb-topic" href={bankTopicPath(subject.slug, topic.slug)}>{topicName(topic)}</Link>;
          })}
        </div>
        <div className="qb-keys">
          {withScheme.length > 0 && (
            <button type="button" className={`qb-key${open.ms ? " is-open" : ""}`} aria-expanded={!!open.ms} onClick={() => flip("ms")}>{!many && part.k ? "Answer" : "Mark scheme"}</button>
          )}
          {withSolution.length > 0 && (
            <button type="button" className={`qb-key${open.sol ? " is-open" : ""}`} aria-expanded={!!open.sol} onClick={() => flip("sol")}>Worked solution</button>
          )}
          {schemePdf && (
            <a className="qb-key" href={`${papersBase}/${schemePdf}`} target="_blank" rel="noopener">Mark scheme (PDF)</a>
          )}
          {!withScheme.length && !schemePdf && <span className="qb-noms">No published mark scheme</span>}
          {insert && (
            <a className="qb-key" href={`${papersBase}/${insert}`} target="_blank" rel="noopener" title={`The sources for ${seriesLabel(subject, part.s)} ${paperName(subject, part.p)}`}>Sources (insert) ↗</a>
          )}
          {!embed && (
            <button type="button" className={`qb-key qb-add${inSet ? " is-on" : ""}`} aria-pressed={inSet} onClick={onToggleSet} disabled={!inSet && setFull}>
              {inSet ? "✓ In your set" : setFull ? "Set full" : "+ Add to set"}
            </button>
          )}
        </div>
        {!embed && whole?.qp && <a className="qb-wholelink" href={`${papersBase}/${whole.qp}`} target="_blank" rel="noopener">The whole paper ↗</a>}
        {!embed && whole?.code && <a className="qb-wholelink" href={`${papersBase}/${whole.code}`} download>The code files (zip) ↓</a>}
      </div>

      <div className="qb-sheet">
        {inSet && <span className="qb-stamp" aria-hidden="true">In your set</span>}
        {(stem || earlier.length > 0) && (
          <div className="qb-stem">
            {!many && (
              <button type="button" className="qb-link" aria-expanded={!!open.stem} onClick={() => flip("stem")}>
                {/* (History's stem is the sources and interpretations the question is set on) */}
                {open.stem ? "− Hide" : "+ Show"} {earlier.length ? `question ${q} so far` : subject.subject === "History" ? `the sources for question ${q}` : `how question ${q} starts`}
              </button>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {stem && stemOpen && <img className="qb-img" src={partImage(stem.id, "stem", subject.cropVersion)} alt={`The start of question ${q}`} loading="lazy" />}
            {stemOpen && earlier.map(p => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} className="qb-img" src={partImage(p.id, "qp", subject.cropVersion)} width={p.w} height={p.h} loading="lazy" decoding="async"
                alt={`Question ${p.l}: ${p.x}`} />
            ))}
          </div>
        )}
        <div className="qb-paper">
          {parts.map(p => [
            many && p.or ? <p key={`${p.id}-or`} className="qb-or">OR</p> : null,
            zoomable(p, "qp",
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} className="qb-img" src={partImage(p.id, "qp", subject.cropVersion)} width={p.w} height={p.h} loading="lazy" decoding="async"
                alt={`${seriesLabel(subject, p.s)} ${paperName(subject, p.p)}, question ${p.l}: ${p.x}`} />),
            // Multiple choice marks itself from the letter picked, before the key is shown.
            !embed && p.k && /^[A-D]( or [A-D])*$/.test(p.k) ? <ChoicePick key={`${p.id}-pick`} subject={subject.slug} part={p} /> : null,
            // Anything else can be answered in writing first, then checked against the scheme:
            // under each part when a question shows in parts, under the whole (after the zoom hint) otherwise.
            !embed && !p.k && many ? <AnswerBox key={`${p.id}-answer`} subject={subject.slug} part={p} open={isEssaySubject(subject)} many={many}
              schemeOpen={!!open.ms} onCheck={withScheme.length ? () => flip("ms") : undefined} /> : null,
          ])}
        </div>
        {!embed && <p className="qb-swipe" aria-hidden="true">Tap the question to read it full screen.</p>}
        {!embed && !many && !part.k && (
          <AnswerBox subject={subject.slug} part={part} open={isEssaySubject(subject)} schemeOpen={!!open.ms} onCheck={withScheme.length ? () => flip("ms") : undefined} />
        )}
        {embed?.cta}
        {open.ms && withScheme.map((p, i) => p.k
          ? <p key={p.id} className="qb-note qb-answer">{many ? <>{p.l}: the answer is </> : "The answer is "}<strong>{p.k}</strong></p>
          // A whole question's scheme (`msq`) serves each of its parts: shown once, marked against part by part.
          : p.msq && withScheme.slice(0, i).some(o => o.msq) ? (!embed && <SelfMark key={p.id} subject={subject.slug} part={p} many={many} />)
          : (
            <div key={p.id} className="qb-note qb-reveal-ms">
              <span className="lp-tape" aria-hidden="true" />
              <p className="qb-note-label">{p.msq ? <>Mark scheme for question {questionOf(p.l)}: find {inWholeNames} in it</> : <>Mark scheme for {p.l}</>}</p>
              <div className="qb-scroll">{zoomable(p, "ms",
                // eslint-disable-next-line @next/next/no-img-element
                <img className="qb-img" src={partImage(p.id, "ms", subject.cropVersion)} alt={`Mark scheme for ${seriesLabel(subject, p.s)} ${paperName(subject, p.p)}, question ${p.l}`} loading="lazy" />)}</div>
              {!embed && <SelfMark subject={subject.slug} part={p} many={many} />}
            </div>
          ))}
        {open.sol && withSolution.map(p => <WorkedSolution key={`${p.id}-sol`} slug={subject.slug} id={p.id} question={p.l} />)}
        {/* Only the whole scheme as a PDF: mark yourself against it here, without opening anything first. */}
        {!embed && pdfOnly.map(p => <SelfMark key={`${p.id}-self`} subject={subject.slug} part={p} many={many} />)}
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
