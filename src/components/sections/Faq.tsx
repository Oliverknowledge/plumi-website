import { FaqEntry } from "@/components/sections/FaqEntry";
import { faq } from "@/content/copy";

/**
 * The objection handler.
 *
 * Seven questions, each answered with the awkward part left in — "you need an
 * iPad", "there are no GCSE specifications yet", "there's no price here". A FAQ
 * that only answers the easy questions is read as marketing; one that answers
 * the hard ones is read as an answer.
 *
 * The structured data is generated from the same array the page renders, so what
 * Google is told and what a student is shown cannot drift apart — which is the
 * only version of this Google actually permits.
 */
export function Faq() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <section id="faq" className="faq-section" data-testid="faq-section">
      <div className="story-container faq-layout">
        <div className="faq-heading">
          <div className="scene-eyebrow"><span>13</span> QUESTIONS</div>
          <h2>The things<br /><span className="muted-line">people actually ask.</span></h2>
        </div>
        <div className="faq-list">
          {/* The first is the differentiation argument. Collapsed at 85% scroll
              depth it was the best-written thing on the site that nobody read. */}
          {faq.map((item, index) => (
            <FaqEntry key={item.question} item={item} open={index === 0} />
          ))}
        </div>
      </div>
      <script
        type="application/ld+json"
        // `<` is escaped so a copy change can never close this script tag early.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
    </section>
  );
}
