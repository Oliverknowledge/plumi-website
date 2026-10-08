/**
 * ── NOT ON THE PAGE, AND DELIBERATELY SO ────────────────────────────────────
 *
 * This is the only part of Plumi a visitor can actually *use*: drag a loop round
 * a line of working with a finger and get a hint beside it, from the app's real
 * hint ladder. It is finished work and it is held back rather than abandoned.
 *
 * Why it is not mounted: it is the heaviest interactive thing in the repo, the
 * homepage's INP budget currently has no measurements behind it, and the page it
 * would sit on is already making its argument without it. Reviving it is a
 * deliberate decision with a measurement attached, not a tidy-up.
 *
 * To revive: mount it beneath chapter 01 as an opt-in reveal so it costs nothing
 * at LCP, and watch `product_demo_interacted` → `cta_clicked` against INP p75.
 * Its copy is `penDemo` in `src/content/copy.ts` and is still current.
 *
 * Everything else from the abandoned first generation of this homepage has been
 * deleted rather than left lying around. This one file survives on its merits.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import getStroke from "perfect-freehand";

import { Ink } from "@/components/product/Ink";
import { PaperSurface, ruleAt } from "@/components/product/Paper";
import { inkPlainText, richWidth as inkWidth } from "@/components/product/richInk";
import { penActions, penDemo } from "@/content/copy";
import { track } from "@/lib/analytics";

/**
 * The one part of Plumi a visitor can actually use.
 *
 * Draw a loop round a line of working with a finger, a Pencil or a mouse. The
 * ink follows the pointer with real pressure geometry, Plumi reads the line
 * back to you, and its menu opens on the page beside what you circled. Pick
 * Explain, Hint or Check and the answer is written into the margin in Plumi's
 * own hand. Ask again and you get a different KIND of help, never the same
 * sentence reworded.
 *
 * The menu is on the page, not in a sidebar. It used to be a list down the
 * right-hand side, which was wrong twice. It was wrong to the product: the AI
 * Pen's menu opens under your pencil, anchored to the thing you selected,
 * because the whole argument is that help arrives where you are working rather
 * than somewhere else. And it was wrong on a phone, where a static column of
 * four descriptions ended up taller than the notebook it was secondary to.
 *
 * It is deliberately forgiving. Whatever you draw resolves to the line your
 * stroke covers most. A demo that can be done wrong at 11pm is a demo that gets
 * abandoned, and the point being made is that Plumi already knows what you are
 * looking at.
 *
 * Drawing is an enhancement, never the only route. Every line is also a real
 * button, the menu is real buttons, and a caption states the point in prose for
 * anyone who never touches it.
 */

/**
 * A narrower page than the hero's, on purpose. This card is full width on a
 * phone, so the viewBox decides how large the handwriting renders: at 900 units
 * in 350px of viewport the ink came out around twelve pixels, on the one
 * element whose entire job is to be read.
 */
const PAGE = { w: 660, h: 520 };
const INK_SIZE = 30;
const NOTE_SIZE = 22;
/** Clear of the margin rule at x = 96. */
const WRITE_X = 114;
/** Rules the working sits on. */
const LINE_RULES = [2, 5, 8] as const;

type Phase = "idle" | "drawing" | "reading" | "menu" | "answered";

/** The AI Pen's four actions, by their labels in `penActions`. */
type ActionKey = "Explain" | "Hint" | "Check" | "Ask";

/** What Plumi writes back: a short margin note, and what kind of help it is. */
interface Answer {
  readonly kind: string;
  readonly note: string;
}

interface Point {
  x: number;
  y: number;
  pressure: number;
}

/** How long Plumi spends visibly reading the line before its menu opens. */
const READ_MS = 620;

/**
 * perfect-freehand's outline, as an SVG path. The stroke thins toward both ends
 * because a pen lifts; a constant-width line is the tell of a drawing tool that
 * has never met a stylus.
 */
function outlinePath(points: readonly Point[]): string {
  if (points.length < 2) return "";

  const outline = getStroke(
    points.map((p) => [p.x, p.y, p.pressure]),
    { size: 7, thinning: 0.55, smoothing: 0.6, streamline: 0.42, simulatePressure: true, last: true },
  );

  if (outline.length === 0) return "";

  // One `Q`, then repeated coordinate pairs: the path grammar allows a command
  // to be implicitly repeated. Emitting a fresh `Q` before every segment
  // produces a `d` the browser rejects outright, which fails silently and
  // invisibly, with the stroke simply never appearing.
  const [start] = outline;
  let d = `M ${start[0].toFixed(2)} ${start[1].toFixed(2)} Q`;

  for (let i = 0; i < outline.length; i += 1) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[(i + 1) % outline.length];
    d += ` ${x0.toFixed(2)} ${y0.toFixed(2)} ${((x0 + x1) / 2).toFixed(2)} ${((y0 + y1) / 2).toFixed(2)}`;
  }

  return `${d} Z`;
}

/** The line whose band the stroke spends most of its length inside. */
function lineUnderStroke(points: readonly Point[]): number {
  const votes = LINE_RULES.map(() => 0);

  for (const point of points) {
    let best = 0;
    let bestDistance = Infinity;
    LINE_RULES.forEach((rule, index) => {
      const distance = Math.abs(point.y - ruleAt(rule));
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    votes[best] += 1;
  }

  return votes.indexOf(Math.max(...votes));
}

const percent = (value: number, of: number) => `${(value / of) * 100}%`;

export function PenDemo() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [stroke, setStroke] = useState<Point[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [action, setAction] = useState<ActionKey | null>(null);
  const [rung, setRung] = useState(0);
  const reported = useRef(false);

  const toPage = useCallback((event: React.PointerEvent): Point => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0, pressure: 0.5 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * PAGE.w,
      y: ((event.clientY - rect.top) / rect.height) * PAGE.h,
      // A mouse reports 0.5; a Pencil reports what it is actually doing.
      pressure: event.pressure > 0 ? event.pressure : 0.5,
    };
  }, []);

  const selectLine = useCallback((index: number, how: "drawn" | "tapped") => {
    setSelected(index);
    setAction(null);
    setRung(0);
    // Plumi reads before it offers. The pause is short, and it is the moment
    // the claim in the headline becomes checkable, so it is shown rather than
    // skipped over.
    setPhase("reading");
    if (!reported.current) {
      reported.current = true;
      track("product_demo_interacted", { placement: "pen_demo", action: how });
    }
  }, []);

  // The live stroke lives in refs, not state. React state is asynchronous: a
  // `pointermove` firing before the render caused by `pointerdown` has
  // committed would see the old phase and drop its point. On a fast flick,
  // which is how people circle things, that is most of the stroke.
  const drawing = useRef(false);
  const points = useRef<Point[]>([]);
  const frame = useRef<number | null>(null);

  const flush = useCallback(() => {
    frame.current = null;
    setStroke(points.current.slice());
  }, []);

  const scheduleFlush = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = window.requestAnimationFrame(flush);
  }, [flush]);

  function onPointerDown(event: React.PointerEvent) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Capture keeps the stroke alive if the pointer leaves the page. A
      // synthetic or already-released pointer throws, and losing capture is not
      // a reason to lose the stroke.
    }
    drawing.current = true;
    points.current = [toPage(event)];
    setPhase("drawing");
    setAction(null);
    scheduleFlush();
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!drawing.current) return;
    // Every sample the OS captured between frames: the difference between a
    // smooth line and a polygon on a 120Hz iPad.
    const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
    if (samples.length > 0) {
      for (const sample of samples) points.current.push(toPage(sample as unknown as React.PointerEvent));
    } else {
      points.current.push(toPage(event));
    }
    scheduleFlush();
  }

  function onPointerUp() {
    if (!drawing.current) return;
    drawing.current = false;
    if (frame.current !== null) {
      window.cancelAnimationFrame(frame.current);
      frame.current = null;
    }

    const drawn = points.current;
    if (drawn.length < 5) {
      points.current = [];
      setStroke([]);
      setPhase("idle");
      return;
    }

    setStroke(drawn.slice());
    selectLine(lineUnderStroke(drawn), "drawn");
  }

  function reset() {
    drawing.current = false;
    points.current = [];
    setStroke([]);
    setSelected(null);
    setAction(null);
    setRung(0);
    setPhase("idle");
  }

  // Reading finishes, the menu opens.
  useEffect(() => {
    if (phase !== "reading") return;
    const timer = window.setTimeout(() => setPhase("menu"), READ_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // The visitor's own ink fades once it has done its job; leaving it on the
  // page competes with the answer.
  useEffect(() => {
    if (phase === "idle" || phase === "drawing") return;
    const timer = window.setTimeout(() => setStroke([]), 1100);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const line = selected === null ? null : penDemo.lines[selected];
  const hints = line?.hints ?? [];

  const answer: Answer | null =
    line === null || action === null || action === "Ask"
      ? null
      : action === "Hint"
        ? hints[Math.min(rung, hints.length - 1)]
        : action === "Explain"
          ? line.explain
          : line.check;

  const atEndOfLadder = action === "Hint" && rung >= hints.length - 1;

  function choose(key: ActionKey) {
    setAction(key);
    setRung(0);
    setPhase("answered");
    track("product_demo_interacted", { placement: "pen_demo", action: key.toLowerCase() });
  }

  const lineRule = selected === null ? LINE_RULES[2] : LINE_RULES[selected];
  const lineWidth = line ? inkWidth(line.text, INK_SIZE) : 0;

  // Where Plumi writes its answer.
  //
  // Beside the working if there is room, which is where a margin note belongs.
  // The third line of this working is nearly the width of the page, though, so
  // for a long line the note drops to the rule underneath and starts at the
  // margin, with the whole width to run in. That is what a person does with a
  // note that will not fit in a margin, and it is a great deal better than
  // truncating the note or writing it over the student's own ink.
  const NOTE_BOX = 214;
  const noteFitsBeside = WRITE_X + lineWidth + 28 + NOTE_BOX <= PAGE.w - 20;
  const note = noteFitsBeside
    ? { x: WRITE_X + lineWidth + 28, rule: lineRule, width: NOTE_BOX }
    : { x: WRITE_X, rule: lineRule + 1, width: PAGE.w - WRITE_X - 30 };

  /** The menu clears whatever the note did. */
  const menuTop = ruleAt(noteFitsBeside ? lineRule : lineRule + 1) + 26;

  return (
    <div className="max-w-3xl">
      {/* Two wrappers, and the reason is the menu. The page clips its own
          contents, because a page does; the menu opens near the bottom line and
          has to be allowed past that edge, the way a popover does. So the outer
          element positions and the inner element clips. */}
      <div className="relative">
        <div className="overflow-hidden rounded-[var(--radius-sheet)] bg-[var(--color-paper)] shadow-[var(--shadow-resting)] ring-1 ring-[var(--color-hairline)]">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${PAGE.w} ${PAGE.h}`}
          className="block w-full touch-none select-none"
          style={{ cursor: phase === "drawing" ? "grabbing" : "crosshair" }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          aria-hidden="true"
        >
          <PaperSurface width={PAGE.w} height={PAGE.h} radius={0} />

          {/* The printed question, in a serif, as printed maths is. */}
          <text x={WRITE_X} y={52} fontFamily="var(--font-serif)" fontSize={23} fill="var(--color-ink)">
            Find{" "}
            <tspan fontStyle="italic" fontSize={25}>
              &#8747; x e
            </tspan>
            <tspan fontStyle="italic" fontSize={16} dy={-8}>
              x
            </tspan>
            <tspan fontStyle="italic" fontSize={25} dy={8}>
              {" "}
              dx
            </tspan>
          </text>
          <text
            x={PAGE.w - 44}
            y={52}
            textAnchor="end"
            fontFamily="var(--font-serif)"
            fontSize={16}
            fill="var(--color-ink-tertiary)"
          >
            {penDemo.marks}
          </text>

          {/* The line Plumi read, tinted behind the ink. */}
          {selected !== null && (
            <rect
              x={WRITE_X - 16}
              y={ruleAt(lineRule) - INK_SIZE - 4}
              width={lineWidth + 32}
              height={INK_SIZE + 20}
              rx={7}
              fill="var(--color-blue-600)"
              opacity={0.08}
              style={{ animation: "fade-in 0.22s ease-out" }}
            />
          )}

          {/* Plumi reading it: one pass, left to right, the width of the line.
              Short, and the only moment on the page that depicts the model
              doing anything. A spinner would have said the same thing and meant
              nothing. */}
          {phase === "reading" && selected !== null && (
            <rect
              x={WRITE_X - 16}
              y={ruleAt(lineRule) - INK_SIZE - 4}
              width={44}
              height={INK_SIZE + 20}
              rx={7}
              fill="var(--color-blue-600)"
              opacity={0.16}
              className="read-sweep"
              style={{ ["--sweep-to" as string]: `${lineWidth - 12}px` }}
            />
          )}

          {/* The working. Already written: this is a page the student filled in
              earlier, not one being written now. */}
          {penDemo.lines.map((l, index) => (
            <Ink
              key={l.text}
              text={l.text}
              x={WRITE_X}
              y={ruleAt(LINE_RULES[index]) - INK_SIZE * 0.7}
              size={INK_SIZE}
              width={PAGE.w - WRITE_X - 30}
              maxLines={1}
              seed={9 + index * 7}
              still
            />
          ))}

          {/* Plumi's answer, in the margin beside the line, in its own hand. */}
          {answer && selected !== null && (
            <Ink
              key={`${selected}-${action}-${rung}`}
              text={answer.note}
              x={note.x}
              y={ruleAt(note.rule) - NOTE_SIZE * 0.7 - 2}
              size={NOTE_SIZE}
              width={note.width}
              maxLines={1}
              tone="tutor"
              seed={3 + rung * 5}
              speed={1250}
            />
          )}

          {/* The visitor's own ink. */}
          {stroke.length > 1 && (
            <path
              d={outlinePath(stroke)}
              fill="var(--color-blue-600)"
              opacity={phase === "idle" || phase === "drawing" ? 0.9 : 0}
              style={{ transition: "opacity 0.55s ease-out" }}
            />
          )}

          {/* The invitation, drawn once, so nobody has to be told twice. */}
          {phase === "idle" && stroke.length === 0 && <GhostLoop />}
        </svg>
        </div>

        {/* Every line, as a real button. This is how the demo is operated from a
            keyboard, and it is why the whole thing is not a mouse-only trick. */}
        <div className="absolute inset-0">
          {penDemo.lines.map((l, index) => (
            <button
              key={l.text}
              type="button"
              onClick={() => selectLine(index, "tapped")}
              className="absolute rounded-[7px] opacity-0 focus-visible:opacity-100"
              style={{
                left: percent(WRITE_X - 16, PAGE.w),
                top: percent(ruleAt(LINE_RULES[index]) - INK_SIZE - 4, PAGE.h),
                width: percent(inkWidth(l.text, INK_SIZE) + 32, PAGE.w),
                height: percent(INK_SIZE + 20, PAGE.h),
              }}
            >
              <span className="sr-only">Ask Plumi about the line: {inkPlainText(l.text)}</span>
            </button>
          ))}
        </div>

        {/* The AI Pen menu, anchored on the page under the line it belongs to,
            so it arrives where the student was already looking. HTML rather
            than SVG because these are real buttons that take real focus. */}
        {selected !== null && (phase === "menu" || phase === "answered") && (
          <div
            className="pen-menu absolute right-[4%] left-[4%] sm:right-auto sm:left-[16%] sm:w-[64%]"
            style={{ top: percent(menuTop, PAGE.h) }}
          >
            <div className="rounded-[var(--radius-card)] border border-[var(--color-hairline)] bg-[var(--color-elevated)] p-3 shadow-[var(--shadow-floating)]">
              <div className="flex items-center gap-2 px-1 pb-2.5">
                <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
                  <path
                    d="M12 1.5c.8 4.8 4 8 8.8 8.8v1.4c-4.8.8-8 4-8.8 8.8h-1.4c-.8-4.8-4-8-8.8-8.8v-1.4c4.8-.8 8-4 8.8-8.8h1.4Z"
                    fill="var(--color-blue-600)"
                  />
                </svg>
                <span className="text-[13px] font-semibold text-[var(--color-ink)]">AI Pen</span>
                <span className="truncate text-[13px] text-[var(--color-ink-tertiary)]">
                  {penDemo.readBack}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {penActions.map(({ label }) => {
                  const key = label as ActionKey;
                  // Ask is the one action this page does not pretend at: it
                  // needs a composer and a conversation, not a margin note.
                  const isAsk = key === "Ask";
                  const chosen = action === key;

                  return (
                    <button
                      key={label}
                      type="button"
                      disabled={isAsk}
                      aria-pressed={isAsk ? undefined : chosen}
                      onClick={() => choose(key)}
                      className={`min-h-[38px] flex-1 rounded-full px-3 text-[14px] font-medium transition-colors ${
                        chosen
                          ? "bg-[var(--color-blue-600)] text-white"
                          : isAsk
                            ? "cursor-default text-[var(--color-ink-tertiary)]"
                            : "bg-[var(--color-blue-50)] text-[var(--color-blue-700)] hover:bg-[var(--color-blue-100)]"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* What kind of help this was, and the offer of a different kind.
                  The ladder is the point: ask again and Plumi does not rephrase,
                  it changes approach. */}
              {answer && (
                <div className="mt-3 border-t border-[var(--color-hairline)] px-1 pt-2.5">
                  <p className="text-[11px] font-semibold tracking-[0.1em] text-[var(--color-tutor)] uppercase">
                    {answer.kind}
                  </p>

                  <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    {action === "Hint" ? (
                      atEndOfLadder ? (
                        <p className="text-[13px] text-[var(--color-ink-secondary)]">{penDemo.exhausted}</p>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setRung((n) => n + 1)}
                          className="text-[13px] font-medium text-[var(--color-blue-600)] hover:underline"
                        >
                          {penDemo.anotherWay}
                        </button>
                      )
                    ) : (
                      <span />
                    )}

                    <button
                      type="button"
                      onClick={reset}
                      className="text-[13px] text-[var(--color-ink-tertiary)] hover:text-[var(--color-ink-secondary)]"
                    >
                      {penDemo.reset}
                    </button>
                  </div>
                </div>
              )}

              {action === "Ask" && (
                <p className="mt-3 border-t border-[var(--color-hairline)] px-1 pt-2.5 text-[13px] text-[var(--color-ink-secondary)]">
                  {penDemo.askOnly}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <p
        className="mt-4 flex items-center gap-2.5 text-[0.9375rem] text-[var(--color-ink-secondary)]"
        aria-live="polite"
      >
        {selected === null ? (
          <>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
              <path
                d="M13 3.2 5.4 10.8 3 13l2.2-2.4L12.8 3a.7.7 0 0 1 1 0 .7.7 0 0 1 0 1Z"
                fill="none"
                stroke="var(--color-ink-tertiary)"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
            <span>{penDemo.prompt}</span>
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0">
              <circle cx="8" cy="8" r="7" fill="var(--color-blue-600)" opacity="0.12" />
              <path
                d="M4.5 8.2 6.9 10.6 11.5 5.6"
                fill="none"
                stroke="var(--color-blue-600)"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>
              {penDemo.readBack}:{" "}
              <span className="text-[var(--color-ink)]">
                &ldquo;{inkPlainText(penDemo.lines[selected].text)}&rdquo;
              </span>
            </span>
          </>
        )}
      </p>
    </div>
  );
}

/** The invitation: a loop that draws itself round the last line. */
function GhostLoop() {
  const y = ruleAt(LINE_RULES[2]);
  const x1 = WRITE_X - 20;
  const x2 = WRITE_X + inkWidth(penDemo.lines[2].text, INK_SIZE) + 20;
  const w = x2 - x1;

  const d = `M ${x1 + 14} ${y - 32}
             C ${x1 - 16} ${y - 26}, ${x1 - 18} ${y + 15}, ${x1 + 18} ${y + 19}
             C ${x1 + w * 0.45} ${y + 25}, ${x2 - 36} ${y + 22}, ${x2 - 9} ${y + 13}
             C ${x2 + 20} ${y + 3}, ${x2 + 18} ${y - 26}, ${x2 - 18} ${y - 30}
             C ${x1 + w * 0.5} ${y - 37}, ${x1 + w * 0.2} ${y - 35}, ${x1 + 7} ${y - 24}`;

  return (
    <path
      d={d}
      fill="none"
      stroke="var(--color-blue-600)"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeOpacity={0.5}
      className="ghost-loop"
      style={{
        strokeDasharray: 1400,
        strokeDashoffset: 1400,
        animation: "ghost-loop 4.5s ease-in-out 1.2s infinite",
      }}
    />
  );
}
