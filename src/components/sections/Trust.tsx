import { Impression } from "@/components/ui/Impression";
import { Quill } from "@/components/quill/Quill";
import { trust } from "@/content/marking";

/**
 * Why you can trust the mark.
 *
 * ── The strategic decision ──────────────────────────────────────────────────
 * Do not claim accuracy. Claim *architecture*, and publish the limitation next
 * to it. A claim of accuracy is expensive to verify and therefore reads as
 * marketing; a claim about how a decision is made is cheap to verify and
 * therefore reads as true — and a product that volunteers the part that is not
 * finished yet has said the only thing in this category nobody else will say.
 *
 * ── What is deliberately not here ───────────────────────────────────────────
 * No percentage. No benchmark card. No "X% within ±1 mark". There is no
 * measured figure to put in one, a placeholder on a live page is a lie with a
 * bracket round it, and the moment a number appears here the argument stops
 * being about how Plumi marks and starts being about whether the number is
 * real. When a panel-marked benchmark exists it goes on its own page with its
 * method beside it, and a line here links to it.
 *
 * No model names, no module names, no pipeline diagram either. A student does
 * not care which model read the page; they care whether anybody checked.
 */
export function Trust() {
  return (
    <section id={trust.id} className="trust-section" data-testid="trust-section">
      <Impression event="trust_viewed">
        <div className="story-container trust-layout">
          <div className="trust-heading">
            <div className="scene-eyebrow"><span>{trust.eyebrow}</span> {trust.eyebrowLabel}</div>
            <h2>{trust.headline}</h2>
            <p className="trust-lead">{trust.lead}</p>
          </div>

          {/* Read → work out → decide. Three steps, in the order they happen,
              with the arrow drawn between them rather than implied by order. */}
          <ol className="trust-steps">
            {trust.steps.map((step) => (
              <li key={step.n}>
                <span className="trust-step-n">{step.n}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>

          <aside className="trust-honesty">
            <Quill mood="neutral" size={54} aria-hidden="true" />
            <p>{trust.honesty}</p>
          </aside>

          <div className="trust-panels">
            {trust.panels.map((panel) => (
              <article key={panel.title}>
                <h3>{panel.title}</h3>
                <p>{panel.body}</p>
              </article>
            ))}
          </div>
        </div>
      </Impression>
    </section>
  );
}
