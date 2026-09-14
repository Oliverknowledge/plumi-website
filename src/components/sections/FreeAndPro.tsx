import { HandMark } from "@/components/ui/HandMark";
import { Impression } from "@/components/ui/Impression";
import { freePlan, planSummary, proAnchor, proFootnote, proOptions, proPlan } from "@/content/plans";

/**
 * The deal, stated late and stated plainly.
 *
 * ── Why the two columns weigh the same ──────────────────────────────────────
 * Same card, same border, same padding, no badge, no glow, no recommended tier.
 * Free is a real product in this business, not a trial, and styling Pro as "the
 * good one" would contradict the sentence underneath the columns.
 *
 * ── Why the allowances are printed as numbers ───────────────────────────────
 * Because they are the offer. Every competitor in this category is vague about
 * where the free tier stops, and vagueness at a premium price reads as a trap.
 * Twelve AI Pen answers, five marks, ten practice questions and a tutor exchange
 * every day is a better deal than "up to 5 AI generations a month", and the only
 * way to win that comparison is to say the number. They are the app's own values
 * (`PremiumFeature.freeDailyAllowance`) and they move together with it.
 *
 ── Why the price is here rather than higher up ─────────────────────────────
 * Chapter 12 of fourteen. A pricing table on a product whose argument has not
 * landed yet reads as presumptuous, and hiding a £19.99 price entirely reads as
 * a trap to a parent who has been trained to expect one. So: show it, once, and
 * show it after the desire exists.
 *
 * ── Why annual is favoured in the composition and not in the copy ───────────
 * It is shown first, given the accent border and carries the per-month
 * arithmetic. There is no "best value" badge, no strike-through on the monthly
 * price and no countdown, because a student who wants to pay monthly is not
 * doing anything wrong and a page that implies otherwise is doing the thing
 * every weekly-priced revision app does. The trial difference is stated on the
 * monthly card rather than left as an absence — finding that out at the till is
 * how a product loses somebody.
 *
 * The ticks are Plumi's own pen, not an icon set: the app draws every row of its
 * paywall list this way, and a tick from a system symbol set would be a
 * different product's tick.
 */
export function FreeAndPro() {
  return (
    <section id="free-and-pro" className="plans-section" data-testid="free-and-pro-section">
      <Impression event="pricing_viewed">
        <div className="story-container plans-layout">
          <div className="plans-heading">
            <div className="scene-eyebrow"><span>12</span> FREE &amp; PRO</div>
            <h2>Free is the notebook.<br /><span className="muted-line">Pro is the part that understands you.</span></h2>
          </div>

          <div className="plan-columns">
            <article className="plan-card" data-plan="free">
              <h3>{freePlan.name}</h3>
              <p className="plan-promise">{freePlan.promise}</p>
              <ul className="plan-list">
                {freePlan.includes.map((item) => (
                  <li key={item}>
                    <HandMark mark="tick" size={18} colour="var(--color-ink-tertiary)" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="plan-allowance-lead">{freePlan.allowanceLead}</p>
              <dl className="plan-allowances">
                {freePlan.allowances.map((row) => (
                  <div key={row.feature}>
                    <dt>{row.feature}</dt>
                    <dd>{row.allowance}</dd>
                  </div>
                ))}
              </dl>
              <p className="plan-fine">{freePlan.footnote}</p>
            </article>

            <article className="plan-card" data-plan="pro">
              <h3>{proPlan.name}</h3>
              <p className="plan-promise">{proPlan.promise}</p>
              <ul className="plan-list plan-list-detailed">
                {proPlan.includes.map((item) => (
                  <li key={item.title}>
                    <HandMark mark="tick" size={18} colour="var(--color-blue-600)" />
                    <span>
                      <b>{item.title}</b>
                      <small>{item.detail}</small>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="plan-price">
                <p className="plan-anchor">
                  <b>{proAnchor.headline}</b>
                  <span>{proAnchor.detail}</span>
                </p>
                <ul className="plan-options">
                  {proOptions.map((option) => (
                    <li key={option.id} data-featured={option.featured}>
                      <span className="option-label">{option.label}</span>
                      <p className="option-price">
                        <b>{option.price}</b> {option.period}
                      </p>
                      {option.perMonth && <p className="option-permonth">{option.perMonth}</p>}
                      <p className="option-terms">{option.terms}</p>
                    </li>
                  ))}
                </ul>
                <p className="plan-fine">{proFootnote}</p>
              </div>
            </article>
          </div>

          <p className="plans-summary">{planSummary}</p>
        </div>
      </Impression>
    </section>
  );
}
