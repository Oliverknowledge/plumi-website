"use client";

import { useEffect, useState, type CSSProperties } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import "./WorkedSolution.css";

/**
 * A worked solution, set out the way MadAsMaths writes theirs (madasmaths.com, the IYGB
 * practice paper solutions): one sheet of squared paper per question, everything in blue
 * ink (the words in the site's handwriting, the maths typeset); the question's title across the top; a) b) in the margin;
 * each stage under a heading in capitals, underlined in coloured marker; the working
 * down the page on ⇒ arrows or lined-up = signs; small capital notes under a line; the
 * answer after ∴, underlined in highlighter and closed with //.
 *
 * The solution data (public/question-bank/<slug>/solutions/<id>.json, checked by
 * scripts/question-bank/solutions/check_solutions.py) also carries the board's marks for
 * each line; MadAsMaths' sheets have none, so they aren't drawn. Loaded only when a
 * student opens it (QuestionRow), with KaTeX, so the bank's pages carry none of this.
 */

interface Step { tex?: string; text?: string; why?: string; marks?: string[] }
interface Part { label: string; ask?: string; method: string; steps: Step[]; answer?: string; answerText?: string; answerMarks?: string[] }
interface Solution { id: string; q: string; m: number; parts: Part[] }

const solutions: Record<string, Promise<Solution | null>> = {};
export const solutionPath = (slug: string, id: string) => `/question-bank/${slug}/solutions/${id}.json`;
function solutionFor(slug: string, id: string) {
  solutions[`${slug}/${id}`] ??= fetch(solutionPath(slug, id)).then(r => (r.ok ? r.json() : null)).catch(() => null);
  return solutions[`${slug}/${id}`];
}

/** Each sheet's headings are underlined in one marker colour, as MadAsMaths' pages are: it changes from question to question. */
const MARKERS = ["#f28b1e", "#e3262d", "#1fae55", "#2b6fd6"];

function mathHtml(tex: string, display = false) {
  return katex.renderToString(display ? `\\displaystyle ${tex}` : tex, { throwOnError: false, output: "htmlAndMathml" });
}

function Maths({ tex }: { tex: string }) {
  return <span dangerouslySetInnerHTML={{ __html: mathHtml(tex, true) }} />;
}

/** Prose with inline \( ... \) maths. */
function Prose({ text }: { text: string }) {
  const bits = text.split(/\\\((.+?)\\\)/);
  return <>{bits.map((b, i) => (i % 2 ? <span key={i} dangerouslySetInnerHTML={{ __html: mathHtml(b) }} /> : b))}</>;
}

const RELATIONS = ["=", "\\Rightarrow", "\\approx", "\\equiv", "\\leq", "\\geq", "<", ">"];

/**
 * A line of working split at its first relation outside braces, "f'(x)" | "= 1 + …", so the
 * lines of a part line up on their = signs, as MadAsMaths' do. A line that carries on
 * ("= …") has nothing on the left. A long left side isn't split: it would push
 * every other line across.
 */
function splitAtRelation(tex: string): [string, string] | null {
  let depth = 0;
  for (let i = 0; i < tex.length; i++) {
    const c = tex[i];
    if (c === "\\" && (tex[i + 1] === "{" || tex[i + 1] === "}")) { i++; continue; }
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (depth === 0) {
      const rel = RELATIONS.find(r => tex.startsWith(r, i) && !(r[0] === "\\" && /[a-zA-Z]/.test(tex[i + r.length] ?? "")));
      if (!rel) continue;
      const left = tex.slice(0, i).trim();
      const seen = left.replace(/\\[a-zA-Z]+|[{}\s]/g, "");
      return seen.length > 12 || /\\text\b/.test(left) ? null : [left, tex.slice(i).trim()];
    }
  }
  return null;
}

/**
 * A line of working. Only a chain lines up, as MadAsMaths writes it: a line that the next
 * carries on with "= …" (`chain`) is split at its =, and the "= …" lines sit under it. Every
 * other line, ⇒ lines included, starts at the left of the working.
 */
function Working({ tex, chain }: { tex: string; chain: boolean }) {
  const carries = /^\s*=/.test(tex);
  const split = carries ? ["", tex.trim()] as [string, string] : chain ? splitAtRelation(tex) : null;
  if (!split) return <span className="qb-sol-w"><Maths tex={tex} /></span>;
  return <>
    <span className="qb-sol-l">{split[0] && <Maths tex={split[0]} />}</span>
    <span className="qb-sol-r"><Maths tex={`{}${split[1]}`} /></span>
  </>;
}

/** A part's letter as written in the margin: "a)", "ii)", "b(i)". */
const marginLabel = (label: string) => (label.includes("(") ? label : `${label})`);

/** The answer, after ∴ unless the working already leads into it with ⇒ or "So". */
function Answer({ part }: { part: Part }) {
  const tex = part.answer;
  const leads = tex ? /^\s*\\Rightarrow/.test(tex) : /^(so|thus|therefore|hence)\b/i.test(part.answerText ?? "");
  return (
    <p className="qb-sol-answer">
      <span className="qb-sol-sr">Answer: </span>
      {!leads && <span className="qb-sol-therefore" aria-hidden="true">∴ </span>}
      <span className="qb-sol-hl">{tex ? <Maths tex={tex} /> : <Prose text={part.answerText ?? ""} />}</span>
      <span className="qb-sol-done" aria-hidden="true">{"//"}</span>
    </p>
  );
}

export function WorkedSolution({ slug, id, question, title }: { slug: string; id: string; question: string; title: string }) {
  const [solution, setSolution] = useState<Solution | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    solutionFor(slug, id).then(s => { if (live) setSolution(s); });
    return () => { live = false; };
  }, [slug, id]);

  const headingId = `sol-${id}`;
  if (solution === undefined) return <div className="qb-sol" aria-busy="true"><p className="qb-sol-hint">Opening the worked solution…</p></div>;
  if (solution === null) return <div className="qb-sol"><p className="qb-sol-hint">The worked solution didn’t load. Try again in a moment.</p></div>;

  const marker = MARKERS[(parseInt(question, 10) || 0) % MARKERS.length];
  return (
    <section className="qb-sol" aria-labelledby={headingId} style={{ "--qb-sol-marker": marker } as CSSProperties}>
      <div className="qb-sol-sheet">
        <p className="qb-sol-page" aria-hidden="true">– 1 –</p>
        <h3 id={headingId} className="qb-sol-title">
          <span className="qb-sol-sr">Worked solution: </span>{title} – Question {question}
        </h3>
        {solution.parts.map((part, p) => (
          <section key={part.label || p} className="qb-sol-part" aria-labelledby={`${headingId}-${p}`}>
            <h4 id={`${headingId}-${p}`} className="qb-sol-head">
              {part.label && <span className="qb-sol-label" aria-hidden="true">{marginLabel(part.label)}</span>}
              {part.label && <span className="qb-sol-sr">Part ({part.label}): </span>}
              <span className="qb-sol-stage"><Prose text={part.method} /></span>
            </h4>
            <div className="qb-sol-steps">
              {part.steps.map((s, i) => (
                <div key={i} className="qb-sol-item">
                  {s.tex ? <Working tex={s.tex} chain={/^\s*=/.test(part.steps[i + 1]?.tex ?? "")} /> : <p className="qb-sol-text"><Prose text={s.text ?? ""} /></p>}
                  {s.why && <p className="qb-sol-why"><Prose text={s.why} /></p>}
                </div>
              ))}
            </div>
            <Answer part={part} />
          </section>
        ))}
      </div>
    </section>
  );
}
