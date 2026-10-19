import Image from "next/image";

import { AppStoreBadge } from "@/components/home/AppStoreBadge";
import { CosyPage, Spiral, Tape } from "@/components/cosy/Chrome";
import { PageStructuredData } from "@/components/StructuredData";
import { intentFor } from "@/config/routes";
import { activeCta } from "@/config/site";
import type { LandingContent } from "@/content/landing";
import "@/app/pages.css";

/**
 * The frame every intent landing page shares (A-Level Maths, GCSE Maths, Goodnotes,
 * About), in the cosy notebook like every other page.
 *
 * These pages exist to be found, so the constraints are different from the
 * homepage: the meaning has to be in HTML text rather than in an animation, the
 * H1 has to be singular and descriptive, and the page has to answer its query
 * above the fold rather than after a scroll narrative. The paper, header, footer,
 * type and keys are the homepage's, so a visitor arriving from Google onto
 * /gcse-maths and then clicking through to the homepage does not feel like they
 * changed websites.
 *
 * Deliberately absent: a wall of 2,000 generic words. Each section here earns
 * its place by answering something a real student asked, and the page ends as
 * soon as it has.
 */
export function MarketingPage({ content }: { content: LandingContent }) {
  const intent = intentFor(content.path);

  return (
    <CosyPage>
      <PageStructuredData
        path={content.path}
        name={intent.title}
        description={intent.description}
        breadcrumb={[{ name: content.breadcrumbLabel, path: content.path }]}
      />
      <article className="lp-mk">
        <header className="lp-wrap lp-mk-hero">
          <span className="lp-eyebrow">{content.eyebrow}</span>
          {/* One H1 per page, and it is the descriptive one. */}
          <h1>{intent.h1}</h1>
          <p className="lp-lead">{content.lead}</p>
          <div className="lp-cta-row">
            <AppStoreBadge placement={`${content.slug}-hero`} height={56} showLine />
            <p className="lp-cta-note">{activeCta.supporting}</p>
          </div>
        </header>

        <div className="lp-wrap lp-mk-list">
          {content.sections.map((section, i) => (
            <section key={section.heading} className={`lp-card lp-mk-sec${section.image?.maxWidth ? " has-side" : ""}`}
              style={section.image?.maxWidth ? { ["--side" as string]: `${Math.min(section.image.maxWidth, 520)}px` } : undefined}>
              {i % 2 === 1 && <Tape />}
              <div className="lp-mk-head">
                <span className="lp-num" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                <h2>{section.heading}</h2>
                <p className="lp-lead">{section.line}</p>
              </div>
              {section.image ? (
                <figure className="lp-mk-figure">
                  {/* Real capture, described factually in the alt text. An alt
                      that says "screenshot" tells a crawler and a screen reader
                      nothing; this one says what is actually in the picture. */}
                  <Image
                    src={section.image.src}
                    alt={section.image.alt}
                    width={section.image.width}
                    height={section.image.height}
                    sizes={section.image.maxWidth ? `(max-width: 700px) 92vw, ${section.image.maxWidth}px` : "(max-width: 700px) 92vw, 1000px"}
                  />
                  <figcaption>{section.image.caption}</figcaption>
                </figure>
              ) : null}
            </section>
          ))}
        </div>

        <section className="lp-final lp-mk-close">
          <div className="lp-wrap">
            <div className="lp-card">
              <Spiral />
              <Image src="/landing/plumi-lofi-cozy-anim.svg" alt="Plumi, cosy and smiling" width={150} height={150} unoptimized />
              <h2>{content.closing}</h2>
              <AppStoreBadge placement={`${content.slug}-footer`} height={56} />
            </div>
          </div>
        </section>
      </article>
    </CosyPage>
  );
}
