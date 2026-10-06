"use client";
import { useMemo, useRef, useState } from "react";
import { Ink } from "@/components/product/Ink";
import { QuillGlyph } from "@/components/quill/Quill";
import { strokePath } from "@/lib/hand";
import { cross, tick, type Rect } from "@/lib/hand/marks";
import { useQuillScene, type Step } from "@/lib/quill/scene";
import { useMotionReady } from "@/lib/useMotionReady";
import { theMark } from "@/content/marking";

/**
 * The mark.
 *
 * This is the product, and until now it was the one thing the site never showed.
 * The hero shows a nudge; chapter 01 shows a nudge. Neither shows a mark being
 * awarded against a mark scheme with the lost marks named, which is the whole
 * reason to install Plumi and the one thing no competitor can show as well.
 *
 * ── The composition ─────────────────────────────────────────────────────────
 * A page and a ledger. The page carries the student's working with each mark
 * drawn in the margin beside the line that earned it, exactly as an examiner
 * places them and exactly as `MarkingTask.mark` specifies (`box` is "the step,
 * not the page"). The ledger carries the words, at a size a phone can read.
 *
 * Splitting them this way is a responsive decision as much as a design one. Mark
 * codes are two characters and survive an SVG scaling to 340px; a six-word
 * headline does not. Putting the headlines in HTML beside the page means they
 * are 15px at every viewport rather than 15 units of a viewBox.
 *
 * ── The order the marks land in ─────────────────────────────────────────────
 * Four ticks in reading order, then the quill goes back up the page and places
 * the two crosses. That is not decoration: it is the headline — "Six marks. You
 * got four. Here are the two." — performed. The score climbs with the ticks and
 * the two reasons open with the crosses.
 *
 * ── Reduced motion ──────────────────────────────────────────────────────────
 * `useQuillScene` prepares nothing when motion is off, so the paths render at
 * full length with no dash offset: the finished marked page, immediately, which
 * is the resolved end state rather than an absence. `landed` is forced to the
 * full set for the same reason, so the ledger and the score are complete too.
 */

/** Where each line of working sits, in the page's own coordinates. */
const LINE_TOP = [14, 64, 122, 170, 218, 266] as const;
const TEXT_SIZE = 25;
const SECOND_COLUMN = 236;
/** The examiner's margin. Every mark lands in it, at its own line's height. */
const GUTTER_X = 430;
const MARK_SIZE = 27;
const PAGE = { w: 560, h: 316 };

/** Ticks first, in reading order, then back up the page for the two crosses. */
const ORDER = [0, 1, 3, 4, 2, 5] as const;

function markRect(line: number): Rect {
  return { x: GUTTER_X, y: LINE_TOP[line] - 1, width: MARK_SIZE, height: MARK_SIZE };
}

export function TheMark() {
  const motion = useMotionReady();
  const svg = useRef<SVGSVGElement>(null);
  const [landed, setLanded] = useState(0);

  // The marks themselves, as the pen's own geometry. Seeded off the mark code so
  // six ticks on one page are six different ticks and the same six every render.
  const marks = useMemo(
    () =>
      theMark.points.map((point, i) => ({
        point,
        strokes: (point.awarded ? tick : cross)(markRect(point.line), {
          strokeWidth: 3.1,
          seed: 41 + i * 7,
        }),
      })),
    [],
  );

  const scene = useQuillScene(
    svg,
    () => {
      const steps: Step[] = [{ enter: [GUTTER_X + 90, -40], mood: "focused" }];
      ORDER.forEach((index, n) => {
        const { point, strokes } = marks[index];
        const rect = markRect(point.line);
        steps.push({ move: [rect.x + 2, rect.y + rect.height * 0.5], dur: n === 0 ? 0.55 : 0.34, lift: 26 });
        strokes.forEach((_, s) => steps.push({ draw: `mk-${index}-${s}`, dur: 0.2 }));
        steps.push({ reveal: `code-${index}`, dur: 0.22 });
        steps.push({ call: () => setLanded(n + 1) });
        // A beat before the quill turns back for the two it has to take away.
        if (n === 3) steps.push({ hold: 0.55, mood: "happy" });
      });
      steps.push({ hold: 0.5, mood: "proud" }, { exit: [PAGE.w + 70, -60], dur: 0.8 });
      return steps;
    },
    { motion, deps: [marks] },
  );

  const shown = motion && !scene.done ? landed : ORDER.length;
  const revealed = new Set<number>(ORDER.slice(0, shown));
  const awarded = theMark.points.filter((p, i) => p.awarded && revealed.has(i)).length;

  return (
    <section id={theMark.id} className="mark-section" data-testid="the-mark-section">
      <div className="story-container mark-layout">
        <div className="mark-copy">
          <h2>{theMark.headline}<br /><span className="muted-line">{theMark.headlineMuted}</span></h2>
          <p>{theMark.lead}</p>
          <div className="mark-controls">
            <button className="replay-control" data-testid="mark-replay-button" onClick={() => { setLanded(0); scene.replay(); }}>
              {theMark.replay}
            </button>
          </div>
        </div>

        <div className="mark-stage">
          <div className="marked-paper" data-testid="marked-paper">
            <div className="paper-heading">
              <span>{theMark.paperLabel}</span>
              <span>{theMark.paperRef}</span>
            </div>

            {/* Printed, in the serif, because on a real script the question is
                printed and only the working is handwritten. The hand has no
                fractions and no limits on an integral sign, by design. */}
            <div className="mark-question">
              <span className="question-number">{theMark.questionNumber}</span>
              <p>
                {theMark.question}{" "}
                <span className="printed-maths" aria-hidden="true">
                  <span className="integral">∫<i><b>{theMark.questionUpper}</b><b>{theMark.questionLower}</b></i></span>
                  {theMark.questionRest}
                </span>
                <span className="sr-only">{theMark.questionSpoken}</span>
                <small>{theMark.questionMarks}</small>
              </p>
              <span className="mark-score" data-complete={shown === ORDER.length} data-testid="mark-score">
                <b>{awarded}</b>/{theMark.score.total}
              </span>
            </div>

            <svg
              ref={svg}
              viewBox={`0 0 ${PAGE.w} ${PAGE.h}`}
              className="mark-page"
              role="img"
              aria-label={`A student's handwritten integration by parts, marked: ${theMark.score.awarded} of ${theMark.score.total} marks. ${theMark.points.map(p => `${p.code}, ${p.awarded ? "awarded" : "not awarded"}, ${p.headline}`).join(". ")}.`}
            >
              {/* The ruled margin an examiner writes in. */}
              <path d={`M${GUTTER_X - 16} 0V${PAGE.h}`} stroke="var(--color-hairline)" strokeWidth="1.2" fill="none" />

              {theMark.working.map((line, i) => (
                <g key={line.text}>
                  <Ink text={line.text} x={24} y={LINE_TOP[i]} size={TEXT_SIZE} width={400} maxLines={1} seed={11 + i * 5} still />
                  {"second" in line && line.second && (
                    <Ink text={line.second} x={SECOND_COLUMN} y={LINE_TOP[i]} size={TEXT_SIZE} width={200} maxLines={1} seed={41 + i * 5} still />
                  )}
                </g>
              ))}

              {marks.map(({ point, strokes }, i) =>
                strokes.map((stroke, s) => (
                  <path
                    key={`${point.code}-${s}`}
                    data-ink={`mk-${i}-${s}`}
                    d={strokePath(stroke)}
                    fill="none"
                    stroke={point.awarded ? "var(--color-correct)" : "var(--color-incorrect)"}
                    strokeWidth={stroke.width}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )),
              )}

              <g className="mark-codes" fontFamily="var(--font-serif)" fontSize="20" fontStyle="italic">
                {theMark.points.map((point, i) => (
                  <text
                    key={point.code}
                    data-reveal={`code-${i}`}
                    x={GUTTER_X + MARK_SIZE + 12}
                    y={LINE_TOP[i] + 22}
                    fill={point.awarded ? "var(--color-mastery-secure-text)" : "var(--color-mastery-weak-text)"}
                  >
                    {point.code}
                  </text>
                ))}
              </g>

              <QuillGlyph scale={0.5} mood="focused" className="scene-quill" />
            </svg>

            <p className="capture-caption">{theMark.caption}</p>
          </div>

          <div className="mark-breakdown">
          <p className="tiny-label">{theMark.ledgerLabel}</p>
          <ol className="mark-ledger" aria-label={theMark.ledgerLabel} data-testid="mark-ledger">
            {theMark.points.map((point, i) => (
              <li key={point.code} data-awarded={point.awarded} data-landed={revealed.has(i)}>
                <span className="ledger-code">{point.code}</span>
                <span className="ledger-body">
                  <b>{point.headline}</b>
                  {"detail" in point && point.detail && <small>{point.detail}</small>}
                </span>
                <span className="ledger-value">{point.awarded ? "1" : "0"}</span>
              </li>
            ))}
          </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
