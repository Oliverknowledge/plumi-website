import { absoluteUrl, entityDescription, launchDate, sameAs, site } from "@/config/site";

/**
 * JSON-LD, the honest subset.
 *
 * Structured data is how a crawler is told "the Plumi on this page is the same
 * Plumi as the one on that Discord, and it is a piece of educational software
 * for iPad" without having to infer it from prose. That is the entire job here.
 *
 * What is deliberately absent is as important as what is present. There is no
 * `aggregateRating`, no `review`, no `datePublished` on anything, and no
 * `award`. Plumi has not launched: it has no ratings and no reviews, and
 * inventing them is both a Google structured-data violation and the kind of
 * thing that is very hard to walk back.
 *
 * `offers` **is** here now that the prices are published, and it is three
 * entries rather than one. A single `price: 0` would misrepresent a product with
 * a paid tier, and a single `price: 135` would misrepresent one whose notebook
 * is free forever — so the free tier and both Pro plans are each stated, and
 * each carries `availabilityStarts`, because none of them can be bought until
 * the app is on the store. An offer without that date is a claim that a student
 * can pay today, which is not true until 25 September.
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
 * The site name Google prints above a search result.
 *
 * This is the block that decides whether a result is labelled "Plumi" or
 * "tryplumi.app", and it has two requirements that are easy to miss:
 *
 *   1. It must be on the **homepage**. Google derives one site name for the
 *      whole site and only reads it from the root URL, so putting this on every
 *      page achieves nothing and putting it only on subpages achieves less.
 *   2. Google's documented example is a **standalone** `WebSite` object, which
 *      is why this is its own script tag rather than another node inside the
 *      site-wide `@graph` below. `@graph` is valid JSON-LD and Google parses it,
 *      but there is no reason to make the one block whose formatting is
 *      load-bearing differ from the shape Google publishes.
 *
 * No `alternateName`. Google picks one name, and offering it a second candidate
 * ("Plumi Study") risks winning the wrong one — better to give one clear answer.
 *
 * Google recomputes site names on its own schedule and ignores requests to
 * hurry. This makes the signal unambiguous; it cannot make Google act on it.
 */
export function HomeStructuredData() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        name: site.name,
        url: site.domain,
        description: entityDescription,
        inLanguage: "en-GB",
        publisher: { "@id": ORGANISATION_ID },
        // No `potentialAction`/SearchAction: the site has no search box, and
        // claiming one produces a sitelinks searchbox that leads nowhere.
      }}
    />
  );
}

/**
 * The site-wide graph: who Plumi is, and what the product is.
 *
 * Rendered once in the root layout so every page carries it. A `@graph` keeps
 * it to a single script tag with the nodes cross-referenced by `@id`, which is
 * both smaller and easier for a parser to resolve than two loose blocks.
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
              audienceType: "A-Level and GCSE STEM students",
            },
            featureList: [
              "Reads handwritten working on iPad",
              "Tutors directly on the page rather than in a separate chat",
              "Builds a model of demonstrated strengths and weaknesses",
              "Generates targeted practice from your own work",
              "Handwriting, folders and PDF annotation, free",
            ],
            // The same three figures the Free & Pro chapter shows, in the same
            // order. If one changes, both change: a crawler being told a price
            // the page contradicts is worse than not telling it one.
            offers: [
              {
                "@type": "Offer",
                name: "Plumi Free",
                description:
                  "The notebook, free forever and never metered, plus a weekly allowance of the marking, tutoring and practice.",
                price: "0",
                priceCurrency: "GBP",
                availabilityStarts: launchDate,
              },
              {
                "@type": "Offer",
                name: "Plumi Pro, yearly",
                description: "Seven days free, then £135 a year.",
                price: "135.00",
                priceCurrency: "GBP",
                availabilityStarts: launchDate,
              },
              {
                "@type": "Offer",
                name: "Plumi Pro, monthly",
                description: "£20 a month. No free trial.",
                price: "20.00",
                priceCurrency: "GBP",
                availabilityStarts: launchDate,
              },
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
