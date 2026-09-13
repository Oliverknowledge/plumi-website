import { absoluteUrl, entityDescription, sameAs, site } from "@/config/site";

/**
 * JSON-LD, the honest subset.
 *
 * Structured data is how a crawler is told "the Plumi on this page is the same
 * Plumi as the one on that Discord, and it is a piece of educational software
 * for iPad" without having to infer it from prose. That is the entire job here.
 *
 * What is deliberately absent is as important as what is present. There is no
 * `aggregateRating`, no `review`, no `offers`, no `datePublished` on anything,
 * and no `award`. Plumi has not launched: it has no ratings, no reviews and no
 * settled price, and inventing them is both a Google structured-data violation
 * and the kind of thing that is very hard to walk back. `offers` in particular
 * is tempting because the notes features really are free — but the Pro tier is
 * not priced yet, and a lone `price: 0` would misrepresent the product.
 *
 * Add fields here only when the fact behind them is real and checkable.
 */

/** Stable @id values, so the graph nodes can reference each other. */
const ORGANISATION_ID = absoluteUrl("/#organization");
const WEBSITE_ID = absoluteUrl("/#website");

/**
 * Renders a JSON-LD block.
 *
 * The `<` escaping is not optional. `JSON.stringify` will happily emit a
 * `</script>` sequence if one ever reaches it through a content string, which
 * closes the tag early and turns the rest of the payload into markup. Replacing
 * `<` with its unicode escape is still valid JSON and cannot break out.
 */
function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

/**
 * The site-wide graph: who Plumi is, what the site is, what the product is.
 *
 * Rendered once in the root layout so every page carries it. A `@graph` keeps
 * it to a single script tag with the nodes cross-referenced by `@id`, which is
 * both smaller and easier for a parser to resolve than three loose blocks.
 */
export function SiteStructuredData() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Organization",
            "@id": ORGANISATION_ID,
            name: site.name,
            url: site.domain,
            description: entityDescription,
            email: site.contactEmail,
            logo: {
              "@type": "ImageObject",
              url: absoluteUrl("/icon.png"),
              caption: "Plumi",
            },
            // Only profiles genuinely controlled by Plumi. See src/config/site.ts.
            sameAs,
          },
          {
            "@type": "WebSite",
            "@id": WEBSITE_ID,
            name: site.name,
            url: site.domain,
            description: entityDescription,
            inLanguage: "en-GB",
            publisher: { "@id": ORGANISATION_ID },
            // No `potentialAction`/SearchAction: the site has no search box, and
            // claiming one produces a sitelinks searchbox that leads nowhere.
          },
          {
            "@type": "SoftwareApplication",
            name: site.name,
            url: site.domain,
            description: entityDescription,
            // The closest accurate Schema.org category. Plumi is a study tool,
            // not a productivity or reference app.
            applicationCategory: "EducationalApplication",
            applicationSubCategory: "Study notebook and AI tutor",
            operatingSystem: "iPadOS 17 or later",
            inLanguage: "en-GB",
            publisher: { "@id": ORGANISATION_ID },
            audience: {
              "@type": "EducationalAudience",
              educationalRole: "student",
              audienceType: "GCSE and A-Level students",
            },
            featureList: [
              "Reads handwritten working on iPad",
              "Tutors directly on the page rather than in a separate chat",
              "Builds a model of demonstrated strengths and weaknesses",
              "Generates targeted practice from your own work",
              "Handwriting, folders and PDF annotation, free",
            ],
          },
        ],
      }}
    />
  );
}

/**
 * Per-page `WebPage` plus the breadcrumb trail that leads to it.
 *
 * The breadcrumb is what turns "tryplumi.app › ai-tutor-for-a-level-maths" in a
 * search result into something readable, and it tells the crawler the page is a
 * child of the homepage rather than an orphan.
 */
export function PageStructuredData({
  path,
  name,
  description,
  breadcrumb,
}: {
  path: string;
  name: string;
  description: string;
  /** Trail after Home, in order. The current page should be last. */
  breadcrumb: readonly { name: string; path: string }[];
}) {
  const trail = [{ name: "Home", path: "/" }, ...breadcrumb];

  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "WebPage",
            "@id": absoluteUrl(path),
            url: absoluteUrl(path),
            name,
            description,
            inLanguage: "en-GB",
            isPartOf: { "@id": WEBSITE_ID },
            about: { "@id": ORGANISATION_ID },
            primaryImageOfPage: { "@type": "ImageObject", url: absoluteUrl("/og.png") },
          },
          {
            "@type": "BreadcrumbList",
            "@id": `${absoluteUrl(path)}#breadcrumb`,
            itemListElement: trail.map((crumb, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: crumb.name,
              item: absoluteUrl(crumb.path),
            })),
          },
        ],
      }}
    />
  );
}

/**
 * `FAQPage` for a page that visibly shows these exact questions and answers.
 *
 * Google requires the marked-up Q&A to be present on the page — marking up FAQs
 * a visitor cannot see is a manual-action risk, so this takes the same array the
 * page renders rather than a separate copy that could drift.
 */
export function FaqStructuredData({
  path,
  faqs,
}: {
  path: string;
  faqs: readonly { question: string; answer: string }[];
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "@id": `${absoluteUrl(path)}#faq`,
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      }}
    />
  );
}
