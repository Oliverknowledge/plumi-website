import { Section } from "@/components/ui/Section";
import { BandBars } from "@/components/product/BandBars";
import { compounding, evidenceCases, masteredGate, sections } from "@/content/copy";

/**
 * The honest mirror.
 *
 * This section states a RULE rather than a claim, and that is the whole design.
 * "Plumi learns from your work" is something every AI wrapper says and nobody
 * can check. "Notes make a topic seen and nothing more" is falsifiable — a
 * student can go and test it — and falsifiable statements read as true.
 *
 * It is placed second, straight after the demo, so it lands as an insight
 * rather than as an accusation. Tone matters here more than anywhere else on
 * the page: the same sentence delivered coldly is a telling-off.
 */

const bandFill = { unseen: 0, developing: 2, secure: 3 } as const;
/** The bars: the app's own hues, held to 3:1 as non-text components. */
const barTone = {
  unseen: "var(--color-mastery-unseen)",
  developing: "var(--color-mastery-developing)",
  secure: "var(--color-mastery-secure)",
} as const;

/** The band name, set as text, and therefore held to 4.5:1. */
const textTone = {
  unseen: "var(--color-ink-secondary)",
  developing: "var(--color-mastery-developing-text)",
  secure: "var(--color-mastery-secure-text)",
} as const;

export function WhatCounts() {
  return (
    <Section copy={sections.whatCounts}>
      {/* Three pieces of work, and what each one did to the same topic. Stacked
          on a phone, where the sequence reads better as a narrative than it
          does as a comparison. */}
      <ol className="grid gap-4 md:grid-cols-3 md:gap-5">
        {evidenceCases.map((item, index) => (
          <li
            key={item.band}
            className="flex flex-col rounded-[var(--radius-card)] border border-[var(--color-hairline)] bg-[var(--color-elevated)] p-6 opacity-0 [animation:chip-rise_0.5s_var(--ease-out-soft)_forwards]"
            style={{ animationDelay: `${index * 0.12}s` }}
          >
            <p className="text-[0.9375rem] leading-snug text-[var(--color-ink-secondary)]">
              {item.work}
            </p>

            <div className="mt-5 flex items-center gap-3">
              <BandBars filled={bandFill[item.tone]} colour={barTone[item.tone]} />
              <span
                className="text-h3 font-medium"
                style={{ color: textTone[item.tone] }}
              >
                {item.band}
              </span>
            </div>

            <p className="mt-3 text-sm leading-snug text-[var(--color-ink-tertiary)]">{item.note}</p>
          </li>
        ))}
      </ol>

      {/* The sting. The top band is gated on a success under a clock, and the
          bar is half marks rather than full — because the claim being gated is
          "this student can do this when it counts". */}
      <div className="mt-4 flex flex-col gap-4 rounded-[var(--radius-card)] border border-dashed border-[var(--color-hairline-strong)] bg-transparent p-6 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex shrink-0 items-center gap-3">
          <BandBars filled={0} colour="var(--color-mastery-mastered)" />
          <span className="text-h3 font-medium text-[var(--color-ink-tertiary)]">
            {masteredGate.band}
          </span>
        </div>
        <p className="text-[0.9375rem] leading-snug text-[var(--color-ink-secondary)]">
          {masteredGate.note}
        </p>
      </div>

      {/* The compounding argument, as an accumulation of real evidence rather
          than a promise about results. */}
      <div className="mt-16 border-t border-[var(--color-hairline)] pt-12 sm:mt-20 lg:pt-14">
        <p className="measure-wide text-lead text-[var(--color-ink-secondary)] text-pretty">
          {compounding.lead}
        </p>

        {/*
          A timeline, not a mastery meter.

          These four steps used the same four-bar component as the bands above,
          filled 1/4 through 4/4 in brand blue — which quietly turned the site's
          most semantically loaded object into a decorative counter, and painted
          "week six" in the exact glyph and colour that means "Mastered" three
          sections later. A dot on a rule says "time passing" and cannot be
          mistaken for anything else.
        */}
        <ol className="mt-10 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {compounding.steps.map((step) => (
            <li key={step.when} className="relative">
              <span
                aria-hidden="true"
                className="mb-4 flex h-2 items-center gap-2 text-[var(--color-hairline-strong)]"
              >
                <span className="size-2 rounded-full bg-[var(--color-blue-600)]" />
                <span className="h-px flex-1 bg-current" />
              </span>
              <p className="text-[0.9375rem] font-semibold">{step.when}</p>
              <p className="mt-1 text-[0.9375rem] leading-snug text-[var(--color-ink-secondary)]">
                {step.detail}
              </p>
            </li>
          ))}
        </ol>

        <p className="mt-10 measure-wide text-[0.9375rem] leading-relaxed text-[var(--color-ink-secondary)]">
          {compounding.closing}
        </p>
      </div>
    </Section>
  );
}
