import { Ink } from "@/components/product/Ink";
import { inkDuration } from "@/components/product/inkTiming";
import { PaperSurface, ruleAt } from "@/components/product/Paper";
import { richWidth as inkWidth } from "@/components/product/richInk";

/**
 * The hero. Four moments, no words: WRITE → CIRCLE → TEACH → REMEMBER.
 *
 * ── Why this is a Server Component ───────────────────────────────────────────
 * Every animation here is a CSS keyframe with a computed delay. Nothing
 * subscribes to scroll, nothing runs a rAF loop, nothing hydrates. The largest
 * thing on the page is therefore static markup that paints once and then
 * animates on the compositor — which is how a hero this involved still gets a
 * good LCP on a phone at 31% battery.
 *
 * ── Why the timings are computed, not typed ──────────────────────────────────
 * `inkDuration` measures the actual path length of each line, so the pen moves
 * at a constant speed and the tutor never starts writing before the student has
 * finished. Change the working below and the choreography re-times itself.
 *
 * ── The content is real ──────────────────────────────────────────────────────
 * Integration by parts, worked with the sign slip on the last line — the same
 * example the app's own onboarding and marking demos use. The tutor's response
 * is what Plumi is actually allowed to write in a margin: short, and pointing
 * rather than telling.
 */

// iPad Pro 11" in points. The app renders at exactly this size.
const SCREEN = { w: 1194, h: 834 };
const PAGE = { x: 118, y: 74, w: 958, h: 726 };

/**
 * The student writes quickly; Plumi writes deliberately. Px of path per second.
 *
 * Both were slower. The full sequence ran four and a half seconds, and for the
 * first three of those the hero was a field of disconnected grey marks — which
 * is the worst possible first impression for a page whose argument is that you
 * can read what somebody wrote. The whole thing now resolves in about two and a
 * half, and the line the visitor most needs to see is legible in one.
 */
const STUDENT_SPEED = 2100;
const TUTOR_SPEED = 900;

const INK_SIZE = 38;
const NOTE_SIZE = 28;

/** Page-local x where writing begins — just right of the margin rule at 96. */
const WRITE_X = 132;

/** Every third rule, so the working spreads down the visible page as it would
 *  on a real one rather than bunching into the top third. */
const working = [
  { text: "Let u = x, dv = e^x dx", rule: 2, seed: 9 },
  { text: "du = dx, v = e^x", rule: 5, seed: 17 },
  { text: "∫ x e^x dx = x e^x − ∫ e^x dx", rule: 8, seed: 23 },
  { text: "= x e^x + e^x + c", rule: 11, seed: 31 },
] as const;

const TUTOR_NOTE = "check the sign";

/**
 * Plumi underlines the term at fault, not the whole line — which means knowing
 * where that term sits. Measuring the hand gives the exact offset, so the
 * underline stays correct if the working or the size ever changes.
 */
const FAULT_FROM = inkWidth("= x e^x ", INK_SIZE);
const FAULT_TO = inkWidth("= x e^x + e^x", INK_SIZE);

/** Ink is positioned from the top of the block; the cap height is 0.7em. */
function topForRule(rule: number, size: number): number {
  return ruleAt(rule) - size * 0.7;
}

/**
 * When each beat starts.
 *
 * Chained off the measured path length of the ink, so the pen moves at a
 * constant speed and the tutor never begins writing before the student has
 * finished. Computed once at module scope rather than per render: none of it
 * depends on a prop, and a render that mutates a counter is a render that is
 * not pure.
 */
const schedule = (() => {
  const gap = 0.06;
  const starts: number[] = [];
  let t = 0.2;

  for (const { text } of working) {
    starts.push(t);
    t += inkDuration(text, INK_SIZE, PAGE.w - WRITE_X - 40, 1, STUDENT_SPEED) + gap;
  }

  // The loop is drawn while the last line is still settling — a student reaches
  // for help the moment they doubt the line, not politely afterwards.
  const lasso = t - 0.1;
  const underline = lasso + 0.5;
  const note = underline + 0.15;
  const noteDuration = inkDuration(TUTOR_NOTE, NOTE_SIZE, 300, 1, TUTOR_SPEED);

  return { starts, lasso, underline, note, chip: note + noteDuration * 0.55 };
})();

export function HeroScene() {
  const { starts, lasso: lassoAt, underline: underlineAt, note: noteAt, chip: chipAt } = schedule;
  const lastLineY = ruleAt(working[3].rule);

  return (
    <svg
      viewBox={`0 0 ${SCREEN.w} ${SCREEN.h}`}
      className="h-full w-full"
      // The whole scene is an illustration. Its meaning is given in prose by the
      // caption beside it, so a screen reader is not made to sit through a
      // description of a drawing.
      aria-hidden="true"
    >
      <rect width={SCREEN.w} height={SCREEN.h} fill="var(--color-surface)" />

      <TopBar />

      <PaperSurface x={PAGE.x} y={PAGE.y} width={PAGE.w} height={PAGE.h} />

      <g transform={`translate(${PAGE.x} ${PAGE.y})`}>
        {/* The printed question. Set in a serif, because printed maths is —
            in the app, and in every exam paper ever typeset. */}
        <text
          x={WRITE_X}
          y={56}
          fontFamily="var(--font-serif)"
          fontSize={27}
          fill="var(--color-ink)"
        >
          Find{" "}
          <tspan fontStyle="italic" fontSize={30}>
            ∫ x e
          </tspan>
          <tspan fontStyle="italic" fontSize={20} dy={-9}>
            x
          </tspan>
          <tspan fontStyle="italic" fontSize={30} dy={9}>
            {" "}
            dx
          </tspan>
        </text>
        <text
          x={PAGE.w - 56}
          y={56}
          textAnchor="end"
          fontFamily="var(--font-serif)"
          fontSize={20}
          fill="var(--color-ink-tertiary)"
        >
          [6 marks]
        </text>

        {/* 1 — WRITE. */}
        {working.map((line, index) => (
          <Ink
            key={line.text}
            text={line.text}
            x={WRITE_X}
            y={topForRule(line.rule, INK_SIZE)}
            size={INK_SIZE}
            width={PAGE.w - WRITE_X - 40}
            maxLines={1}
            seed={line.seed}
            delay={starts[index]}
            speed={STUDENT_SPEED}
          />
        ))}

        {/* 2 — CIRCLE. The AI Pen loop. Deliberately not an ellipse: a closed
            geometric shape reads as a UI selection, and this is a person
            drawing a ring round something that is bothering them. */}
        <Lasso
          x1={WRITE_X - 26}
          x2={WRITE_X + inkWidth(working[3].text, INK_SIZE) + 26}
          y={lastLineY}
          delay={lassoAt}
        />

        {/* 3 — TEACH. Plumi underlines the exact term at fault and writes
            beside it, in indigo: not the student's ink, and not a grade
            colour. It points; it does not correct the line for them. */}
        <TutorUnderline
          x1={WRITE_X + FAULT_FROM}
          x2={WRITE_X + FAULT_TO}
          y={lastLineY + 14}
          delay={underlineAt}
        />
        <Ink
          text={TUTOR_NOTE}
          // Clear of the end of the student's line, not the end of the fault —
          // Plumi writes in the margin beside the working, never over it.
          x={WRITE_X + inkWidth(working[3].text, INK_SIZE) + 76}
          y={ruleAt(working[3].rule) - NOTE_SIZE * 0.7 - 4}
          size={NOTE_SIZE}
          width={320}
          maxLines={1}
          tone="tutor"
          seed={5}
          delay={noteAt}
          speed={TUTOR_SPEED}
        />

        {/* 4 — REMEMBER. The work becomes a fact about the student. Placed
            directly under the line that produced it, so the causal link is in
            the composition rather than in a caption. */}
        <MasteryChip x={WRITE_X + FAULT_FROM} y={lastLineY + 76} delay={chipAt} />
      </g>

      <ToolTray />
    </svg>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function TopBar() {
  return (
    <g>
      <rect width={SCREEN.w} height={56} fill="var(--color-surface)" />
      <line x1={0} y1={56} x2={SCREEN.w} y2={56} stroke="var(--color-hairline)" strokeWidth={1} />

      <path
        d="M32 22 L24 28 L32 34"
        fill="none"
        stroke="var(--color-blue-600)"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text x={46} y={35} fontSize={17} fontWeight={600} fill="var(--color-ink)">
        Integration
      </text>

      <text x={SCREEN.w - 300} y={35} fontSize={16} fontWeight={500} fill="var(--color-blue-600)">
        Tutor
      </text>
      <text x={SCREEN.w - 232} y={35} fontSize={16} fontWeight={500} fill="var(--color-blue-600)">
        Mark my work
      </text>
      <text x={SCREEN.w - 32} y={35} textAnchor="end" fontSize={15} fill="var(--color-ink-tertiary)">
        Page 1 of 1
      </text>
    </g>
  );
}

/**
 * The floating tool tray. Undo, redo, three writing tools, eraser, lasso, then
 * the AI Pen — which is the only lit thing on it, because it is the only thing
 * on it that is Plumi's rather than a notebook's.
 */
function ToolTray() {
  const trayW = 560;
  const x = (SCREEN.w - trayW) / 2;
  const y = SCREEN.h - 96;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={trayW}
        height={60}
        rx={30}
        fill="var(--color-elevated)"
        stroke="var(--color-hairline)"
        strokeWidth={1}
        filter="url(#tray-shadow)"
      />
      <defs>
        <filter id="tray-shadow" x="-20%" y="-50%" width="140%" height="220%">
          <feDropShadow dy="6" stdDeviation="10" floodColor="#16202E" floodOpacity="0.12" />
        </filter>
      </defs>

      <g stroke="var(--color-ink-secondary)" strokeWidth={1.8} fill="none" strokeLinecap="round">
        {/* undo / redo */}
        <path d={`M${x + 34} ${y + 24} a10 10 0 1 0 3 12`} />
        <path d={`M${x + 34} ${y + 24} l-1 -7 M${x + 34} ${y + 24} l7 1`} />
        <path d={`M${x + 78} ${y + 24} a10 10 0 1 1 -3 12`} />
        <path d={`M${x + 78} ${y + 24} l1 -7 M${x + 78} ${y + 24} l-7 1`} />
      </g>

      <line
        x1={x + 104}
        y1={y + 18}
        x2={x + 104}
        y2={y + 42}
        stroke="var(--color-hairline)"
        strokeWidth={1}
      />

      {/* Pen, pencil, highlighter — the app's default tray is one of each
          writing tool, not five colour chips. */}
      <Nib x={x + 130} y={y + 30} fill="var(--color-pen-ink)" selected />
      <Nib x={x + 168} y={y + 30} fill="var(--color-pen-graphite)" />
      <Nib x={x + 206} y={y + 30} fill="var(--color-highlighter-yellow)" wide />

      <line
        x1={x + 238}
        y1={y + 18}
        x2={x + 238}
        y2={y + 42}
        stroke="var(--color-hairline)"
        strokeWidth={1}
      />

      {/* eraser, lasso */}
      <g stroke="var(--color-ink-secondary)" strokeWidth={1.8} fill="none" strokeLinecap="round">
        <path d={`M${x + 258} ${y + 36} l12 -12 a6 6 0 0 1 8 0 l4 4 a6 6 0 0 1 0 8 l-12 12 h-16 z`} />
        <path d={`M${x + 306} ${y + 36} a13 9 0 1 1 13 -4`} strokeDasharray="3 4" />
      </g>

      {/* The AI Pen. Lit, because it is the one thing here that a notebook
          could not do. */}
      <rect x={x + 342} y={y + 12} width={116} height={36} rx={18} fill="var(--color-blue-50)" />
      <path
        d={`M${x + 362} ${y + 22} l3 6 6 3 -6 3 -3 6 -3 -6 -6 -3 6 -3 z`}
        fill="var(--color-blue-600)"
      />
      <text x={x + 380} y={y + 35} fontSize={15} fontWeight={600} fill="var(--color-blue-600)">
        AI Pen
      </text>

      <g stroke="var(--color-ink-secondary)" strokeWidth={1.8} strokeLinecap="round">
        <path d={`M${x + 486} ${y + 22} v10 M${x + 481} ${y + 27} v0`} />
        <circle cx={x + 486} cy={y + 26} r={5} fill="none" />
        <path d={`M${x + 516} ${y + 22} h18 M${x + 516} ${y + 30} h18 M${x + 516} ${y + 38} h18`} />
      </g>
    </g>
  );
}

function Nib({
  x,
  y,
  fill,
  selected = false,
  wide = false,
}: {
  x: number;
  y: number;
  fill: string;
  selected?: boolean;
  wide?: boolean;
}) {
  const w = wide ? 13 : 9;
  return (
    <g>
      {selected && <rect x={x - 14} y={y - 18} width={28} height={36} rx={9} fill="var(--color-fill)" />}
      <path d={`M${x - w / 2} ${y - 14} h${w} v18 l-${w / 2} 8 l-${w / 2} -8 z`} fill={fill} />
    </g>
  );
}

/**
 * The AI Pen loop.
 *
 * Hand-drawn on purpose. The path overshoots its own start by a few points,
 * because that is what happens when a person draws a ring quickly and does not
 * bother to close it exactly — and a perfectly closed ellipse is the single
 * loudest tell that a "hand-drawn" selection was drawn by a computer.
 */
function Lasso({ x1, x2, y, delay }: { x1: number; x2: number; y: number; delay: number }) {
  const top = y - 40;
  const bottom = y + 22;
  const w = x2 - x1;

  // Starts on the left, runs right along the underside, back along the top,
  // and overshoots its own start by a few points — because that is what
  // happens when a person draws a ring quickly and does not bother to close
  // it exactly.
  const d = `M ${x1 + 18} ${top + 4}
             C ${x1 - 22} ${top + 10}, ${x1 - 26} ${bottom - 4}, ${x1 + 22} ${bottom}
             C ${x1 + w * 0.4} ${bottom + 9}, ${x1 + w * 0.82} ${bottom + 7}, ${x2 - 8} ${bottom - 3}
             C ${x2 + 30} ${bottom - 12}, ${x2 + 28} ${top + 8}, ${x2 - 22} ${top + 3}
             C ${x1 + w * 0.66} ${top - 6}, ${x1 + w * 0.28} ${top - 4}, ${x1 + 8} ${top + 8}`;

  // A generous over-estimate of the path length; the dash only has to be at
  // least as long as the path for the reveal to be complete.
  const length = w * 2.6 + 400;

  return (
    <>
      <path
        d={d}
        fill="var(--color-blue-600)"
        fillOpacity={0}
        stroke="var(--color-blue-600)"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeOpacity={0.85}
        style={{
          strokeDasharray: length,
          strokeDashoffset: length,
          animation: `ink-draw 0.62s cubic-bezier(0.4,0,0.2,1) ${delay}s forwards`,
        }}
      />
      {/* The selection tint arrives only once the loop has closed. */}
      <path
        d={d}
        fill="var(--color-blue-600)"
        stroke="none"
        style={{
          opacity: 0,
          animation: `fade-in 0.3s ease-out ${(delay + 0.6).toFixed(2)}s forwards`,
          ["--fade-to" as string]: "0.07",
        }}
      />
    </>
  );
}

/** One wobbly stroke under the term at fault. Drawn, not stroked flat: a ruler-
 *  straight underline is a text decoration, and this is meant to be a pen. */
function TutorUnderline({
  x1,
  x2,
  y,
  delay,
}: {
  x1: number;
  x2: number;
  y: number;
  delay: number;
}) {
  const span = x2 - x1;
  const d = `M ${x1} ${y} c ${span * 0.25} -3.5, ${span * 0.45} 4, ${span * 0.62} 0.5 s ${span * 0.2} -4, ${span * 0.38} 1.5`;
  const length = span * 1.1;

  return (
    <path
      d={d}
      fill="none"
      stroke="var(--color-tutor)"
      strokeWidth={2.6}
      strokeLinecap="round"
      style={{
        strokeDasharray: length,
        strokeDashoffset: length,
        animation: `ink-draw 0.4s linear ${delay}s forwards`,
      }}
    />
  );
}

/**
 * The last beat, and the one the whole site is about: the piece of work has
 * become a fact about the student.
 */
function MasteryChip({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <g
      style={{
        opacity: 0,
        animation: `chip-rise 0.5s var(--ease-out-soft) ${delay}s forwards`,
        transformOrigin: `${x + 226}px ${y + 30}px`,
      }}
    >
      <rect
        x={x}
        y={y}
        width={452}
        height={84}
        rx={16}
        fill="var(--color-elevated)"
        stroke="var(--color-hairline)"
        strokeWidth={1}
        filter="url(#tray-shadow)"
      />
      {/* Two of four bars filled, in the weak red — the app's own band
          indicator, taken straight off the Progress screen. Not a percentage
          and not a ring: Plumi has no confidence scores anywhere, and neither
          does this page. */}
      <g>
        {[0, 1, 2, 3].map((i) => (
          <rect
            key={i}
            x={x + 24 + i * 17}
            y={y + 39}
            width={12}
            height={5}
            rx={2.5}
            fill={i < 2 ? "var(--color-mastery-weak)" : "var(--color-mastery-unseen)"}
          />
        ))}
      </g>
      <text x={x + 108} y={y + 36} fontSize={20} fontWeight={600} fill="var(--color-ink)">
        Integration by parts
      </text>
      <text x={x + 108} y={y + 62} fontSize={17} fill="var(--color-ink-secondary)">
        Needs work · 3 pieces of evidence
      </text>
    </g>
  );
}
