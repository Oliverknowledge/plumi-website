import Image from "next/image";
import Link from "next/link";
import { SectionImpressions } from "@/components/SectionImpressions";
import { PageStructuredData } from "@/components/StructuredData";
import { intentFor } from "@/config/routes";
import { AppStoreBadge, HeaderDownload } from "./AppStoreBadge";
import { HomeFooter, IPad } from "./HomePage";
import { HomeMotion } from "./Motion";
import { Underline } from "./Doodles";
import { hero as homeHero, prices } from "@/content/home";
import { specUnits } from "@/content/specs";
import { subjectPages, type SubjectPageContent } from "@/content/subjects";
import "@/app/home.css";

/**
 * A subject revision page (Physics, Chemistry, Biology): the homepage's design and
 * promise, narrowed to one science, with every unit of every specification Plumi
 * tracks for it, at GCSE and A-Level, for AQA, OCR and Edexcel.
 */
export function SubjectPage({ content }: { content: SubjectPageContent }) {
  const specs = specUnits[content.name];
  const others = Object.values(subjectPages).filter(p => p.slug !== content.slug);
  return (
    <div className="hp" style={{ ["--tone" as string]: content.tone }}>
      <HomeMotion />
      <header className="hp-nav">
        <nav aria-label="Main navigation" className="hp-nav-inner">
          <Link href="/" aria-label="Plumi home" className="hp-nav-brand" data-testid="header-home-link">
            <Image src="/site/app-icon.webp" alt="" width={28} height={28} className="hp-nav-icon" />
            <span className="hp-nav-name">Plumi</span>
          </Link>
          <div className="hp-nav-links">
            <a href="#how">How it marks</a>
            <a href="#specification">Specification</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </div>
          <HeaderDownload />
        </nav>
      </header>

      <main id="main">
        <section className="hp-hero hp-subject-hero" aria-labelledby="subject-title">
          <div className="hp-wrap hp-hero-copy">
            <p className="hp-eyebrow hp-rise">{content.eyebrow}</p>
            <h1 id="subject-title" className="hp-hero-title is-subject">
              <span className="hp-rise" style={{ ["--d" as string]: "80ms" }}>{content.h1a}</span>{" "}
              <span className="hp-rise hp-blue hp-h1b" style={{ ["--d" as string]: "200ms" }}>{content.h1b}<Underline className="hp-hero-underline" /></span>
            </h1>
            <p className="hp-hero-sub hp-rise" style={{ ["--d" as string]: "320ms" }}>{content.sub}</p>
            <div className="hp-hero-cta hp-rise" style={{ ["--d" as string]: "420ms" }}>
              <AppStoreBadge placement={`${content.slug}-hero`} height={56} showLine />
              <div className="hp-hero-qr" aria-hidden="true">
                <Image src="/site/qr-app-store.svg" alt="" width={56} height={56} unoptimized />
                <span>{homeHero.qr}</span>
              </div>
            </div>
            <p className="hp-hero-note hp-rise" style={{ ["--d" as string]: "480ms" }}>{homeHero.note} <span className="hp-ipad-only">{homeHero.device}</span></p>
          </div>
          <div className="hp-hero-stage">
            {content.hero.kind === "ipad"
              ? <IPad src={content.hero.image} priority alt={content.hero.alt} sizes="(max-width: 760px) 92vw, (max-width: 1100px) 90vw, 1040px" />
              : (
                <figure className="hp-subject-figure">
                  <div className="hp-diagram-paper"><Image src={content.hero.image} width={1200} height={900} priority alt={content.hero.alt} sizes="(max-width: 760px) 92vw, 760px" /></div>
                  <figcaption>{content.hero.caption}</figcaption>
                </figure>
              )}
          </div>
        </section>

        <section id="how" className="hp-subject-steps" aria-labelledby="steps-title">
          <div className="hp-wrap">
            <div className="hp-section-head is-center" data-reveal>
              <p className="hp-eyebrow">How it marks</p>
              <h2 id="steps-title" className="hp-h2">{content.name}, marked line by line.</h2>
            </div>
            <ol className="hp-steps-row">
              {content.steps.map((s, i) => (
                <li key={s.title} data-reveal style={{ ["--d" as string]: `${i * 90}ms` }}>
                  <span className="hp-step-num">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="hp-tile-title">{s.title}</h3>
                  <p className="hp-tile-line">{s.line}</p>
                </li>
              ))}
            </ol>
            {content.figures.length > 1 && (
              <ul className="hp-diagrams is-light" aria-label={`Diagrams from Plumi ${content.name} questions`}>
                {content.figures.map(f => (
                  <li key={f.image} data-reveal>
                    <figure>
                      <div className="hp-diagram-paper"><Image src={f.image} width={640} height={480} alt={f.alt} sizes="(max-width: 760px) 92vw, 340px" /></div>
                      <figcaption>{f.label}</figcaption>
                    </figure>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section id="specification" className="hp-spec" aria-labelledby="spec-title">
          <div className="hp-wrap">
            <div className="hp-section-head is-center" data-reveal>
              <p className="hp-eyebrow">Your specification</p>
              <h2 id="spec-title" className="hp-h2">Every unit, tracked.</h2>
              <p className="hp-lede">GCSE and A-Level {content.name}, for AQA, OCR and Edexcel. Pick your board and Plumi tracks every topic in it.</p>
            </div>
            {(["GCSE", "A-Level"] as const).map(level => (
              <div key={level} className="hp-spec-level">
                <h3 className="hp-spec-level-title">{level} {content.name}</h3>
                <div className="hp-spec-grid">
                  {specs.filter(s => s.level === level).map(s => (
                    <article key={s.code} className="hp-spec-card" data-reveal>
                      <header><strong>{s.board}</strong><span>{s.code}</span></header>
                      <ul>{s.units.map(u => <li key={u}>{u}</li>)}</ul>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="hp-subject-pricing" aria-labelledby="price-title">
          <div className="hp-wrap hp-narrow is-center-text" data-reveal>
            <h2 id="price-title" className="hp-h2">Free to start.</h2>
            <p className="hp-lede">10 answers marked, 5 practice questions, 12 AI Pen answers and 1 tutor session every week, free. Pro is {prices.yearly} a year with {prices.trialDays} days free first, or {prices.monthly} a month.</p>
            <div className="hp-section-cta"><AppStoreBadge placement={`${content.slug}-pricing`} height={52} showLine /></div>
            <p className="hp-small">Needs an iPad with iPadOS 17 or later. <Link href="/#pricing">See everything in Free and Pro</Link>.</p>
          </div>
        </section>

        <section id="faq" className="hp-faq" aria-labelledby="faq-title">
          <div className="hp-wrap hp-narrow">
            <h2 id="faq-title" className="hp-h2" data-reveal>{content.name} questions</h2>
            <div className="hp-faq-list">
              {content.faq.map(f => (
                <details key={f.q} className="hp-faq-item" data-testid="faq-item">
                  <summary>{f.q}<span className="hp-faq-plus" aria-hidden="true" /></summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
            <nav className="hp-subject-more" aria-label="Other subjects">
              <span>Also on Plumi:</span>
              {others.map(o => <Link key={o.slug} href={o.path}>{o.name} revision</Link>)}
              <Link href="/gcse-maths">GCSE Maths</Link>
              <Link href="/ai-tutor-for-a-level-maths">A-Level Maths</Link>
            </nav>
          </div>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: content.faq.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
          }).replace(/</g, "\\u003c") }} />
        </section>
      </main>
      <HomeFooter />
      <PageStructuredData path={content.path} name={intentFor(content.path).title} description={intentFor(content.path).description}
        breadcrumb={[{ name: `${content.name} revision`, path: content.path }]} />
      <SectionImpressions />
    </div>
  );
}
