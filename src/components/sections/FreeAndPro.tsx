import { HandMark } from "@/components/ui/HandMark";
import { Impression } from "@/components/ui/Impression";
import { freePlan, planSummary, proPlan } from "@/content/plans";

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
 * ── Why there is no price ───────────────────────────────────────────────────
 * The app's own rule: "a price the App Store has not confirmed is a price Plumi
 * cannot charge." There are numbers in a local StoreKit *test* configuration.
 * They are not approved, they do not agree with the planned pricing, and they
 * are not going on this page until one of those two things changes.
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
              {/* There is no price, so this is where a price would be and it says so. */}
              <div className="plan-price">
                <strong>{proPlan.priceLine}</strong>
                <span>{proPlan.priceDetail}</span>
              </div>
            </article>
          </div>

          <p className="plans-summary">{planSummary}</p>
        </div>
      </Impression>
    </section>
  );
}
