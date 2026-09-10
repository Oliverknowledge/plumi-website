import { HeadToHead } from "@/components/sections/HeadToHead";
import { HandMark } from "@/components/ui/HandMark";
import { Impression } from "@/components/ui/Impression";
import { Section } from "@/components/ui/Section";
import { sections } from "@/content/copy";
import { freePlan, planSummary, proPlan } from "@/content/plans";

/**
 * Two jobs, in order: establish that the notebook is genuinely free and
 * genuinely good, then win the comparison.
 *
 * The two plan columns are deliberately identical in weight — same card, same
 * border, same padding, no badge, no glow, no recommended tier. Free is a real
 * product in this business, not a trial, and styling Pro as "the good one"
 * would contradict the sentence underneath the columns.
 *
 * The ticks are Plumi's own pen, not an icon set: the app draws every row of
 * its paywall list this way.
 */

const CARD =
  "flex h-full flex-col rounded-[var(--radius-card)] border border-[var(--color-hairline)] bg-[var(--color-elevated)] p-6 shadow-[var(--shadow-resting)] sm:p-8";

function Tick({ colour }: { colour: string }) {
  return <HandMark mark="tick" size={19} colour={colour} className="mt-[2px]" />;
}

function FreeColumn() {
  return (
    <div className={CARD}>
      <h3 className="text-h3 font-medium">{freePlan.name}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-ink-secondary)] text-pretty">
        {freePlan.promise}
      </p>

      <ul className="mt-6 space-y-2.5">
        {freePlan.includes.map((item) => (
          <li key={item} className="flex gap-3 text-[15px] leading-snug text-[var(--color-ink)]">
            <Tick colour="var(--color-ink-tertiary)" />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <p className="mt-7 text-[15px] font-medium text-[var(--color-ink)]">{freePlan.allowanceLead}</p>

      <dl className="mt-3 border-t border-[var(--color-hairline)]">
        {freePlan.allowances.map((row) => (
          <div
            key={row.feature}
            className="flex items-baseline justify-between gap-4 border-b border-[var(--color-hairline)] py-2.5"
          >
            <dt className="text-[15px] text-[var(--color-ink-secondary)]">{row.feature}</dt>
            <dd className="text-[15px] font-medium text-[var(--color-ink)]">{row.allowance}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 text-[13px] leading-relaxed text-[var(--color-ink-tertiary)] text-pretty">
        {freePlan.footnote}
      </p>
    </div>
  );
}

function ProColumn() {
  return (
    <div className={CARD}>
      <h3 className="text-h3 font-medium">{proPlan.name}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-ink-secondary)] text-pretty">
        {proPlan.promise}
      </p>

      <ul className="mt-6 space-y-4">
        {proPlan.includes.map((item) => (
          <li key={item.title} className="flex gap-3">
            <Tick colour="var(--color-blue-600)" />
            <span>
              <span className="block text-[15px] font-medium text-[var(--color-ink)]">{item.title}</span>
              <span className="mt-0.5 block text-[14px] leading-snug text-[var(--color-ink-secondary)] text-pretty">
                {item.detail}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {/* There is no price, so this is where a price would be and it says so. */}
      <div className="mt-auto border-t border-[var(--color-hairline)] pt-5">
        <p className="text-h3 font-medium text-[var(--color-ink)]">{proPlan.priceLine}</p>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-ink-secondary)] text-pretty">
          {proPlan.priceDetail}
        </p>
      </div>
    </div>
  );
}

export function FreeAndPro() {
  return (
    <Section copy={sections.freeAndPro}>
      <Impression event="free_pro_viewed">
        {/* Same card, same padding, same weight. Neither column is "the good one". */}
        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
          <FreeColumn />
          <ProColumn />
        </div>

        <p className="mx-auto mt-10 max-w-3xl text-center text-h3 font-medium text-balance sm:mt-12">
          {planSummary}
        </p>
      </Impression>

      <div className="mt-20 border-t border-[var(--color-hairline)] pt-14 sm:mt-24 sm:pt-16">
        <HeadToHead />
      </div>
    </Section>
  );
}
