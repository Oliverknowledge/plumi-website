"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import getStroke from "perfect-freehand";

import { Ink } from "@/components/product/Ink";
import { PaperSurface, ruleAt } from "@/components/product/Paper";
import { width as inkWidth } from "@/lib/hand";
import { penActions, penDemo } from "@/content/copy";
import { track } from "@/lib/analytics";

/**
 * The one part of Plumi a visitor can actually use.
 *
 * Draw a loop round a line of working with a finger, a Pencil or a mouse; the
 * ink follows the pointer with real pressure geometry; the line you enclosed is
 * read back to you; and a hint appears beside it, in the margin, written in
 * Plumi's own hand. Ask again and you get a different KIND of help rather than
 * the same sentence reworded.
 *
 * ── Deliberately forgiving ───────────────────────────────────────────────────
 * Whatever you draw, the selection resolves to the line your stroke covers
 * most. A demo that can be "done wrong" on a phone at 11pm is a demo that will
 * be abandoned, and the point being made — Plumi already knows what you are
 * looking at — is undermined by an app that needs a neat circle.
 *
 * ── Not the only way to understand this ──────────────────────────────────────
 * Drawing is an enhancement. Every line is also a real button, so the whole
 * thing is operable from the keyboard, and a static caption states the point
 * for anyone who never touches it.
 */

const PAGE = { w: 900, h: 448 };
const INK_SIZE = 32;
const NOTE_SIZE = 24;
const WRITE_X = 128;
/** Rules the working sits on. */
const LINE_RULES = [2, 5, 8] as const;

type Phase = "idle" | "drawing" | "selected";

interface Point {
  x: number;
  y: number;
  pressure: number;
}

/**
 * perfect-freehand's outline, as an SVG path. The stroke thins toward both ends
 * because a pen lifts; a constant-width line is the tell of a drawing tool that
 * has never met a stylus.
 */
function outlinePath(points: readonly Point[]): string {
  if (points.length < 2) return "";

  const outline = getStroke(
    points.map((p) => [p.x, p.y, p.pressure]),
    {
      size: 7,
      thinning: 0.55,
      smoothing: 0.6,
      streamline: 0.42,
      simulatePressure: true,
      last: true,
    },
  );

  if (outline.length === 0) return "";

  // One `Q` command, then repeated coordinate pairs — the path grammar allows a
  // command to be implicitly repeated, and each quadratic takes its control
  // point from the outline vertex and its end point from the midpoint of the
  // next edge. Emitting a fresh `Q` before every segment produces a `d` the
  // browser rejects outright, which is a silent, invisible failure: the stroke
  // simply never appears.
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

export function PenDemo() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [stroke, setStroke] = useState<Point[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const reported = useRef(false);

  /** Pointer position in page coordinates, whatever the element's rendered size. */
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

  function selectLine(index: number, how: "drawn" | "tapped") {
    setSelected(index);
    setPhase("selected");
    setHintLevel(0);
    setShowHint(false);
    if (!reported.current) {
      reported.current = true;
      track("product_demo_interacted", { placement: "pen_demo", action: how });
    }
  }

  // The live stroke is kept in refs, not in state.
  //
  // React state is asynchronous: a `pointermove` that fires before the render
  // caused by `pointerdown` has committed would still see phase "idle" and drop
  // its point on the floor. On a fast flick — which is exactly how someone
  // circles something — that is most of the stroke. The refs are the truth
  // during a stroke; state is updated once per frame purely so the path
  // re-renders.
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
      // Capture is an optimisation — it keeps the stroke alive if the pointer
      // leaves the page mid-drag. A synthetic or already-released pointer
      // throws here, and losing capture is not a reason to lose the stroke.
    }
    drawing.current = true;
    points.current = [toPage(event)];
    setPhase("drawing");
    setShowHint(false);
    scheduleFlush();
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!drawing.current) return;
    // getCoalescedEvents returns every sample the OS captured between frames,
    // which is the difference between a smooth line and a polygon on a 120Hz
    // iPad.
    const samples = event.nativeEvent.getCoalescedEvents?.() ?? [];
    if (samples.length > 0) {
      for (const sample of samples) {
        points.current.push(toPage(sample as unknown as React.PointerEvent));
      }
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
      // A tap, not a loop. Nothing was selected; leave the page alone.
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
    setPhase("idle");
    setStroke([]);
    setSelected(null);
    setHintLevel(0);
    setShowHint(false);
  }

  // The stroke fades out once the selection has been made — it has done its
  // job, and leaving it on the page competes with the hint.
  useEffect(() => {
    if (phase !== "selected") return;
    const timer = window.setTimeout(() => setStroke([]), 900);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const line = selected === null ? null : penDemo.lines[selected];
  const hints = line?.hints ?? [];
  const hint = showHint ? hints[Math.min(hintLevel, hints.length - 1)] : null;
  const atEndOfLadder = showHint && hintLevel >= hints.length - 1;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-10">
      <div>
        <div className="relative overflow-hidden rounded-[var(--radius-sheet)] bg-[var(--color-paper)] shadow-[var(--shadow-resting)] ring-1 ring-[var(--color-hairline)]">
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
            <text x={WRITE_X} y={52} fontFamily="var(--font-serif)" fontSize={24} fill="var(--color-ink)">
              Find{" "}
              <tspan fontStyle="italic" fontSize={26}>
                ∫ x e
              </tspan>
              <tspan fontStyle="italic" fontSize={17} dy={-8}>
                x
              </tspan>
              <tspan fontStyle="italic" fontSize={26} dy={8}>
                {" "}
                dx
              </tspan>
            </text>
            <text
              x={PAGE.w - 48}
              y={52}
              textAnchor="end"
              fontFamily="var(--font-serif)"
              fontSize={17}
              fill="var(--color-ink-tertiary)"
            >
              {penDemo.marks}
            </text>

            {/* The line Plumi read, tinted behind the ink. */}
            {selected !== null && (
              <rect
                x={WRITE_X - 18}
                y={ruleAt(LINE_RULES[selected]) - INK_SIZE - 4}
                width={inkWidth(penDemo.lines[selected].text, INK_SIZE) + 36}
                height={INK_SIZE + 22}
                rx={8}
                fill="var(--color-blue-600)"
                opacity={0.08}
                style={{ animation: "fade-in 0.25s ease-out" }}
              />
            )}

            {/* The working. Already written — this page is one the student
                filled in earlier, not one being written now. */}
            {penDemo.lines.map((l, index) => (
              <Ink
                key={l.text}
                text={l.text}
                x={WRITE_X}
                y={ruleAt(LINE_RULES[index]) - INK_SIZE * 0.7}
                size={INK_SIZE}
                width={PAGE.w - WRITE_X - 40}
                maxLines={1}
                seed={9 + index * 7}
                still
              />
            ))}

            {/* Plumi's answer, in the margin beside the line. */}
            {hint && selected !== null && (
              <Ink
                key={`${selected}-${hintLevel}`}
                text={hint.note}
                x={Math.min(
                  WRITE_X + inkWidth(penDemo.lines[selected].text, INK_SIZE) + 56,
                  PAGE.w - 250,
                )}
                y={ruleAt(LINE_RULES[selected]) - NOTE_SIZE * 0.7 - 2}
                size={NOTE_SIZE}
                width={240}
                maxLines={1}
                tone="tutor"
                seed={3 + hintLevel}
                speed={520}
              />
            )}

            {/* The visitor's own ink. */}
            {stroke.length > 1 && (
              <path
                d={outlinePath(stroke)}
                fill="var(--color-blue-600)"
                opacity={phase === "selected" ? 0 : 0.9}
                style={{ transition: "opacity 0.5s ease-out" }}
              />
            )}

            {/* A ghost loop that draws itself once, so nobody has to be told
                twice what to do. It stops the moment the visitor touches the
                page. */}
            {phase === "idle" && stroke.length === 0 && <GhostLoop />}
          </svg>

          {/* The same three lines as real buttons, layered over the drawing
              surface. This is how the demo is operated from a keyboard, and it
              is why the whole thing is not a mouse-only party trick. */}
          <div className="absolute inset-0">
            {penDemo.lines.map((l, index) => (
              <button
                key={l.text}
                type="button"
                onClick={() => selectLine(index, "tapped")}
                className="absolute rounded-[8px] opacity-0 focus-visible:opacity-100"
                style={{
                  left: `${((WRITE_X - 18) / PAGE.w) * 100}%`,
                  top: `${((ruleAt(LINE_RULES[index]) - INK_SIZE - 4) / PAGE.h) * 100}%`,
                  width: `${((inkWidth(l.text, INK_SIZE) + 36) / PAGE.w) * 100}%`,
                  height: `${((INK_SIZE + 22) / PAGE.h) * 100}%`,
                }}
              >
                <span className="sr-only">Ask Plumi about the line: {l.text}</span>
              </button>
            ))}
          </div>
        </div>

        {/* The invitation, and then the read-back. Making Plumi say what it read
            is the app's first design principle — "show what we read, and let the
            student fix it" — and it is also the moment the claim in the headline
            becomes checkable. */}
        <p
          className="mt-4 flex items-center gap-2.5 text-[0.9375rem] text-[var(--color-ink-secondary)]"
          aria-live="polite"
        >
          {phase === "selected" ? (
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
                <span className="text-[var(--color-ink)]">“{penDemo.lines[selected!].text}”</span>
              </span>
            </>
          ) : (
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
          )}
        </p>
      </div>

      {/* The AI Pen's menu. Four things, named as the app names them. */}
      <div className="lg:pt-2">
        <div className="rounded-[var(--radius-card)] border border-[var(--color-hairline)] bg-[var(--color-elevated)] p-5 shadow-[var(--shadow-resting)]">
          <div className="flex items-center gap-2.5">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 1.5c.8 4.8 4 8 8.8 8.8v1.4c-4.8.8-8 4-8.8 8.8h-1.4c-.8-4.8-4-8-8.8-8.8v-1.4c4.8-.8 8-4 8.8-8.8h1.4Z"
                fill="var(--color-blue-600)"
              />
            </svg>
            <span className="font-semibold">AI Pen</span>
          </div>

          <ul className="mt-4 space-y-3">
            {penActions.map((action) => {
              const isHint = action.label === "Hint";
              const enabled = phase === "selected" && isHint;
              return (
                <li key={action.label}>
                  <button
                    type="button"
                    disabled={!enabled}
                    onClick={() => {
                      setShowHint(true);
                      track("product_demo_interacted", { placement: "pen_demo", action: "hint" });
                    }}
                    className={`w-full rounded-[var(--radius-control)] px-3 py-2.5 text-left transition-colors ${
                      enabled
                        ? "cursor-pointer bg-[var(--color-blue-50)] hover:bg-[var(--color-blue-100)]"
                        : "cursor-default"
                    }`}
                  >
                    <span
                      className={`block text-[0.9375rem] font-semibold ${
                        enabled ? "text-[var(--color-blue-700)]" : "text-[var(--color-ink)]"
                      }`}
                    >
                      {action.label}
                    </span>
                    <span className="mt-0.5 block text-[0.8125rem] leading-snug text-[var(--color-ink-secondary)]">
                      {action.detail}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {showHint && (
            <div className="mt-4 border-t border-[var(--color-hairline)] pt-4">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[var(--color-tutor)]">
                {hint?.kind}
              </p>
              {atEndOfLadder ? (
                <p className="mt-2 text-[0.8125rem] leading-snug text-[var(--color-ink-secondary)]">
                  {penDemo.exhausted}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => setHintLevel((n) => n + 1)}
                  className="mt-2 text-[0.875rem] font-medium text-[var(--color-blue-600)] hover:underline"
                >
                  {penDemo.anotherWay} →
                </button>
              )}
            </div>
          )}

          {phase === "selected" && (
            <button
              type="button"
              onClick={reset}
              className="mt-4 text-[0.8125rem] text-[var(--color-ink-tertiary)] hover:text-[var(--color-ink-secondary)]"
            >
              {penDemo.reset}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** The invitation: a loop that draws itself round the last line, once. */
function GhostLoop() {
  const y = ruleAt(LINE_RULES[2]);
  const x1 = WRITE_X - 22;
  const x2 = WRITE_X + inkWidth(penDemo.lines[2].text, INK_SIZE) + 22;
  const w = x2 - x1;

  const d = `M ${x1 + 16} ${y - 34}
             C ${x1 - 18} ${y - 28}, ${x1 - 20} ${y + 16}, ${x1 + 20} ${y + 20}
             C ${x1 + w * 0.45} ${y + 27}, ${x2 - 40} ${y + 24}, ${x2 - 10} ${y + 14}
             C ${x2 + 22} ${y + 4}, ${x2 + 20} ${y - 28}, ${x2 - 20} ${y - 32}
             C ${x1 + w * 0.5} ${y - 40}, ${x1 + w * 0.2} ${y - 38}, ${x1 + 8} ${y - 26}`;

  return (
    <path
      d={d}
      fill="none"
      stroke="var(--color-blue-600)"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeOpacity={0.32}
      style={{
        strokeDasharray: 1400,
        strokeDashoffset: 1400,
        animation: "ghost-loop 4.5s ease-in-out 1.2s infinite",
      }}
    />
  );
}
