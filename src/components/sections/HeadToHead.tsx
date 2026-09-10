"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import { useMotionReady } from "@/lib/useMotionReady";

import { HandMark, type MarkName } from "@/components/ui/HandMark";
import { alternatives, comparison, verdictLabels, type Verdict } from "@/content/plans";
import { track, trackOnceWhenVisible } from "@/lib/analytics";

/**
 * The comparison, as a head-to-head rather than as a matrix.
 *
 * A four-column grid of categories asks a student to care about three
 * alternatives they do not use, and it cannot be read on a phone without
 * turning into a sideways scroll. So the question is asked first — what are you
 * using now? — and the answer produces two columns, which fit 390px.
 *
 * Rows where the alternative wins are rendered exactly like every other row.
 * Conceding a real loss is the only thing that makes the rest believable, and
 * de-emphasising the losses would throw that away to save nothing.
 */

const VERDICT_MARK: Record<Verdict, MarkName> = {
  yes: "tick",
  partly: "half",
  no: "cross",
};

/**
 * Monochrome, deliberately, and this is the one place it matters most.
 *
 * These marks were green, amber and red — which broke the rule the whole site
 * runs on: that green, amber and red mean *marking* and nothing else. Seventy
 * traffic-light glyphs in a competitor grid is not rationing, it is a decoration
 * budget.
 *
 * It also inverted the argument. Red is the colour of the Weak mastery band
 * three sections above, so a row this table concedes honestly — "a chatbot
 * answers questions about anything; Plumi doesn't" — rendered as Plumi being
 * marked wrong. The copy said "we lose this one" and the colour said "we failed
 * this one", which is a worse claim than the one being made.
 *
 * Ink for yes, a lighter ink for partly, and a quiet grey for no — one that
 * still clears 3:1, because a cross nobody can see is a row nobody can read.
 * The shapes carry the meaning, and they are the app's own drawn marks.
 */
const VERDICT_COLOUR: Record<Verdict, string> = {
  yes: "var(--color-ink)",
  partly: "var(--color-ink-secondary)",
  no: "var(--color-mark-absent)",
};

function VerdictCell({ verdict }: { verdict: Verdict }) {
  return (
    <td className="px-2 py-3.5 align-middle">
      <span className="flex justify-center">
        <HandMark
          mark={VERDICT_MARK[verdict]}
          size={22}
          colour={VERDICT_COLOUR[verdict]}
          label={verdictLabels[verdict]}
        />
      </span>
    </td>
  );
}

export function HeadToHead() {
  // See useMotionReady: reading the preference during the first render is a
  // hydration mismatch, because the server has no preference to read.
  const animate = useMotionReady();
  const [activeId, setActiveId] = useState<string>(alternatives[0].id);
  const container = useRef<HTMLDivElement>(null);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(
    () =>
      trackOnceWhenVisible(container.current, "comparison_viewed", {
        placement: "comparison",
        alternatives: alternatives.length,
      }),
    [],
  );

  const activeIndex = Math.max(
    0,
    alternatives.findIndex((item) => item.id === activeId),
  );
  const active = alternatives[activeIndex];

  function choose(index: number, focus = false) {
    const next = alternatives[index];
    if (!next) return;
    setActiveId(next.id);
    if (focus) tabs.current[index]?.focus();
    track("product_demo_interacted", { placement: "comparison", action: next.id });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const last = alternatives.length - 1;
    let next: number | null = null;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = activeIndex === last ? 0 : activeIndex + 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = activeIndex === 0 ? last : activeIndex - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;

    if (next === null) return;
    event.preventDefault();
    choose(next, true);
  }

  /**
   * A short, staggered arrival, as a CSS keyframe rather than a library.
   * No-op with motion off; the whole run is well under 300ms with it on, which
   * is the point at which a re-render stops feeling like a response and starts
   * feeling like a page load.
   */
  const rowDelay = (index: number): CSSProperties | undefined =>
    animate ? { animationDelay: `${index * 12}ms` } : undefined;

  const headCell =
    "px-2 py-3 align-bottom text-center text-[13px] font-semibold text-[var(--color-ink)] sm:text-[15px]";

  return (
    // Capped: a claim column 700px wide is a claim nobody finishes reading.
    <div ref={container} className="max-w-4xl">
      <p id="head-to-head-question" className="text-h3 font-medium text-[var(--color-ink)] text-balance">
        {comparison.question}
      </p>

      <div
        role="tablist"
        aria-labelledby="head-to-head-question"
        onKeyDown={onKeyDown}
        className="mt-5 flex flex-wrap gap-2"
      >
        {alternatives.map((item, index) => {
          const selected = item.id === activeId;
          return (
            <button
              key={item.id}
              ref={(node) => {
                tabs.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`head-to-head-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`head-to-head-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => choose(index)}
              className={`min-h-[44px] rounded-full border px-4 text-[15px] transition-colors ${
                selected
                  ? "border-[var(--color-blue-600)] bg-[var(--color-blue-600)] font-medium text-[var(--color-ink-inverse)]"
                  : "border-[var(--color-hairline-strong)] bg-[var(--color-elevated)] text-[var(--color-ink-secondary)] hover:bg-[var(--color-fill)]"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`head-to-head-panel-${active.id}`}
        aria-labelledby={`head-to-head-tab-${active.id}`}
        tabIndex={-1}
        className="mt-6 overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-hairline)] bg-[var(--color-elevated)] shadow-[var(--shadow-resting)]"
      >
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col />
            <col className="w-[86px] sm:w-[168px]" />
            <col className="w-[86px] sm:w-[168px]" />
          </colgroup>

          <thead>
            <tr className="border-b border-[var(--color-hairline-strong)]">
              <th scope="col" className="px-4 py-3 text-left sm:px-6">
                <span className="sr-only">{comparison.claimLabel}</span>
              </th>
              <th scope="col" className={headCell}>
                {active.label}
                <span className="mt-0.5 hidden text-[12px] font-normal text-[var(--color-ink-tertiary)] sm:block">
                  {active.sublabel}
                </span>
              </th>
              <th scope="col" className={headCell}>
                {comparison.ourLabel}
                <span className="mt-0.5 hidden text-[12px] font-normal text-[var(--color-ink-tertiary)] sm:block">
                  {comparison.ourSublabel}
                </span>
              </th>
            </tr>
          </thead>

          {/* Keyed on the alternative, so switching remounts and re-staggers. */}
          <tbody key={active.id} className={animate ? "rows-stagger" : undefined}>
            {active.rows.map((row, index) => (
              <tr key={row.claim} style={rowDelay(index)} className="border-b border-[var(--color-hairline)]">
                <th
                  scope="row"
                  className="px-4 py-3.5 text-left align-middle text-[14px] font-normal text-[var(--color-ink)] sm:px-6 sm:text-[15px]"
                >
                  {row.claim}
                  {row.note && (
                    <span className="mt-1 block text-[12px] leading-snug text-[var(--color-ink-tertiary)] sm:text-[13px]">
                      {row.note}
                    </span>
                  )}
                </th>
                <VerdictCell verdict={row.them} />
                <VerdictCell verdict={row.plumi} />
              </tr>
            ))}

            {/* Cost last, and in words on both sides. Ours is "no price yet"
                because there is no price yet. */}
            <tr style={rowDelay(active.rows.length)} className="bg-[var(--color-fill)]">
              <th
                scope="row"
                className="px-4 py-4 text-left align-middle text-[14px] font-semibold text-[var(--color-ink)] sm:px-6 sm:text-[15px]"
              >
                {comparison.costLabel}
              </th>
              <td className="px-2 py-4 text-center align-middle text-[12px] leading-snug text-balance text-[var(--color-ink-secondary)] sm:text-[15px]">
                {active.cost}
              </td>
              <td className="px-2 py-4 text-center align-middle text-[12px] leading-snug font-medium text-balance text-[var(--color-ink)] sm:text-[15px]">
                {comparison.ourCost}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* The marks, named. A drawn half-tick means "partly" to the person who
          drew it and nothing at all to a reader — which is the same problem as
          an undefined tilde in somebody else's table. */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[var(--color-ink-tertiary)]">
        {(["yes", "partly", "no"] as const).map((verdict) => (
          <span key={verdict} className="inline-flex items-center gap-1.5">
            <HandMark mark={VERDICT_MARK[verdict]} size={16} colour={VERDICT_COLOUR[verdict]} />
            {verdictLabels[verdict]}
          </span>
        ))}
      </div>

      <p className="mt-3 measure-wide text-sm leading-relaxed text-[var(--color-ink-tertiary)] text-pretty">
        {comparison.footnote}
      </p>
    </div>
  );
}
