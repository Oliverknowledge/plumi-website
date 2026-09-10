import { FaqEntry } from "@/components/sections/FaqEntry";
import { Section } from "@/components/ui/Section";
import { faq, sections } from "@/content/copy";

/**
 * The objection handler.
 *
 * Six questions, each answered with the awkward part left in — "you need an
 * iPad", "we haven't set a date", "there's no price here". A FAQ that only
 * answers the easy questions is read as marketing; one that answers the hard
 * ones is read as an answer.
 *
 * The structured data below is generated from the same `faq` array the page
 * renders, so what Google is told and what a student is shown cannot drift
 * apart — which is the only version of this Google actually permits.
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
    // Paper, deliberately: the habit band above it is `surface` and the close
    // below it is `dark`, so two `surface` sections in a row would read as one
    // very long band with a heading in the middle of it.
    <Section copy={sections.faq}>
      <div className="measure-wide">
        <div className="border-t border-[var(--color-hairline)]">
          {faq.map((item) => (
            <FaqEntry key={item.question} item={item} />
          ))}
        </div>
      </div>

      <script
        type="application/ld+json"
        // `<` is escaped so a copy change can never close this script tag early.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
    </Section>
  );
}
