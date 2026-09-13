import Image from "next/image";
import Link from "next/link";

import { CtaButton } from "@/components/ui/CtaButton";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { FaqStructuredData, PageStructuredData } from "@/components/StructuredData";
import { intentFor } from "@/config/routes";
import type { LandingContent } from "@/content/landing";

/**
 * The frame every intent landing page shares.
 *
 * These pages exist to be found, so the constraints are different from the
 * homepage: the meaning has to be in HTML text rather than in an animation, the
 * H1 has to be singular and descriptive, and the page has to answer its query
 * above the fold rather than after a scroll narrative. What it borrows from the
 * homepage is the type scale, the colour tokens and the container — so a
 * visitor arriving from Google onto /gcse-maths and then clicking through to
 * the homepage does not feel like they changed websites.
 *
 * Deliberately absent: a wall of 2,000 generic words. Each section here earns
 * its place by answering something a real student asked, and the page ends as
 * soon as it has.
 */
export function MarketingPage({ content }: { content: LandingContent }) {
  const intent = intentFor(content.path);
  const related = intent.linksTo.map(intentFor);

  return (
    <>
      <SiteHeader />
      <PageStructuredData
        path={content.path}
        name={intent.title}
        description={intent.description}
        breadcrumb={[{ name: content.breadcrumbLabel, path: content.path }]}
      />
      {content.faqs ? <FaqStructuredData path={content.path} faqs={content.faqs} /> : null}

      <main id="main">
        <article className="container-plumi pt-[calc(var(--header-height)+3.5rem)] pb-24 sm:pb-32">
          <header className="measure-wide">
            <p className="eyebrow">{content.eyebrow}</p>
            {/* One H1 per page, and it is the descriptive one. */}
            <h1 className="mt-4 text-h1 font-medium text-balance">{intent.h1}</h1>
            <p className="mt-6 text-lead text-[var(--color-ink-secondary)] text-pretty">{content.lead}</p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <CtaButton placement={`${content.slug}-hero`} size="large" />
              <span className="text-sm text-[var(--color-ink-tertiary)]">Launching 25 September 2026</span>
            </div>
          </header>

          {content.sections.map((section) => (
            <section key={section.heading} className="mt-20 sm:mt-24">
              <h2 className="measure-wide text-h2 font-medium text-balance">{section.heading}</h2>

              <div className="measure mt-6">
                {section.body.map((paragraph) => (
                  <p key={paragraph} className="mt-4 text-[var(--color-ink-secondary)] text-pretty first:mt-0">
                    {paragraph}
                  </p>
                ))}

                {section.bullets ? (
                  <ul className="mt-6 space-y-3">
                    {section.bullets.map((item) => (
                      <li
                        key={item}
                        className="relative pl-6 text-[var(--color-ink-secondary)] text-pretty before:absolute before:top-[0.6em] before:left-1 before:h-1.5 before:w-1.5 before:rounded-full before:bg-[var(--color-blue-600)]"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              {section.image ? (
                <figure className="mt-10 overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-hairline)] bg-[var(--color-fill)] p-2 sm:p-3">
                  {/* Real capture, described factually in the alt text. An alt
                      that says "screenshot" tells a crawler and a screen reader
                      nothing; this one says what is actually in the picture. */}
                  <Image
                    src={section.image.src}
                    alt={section.image.alt}
                    width={section.image.width}
                    height={section.image.height}
                    sizes="(max-width: 700px) 92vw, 1100px"
                    className="h-auto w-full rounded-[calc(var(--radius-card)-0.25rem)]"
                  />
                  <figcaption className="px-2 pt-3 pb-1 text-center text-xs text-[var(--color-ink-tertiary)]">
                    {section.image.caption}
                  </figcaption>
                </figure>
              ) : null}
            </section>
          ))}

          {content.faqs ? (
            <section className="mt-20 sm:mt-24">
              <h2 className="text-h2 font-medium text-balance">Questions students ask</h2>
              <dl className="measure-wide mt-8">
                {content.faqs.map((faq) => (
                  <div key={faq.question} className="mt-8 border-t border-[var(--color-hairline)] pt-6 first:mt-0">
                    <dt className="text-h3 font-medium">{faq.question}</dt>
                    <dd className="mt-3 text-[var(--color-ink-secondary)] text-pretty">{faq.answer}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {/* Internal links, generated from the route registry so they cannot
              point at a page that no longer exists, with the destination's own
              title as the anchor text rather than "read more". */}
          <nav className="mt-20 border-t border-[var(--color-hairline)] pt-10 sm:mt-24" aria-labelledby="keep-reading">
            <h2 id="keep-reading" className="eyebrow">Keep reading</h2>
            <ul className="mt-6 grid gap-x-10 gap-y-4 sm:grid-cols-2">
              {related.map((route) => (
                <li key={route.path}>
                  <Link
                    href={route.path}
                    className="group block py-1 text-[var(--color-ink)] transition-colors hover:text-[var(--color-blue-600)]"
                    data-testid={`related-${route.path.replaceAll("/", "") || "home"}-link`}
                  >
                    <span className="font-medium">{route.path === "/" ? "Plumi, the AI study notebook" : route.h1}</span>
                    <span className="mt-1 block text-sm text-[var(--color-ink-tertiary)] text-pretty">{route.description}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <section className="mt-16 rounded-[var(--radius-card)] bg-[var(--color-blue-600)] px-6 py-12 text-center sm:px-12 sm:py-16">
            <h2 className="text-h3 font-medium text-balance text-[var(--color-ink-inverse)]">{content.closing}</h2>
            <div className="mt-7 flex justify-center">
              <CtaButton placement={`${content.slug}-footer`} size="large" className="!bg-[var(--color-paper)] !text-[var(--color-blue-600)]" />
            </div>
            <p className="mt-5 text-xs text-[var(--color-blue-100)]">
              Plumi hasn&rsquo;t launched yet. The community is where you see it first.
            </p>
          </section>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
