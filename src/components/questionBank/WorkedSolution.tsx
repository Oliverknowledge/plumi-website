"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import "./WorkedSolution.css";

/**
 * A worked solution, written out line by line in the spirit of MadAsMaths and tied to
 * the board's own marks (public/question-bank/<slug>/solutions/<id>.json, checked by
 * scripts/question-bank/solutions/check_solutions.py). Loaded only when a student opens
 * it (QuestionRow), with KaTeX, so the bank's pages carry none of this until then.
 *
 * It opens one step at a time: each part shows its method, then "Next step" reveals the
 * working a line at a time, then the answer. "Show every step" lays the whole solution
 * out at once.
 */

/** A step is a line of working (`tex`), a sentence (`text`), or a stage heading (`head`), as MadAsMaths heads each stage of a part. */
interface Step { tex?: string; text?: string; head?: string; why?: string; marks?: string[] }
interface Part { label: string; ask?: string; method: string; steps: Step[]; answer?: string; answerText?: string; answerMarks?: string[] }
interface Solution { id: string; q: string; m: number; parts: Part[] }

const solutions: Record<string, Promise<Solution | null>> = {};
export const solutionPath = (slug: string, id: string) => `/question-bank/${slug}/solutions/${id}.json`;
function solutionFor(slug: string, id: string) {
  solutions[`${slug}/${id}`] ??= fetch(solutionPath(slug, id)).then(r => (r.ok ? r.json() : null)).catch(() => null);
  return solutions[`${slug}/${id}`];
}

/** KaTeX's HTML for one piece of maths. A line of working is set full size but may still wrap after = or +. */
function mathHtml(tex: string, display = false) {
  return katex.renderToString(display ? `\\displaystyle ${tex}` : tex, { throwOnError: false, output: "htmlAndMathml" });
}

function Maths({ tex, className }: { tex: string; className?: string }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: mathHtml(tex, true) }} />;
}

/** Prose with inline \( ... \) maths. */
function Prose({ text }: { text: string }) {
  const bits = text.split(/\\\((.+?)\\\)/);
  return <>{bits.map((b, i) => (i % 2 ? <span key={i} dangerouslySetInnerHTML={{ __html: mathHtml(b) }} /> : b))}</>;
}

const RELATIONS = ["=", "\\Rightarrow", "\\approx", "\\equiv", "\\leq", "\\geq", "<", ">"];

/**
 * A line of working split at its first relation outside braces, "f'(x)" | "= 1 + …", so the
 * lines of a part line up on their = signs as they would by hand. A line that carries on
 * ("= …", "⇒ …") has nothing on the left. A long left side isn't split: it would push
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

/** A part's letter as written in the margin: "a)", "(ii)", "b(i)". */
const marginLabel = (label: string) => (/^[ivx]+$/.test(label) ? `(${label})` : label.includes("(") ? label : `${label})`);

/**
 * A line of working. Only a chain lines up, as MadAsMaths writes it: a line that the next
 * carries on with "= …" (`chain`) is split at its =, and the "= …" lines sit under it. Every
 * other line, ⇒ lines included, starts at the left of the working.
 */
function Working({ tex, chain }: { tex: string; chain: boolean }) {
  const split = /^\s*=/.test(tex) ? ["", tex.trim()] as [string, string] : chain ? splitAtRelation(tex) : null;
  if (!split) return <span className="qb-sol-w"><Maths tex={tex} /></span>;
  return <>
    <span className="qb-sol-l">{split[0] && <Maths tex={split[0]} />}</span>
    <span className="qb-sol-r"><Maths tex={`{}${split[1]}`} /></span>
  </>;
}

function Marks({ marks }: { marks?: string[] }) {
  if (!marks?.length) return null;
  return (
    <span className="qb-sol-marks">
      {marks.map((m, i) => <span key={i} className="qb-sol-mk" aria-label={`earns ${m}`}>{m}</span>)}
    </span>
  );
}

/** The things a part reveals in turn: its working, then its answer. */
function partItems(part: Part) {
  const items: { key: string; node: ReactNode; kind: "step" | "answer" }[] = part.steps.map((s, i) => ({
    key: `s${i}`, kind: "step",
    node: s.head ? <p className="qb-sol-method is-stage"><Prose text={s.head} /></p> : (
      <>
        <div className="qb-sol-line">
          {s.tex ? <Working tex={s.tex} chain={/^\s*=/.test((i + 1 < part.steps.length ? part.steps[i + 1].tex : part.answer) ?? "")} /> : <p className="qb-sol-text"><Prose text={s.text ?? ""} /></p>}
          <Marks marks={s.marks} />
        </div>
        {s.why && <p className="qb-sol-why"><Prose text={s.why} /></p>}
      </>
    ),
  }));
  items.push({
    key: "answer", kind: "answer",
    node: (
      <div className="qb-sol-line">
        <p className="qb-sol-answer">
          <span className="qb-sol-sr">Answer: </span>
          {part.answer ? <Maths tex={part.answer} /> : <Prose text={part.answerText ?? ""} />}
        </p>
        <Marks marks={part.answerMarks} />
      </div>
    ),
  });
  return items;
}

export function WorkedSolution({ slug, id, question }: { slug: string; id: string; question: string }) {
  const [solution, setSolution] = useState<Solution | null | undefined>(undefined);
  const [stepwise, setStepwise] = useState(true);
  // How many of each part's items are showing, one step at a time.
  const [shown, setShown] = useState<number[]>([]);
  const [said, setSaid] = useState("");
  const nextRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const endRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    let live = true;
    solutionFor(slug, id).then(s => {
      if (!live) return;
      setSolution(s);
      if (s) setShown(s.parts.map(() => 0));
    });
    return () => { live = false; };
  }, [slug, id]);

  const headingId = `sol-${id}`;
  if (solution === undefined) return <div className="qb-sol" aria-busy="true"><p className="qb-sol-hint">Opening the worked solution…</p></div>;
  if (solution === null) return <div className="qb-sol"><p className="qb-sol-hint">The worked solution didn’t load. Try again in a moment.</p></div>;

  const parts = solution.parts.map(partItems);
  const total = parts.reduce((n, items) => n + items.length, 0);

  function reveal(p: number) {
    const count = Math.min(parts[p].length, (shown[p] ?? 0) + 1);
    setShown(s => s.map((n, i) => (i === p ? count : n)));
    const item = parts[p][count - 1];
    const label = solution!.parts[p].label;
    const where = label ? `Part ${label}: ` : "";
    setSaid(item.kind === "answer" ? `${where}the answer is showing.` : `${where}step ${count} of ${solution!.parts[p].steps.length} is showing.`);
    if (count === parts[p].length) {
      // This part is done: carry on to the next part's key, or to the end of this one.
      requestAnimationFrame(() => (nextRefs.current.slice(p + 1).find(Boolean) ?? endRefs.current[p])?.focus());
    }
  }

  function setMode(on: boolean) {
    setStepwise(on);
    setShown(solution!.parts.map(() => 0));
    setSaid(on ? "Showing one step at a time." : `Showing every step: ${total} in all.`);
  }

  return (
    <section className="qb-sol" aria-labelledby={headingId}>
      <div className="qb-sol-bar">
        <h3 id={headingId} className="qb-sol-title">Worked solution</h3>
        <button type="button" className="qb-sol-btn is-quiet" aria-pressed={!stepwise} onClick={() => setMode(!stepwise)}>
          {stepwise ? "Show every step" : "One step at a time"}
        </button>
      </div>
      <p className="qb-sol-hint">
        {stepwise ? "Try each step yourself before you reveal it." : "Every step is showing."} Marks are the ones in Pearson’s mark scheme, on the line that earns them.
      </p>
      <div className="qb-sol-sheet">
        <p className="qb-sol-sheet-title" aria-hidden="true">Question {question}</p>
        {solution.parts.map((part, p) => {
          const items = parts[p];
          const count = stepwise ? (shown[p] ?? 0) : items.length;
          const partHead = part.label ? `Part (${part.label})` : `Question ${question}`;
          return (
            <section key={part.label || p} className="qb-sol-part" aria-labelledby={`${headingId}-${p}`}>
              <h4 id={`${headingId}-${p}`} className="qb-sol-part-head">
                {part.label ? <span className={`qb-sol-label${part.label.length > 2 ? " is-long" : ""}`} aria-hidden="true">{marginLabel(part.label)}</span> : null}
                <span className="qb-sol-sr">{partHead}</span>
                {part.ask && <span className="qb-sol-ask"><Prose text={part.ask} /></span>}
              </h4>
              <p className="qb-sol-method"><span className="qb-sol-sr">Method: </span><Prose text={part.method} /></p>
              <ol className="qb-sol-steps">
                {items.slice(0, count).map((item, i) => (
                  <li key={item.key} className={`qb-sol-item is-${item.kind}`}
                    tabIndex={i === items.length - 1 ? -1 : undefined}
                    ref={i === items.length - 1 ? el => { endRefs.current[p] = el; } : undefined}>
                    {item.node}
                  </li>
                ))}
              </ol>
              {count < items.length && (
                <button type="button" className="qb-sol-btn" ref={el => { nextRefs.current[p] = el; }} onClick={() => reveal(p)}
                  aria-label={`Next step${part.label ? ` in part ${part.label}` : ""} (${count} of ${items.length} shown)`}>
                  Next step
                </button>
              )}
            </section>
          );
        })}
        {(!stepwise || parts.every((items, p) => (shown[p] ?? 0) >= items.length)) && <p className="qb-sol-end" aria-hidden="true">{"//"}</p>}
      </div>
      <p className="qb-sol-sr" role="status" aria-live="polite">{said}</p>
    </section>
  );
}
