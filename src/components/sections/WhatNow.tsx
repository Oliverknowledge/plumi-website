import { Section } from "@/components/ui/Section";
import { SessionWeighting } from "@/components/scenes/SessionWeighting";
import { sections, whatNow } from "@/content/copy";

/**
 * Where the loop pays off.
 *
 * Everything before this section argues that Plumi knows things. This one shows
 * that the knowing produces a single obvious action — and, immediately
 * afterwards, that the student can overrule it. Both halves matter. A study app
 * that has no opinion is useless; a study app that removes agency gets deleted
 * by a seventeen-year-old within a week.
 *
 * The language around adaptation is deliberately modest. Plumi's session brief
 * steers toward the topics your work says you are weakest at; there is no
 * question bank and no measured-difficulty filter behind it, so this says the
 * session follows how you are doing, and does not claim a difficulty ladder the
 * app does not implement.
 */
export function WhatNow() {
  const { recommendation } = whatNow;

  return (
    <Section copy={sections.whatNow}>
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        {/* Home, with exactly one card on it. */}
        <div>
          <p className="eyebrow !text-[var(--color-ink-tertiary)]">{whatNow.homeLabel}</p>

          <article className="mt-4 rounded-[var(--radius-sheet)] border border-[var(--color-hairline)] bg-[var(--color-elevated)] p-6 shadow-[var(--shadow-resting)] sm:p-7">
            <p className="flex items-baseline gap-2.5">
              <span className="text-[1.0625rem] font-semibold text-[var(--color-blue-600)]">
                {recommendation.duration}
              </span>
              <span className="text-[0.9375rem] text-[var(--color-ink-tertiary)]">
                {recommendation.kind}
              </span>
            </p>

            <h3 className="mt-3 text-h3 font-medium">{recommendation.title}</h3>
            <p className="mt-2 text-[0.9375rem] leading-snug text-[var(--color-ink-secondary)]">
              {recommendation.reason}
            </p>

            <ol className="mt-6 space-y-4">
              {recommendation.steps.map((step) => (
                <li key={step.label} className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[0.9375rem] font-medium">{step.label}</p>
                    <p className="mt-0.5 text-[0.8125rem] text-[var(--color-ink-tertiary)]">
                      {step.detail}
                    </p>
                  </div>
                  <span className="shrink-0 text-[0.8125rem] tabular-nums text-[var(--color-ink-tertiary)]">
                    {step.minutes}
                  </span>
                </li>
              ))}
            </ol>

            {/* Rendered as it appears in the app, not as a link. It is an
                illustration of the product, so it is not focusable and does not
                pretend to be a control on this page. */}
            <p
              className="mt-7 inline-flex h-11 items-center rounded-full bg-[var(--color-blue-600)] px-5 font-medium text-white"
              aria-hidden="true"
            >
              {recommendation.cta} →
            </p>
          </article>
        </div>

        {/* The override, and the adaptation. */}
        <div>
          <p className="eyebrow !text-[var(--color-ink-tertiary)]">{whatNow.overrideLabel}</p>
          <SessionWeighting />
        </div>
      </div>

      {/* The loop closing. This lands far harder as a consequence of the
          section above than it would as a section of its own. */}
      <div className="mt-14 border-t border-[var(--color-hairline)] pt-10">
        <h3 className="text-h3 font-medium">{whatNow.retire.title}</h3>
        <p className="mt-3 measure-wide text-lead leading-relaxed text-[var(--color-ink-secondary)] text-pretty">
          {whatNow.retire.detail}
        </p>
      </div>
    </Section>
  );
}
