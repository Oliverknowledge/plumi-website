import Image from "next/image";
import Link from "next/link";
import { SectionImpressions } from "@/components/SectionImpressions";
import { PageStructuredData } from "@/components/StructuredData";
import { intentFor } from "@/config/routes";
import { AppStoreBadge, HeaderDownload } from "./AppStoreBadge";
import { HomeFooter, IPad } from "./HomePage";
import { HomeMotion } from "./Motion";
import { SpecCard } from "./SpecCard";
import { Underline } from "./Doodles";
import { hero as homeHero, prices } from "@/content/home";
import { specUnits } from "@/content/specs";
import { subjectPages, type SubjectPageContent } from "@/content/subjects";
import "@/app/home.css";

/** Schema text with ordinary hyphens and spaces, as search engines read it. */
const plain = (text: string) => text.replace(/\u2011/g, "-").replace(/\u00a0/g, " ");

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
            <h1 id="subject-title" className="hp-hero-title is-subject">
              <span className="hp-eyebrow hp-h1-eyebrow hp-rise">{content.eyebrow}</span>{" "}
              <span className="hp-rise" style={{ ["--d" as string]: "80ms" }}>{content.h1a}</span>{" "}
              <span className="hp-rise hp-blue hp-h1b" style={{ ["--d" as string]: "200ms" }}>{content.h1b}<Underline className="hp-hero-underline" /></span>
            </h1>
            <p className="hp-hero-sub hp-rise" style={{ ["--d" as string]: "320ms" }}><span className="hp-sub-long">{content.sub}</span><span className="hp-sub-short">{content.subShort.split(". ").map((t, i, a) => <span key={i} className="hp-sub-line">{t}{i < a.length - 1 ? "." : ""}</span>)}</span></p>
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
                  <div className="hp-diagram-paper"><Image src={content.hero.image} width={1200} height={900} priority alt={content.hero.alt} sizes="(max-width: 760px) 92vw, 560px" /></div>
                  <figcaption>{content.hero.caption}</figcaption>
                </figure>
              )}
            <figure className="hp-loupe hp-hero-loupe hp-subject-loupe">
              <Image src="/site/loupe-mark4.webp" width={885} height={148} sizes="(max-width: 760px) 92vw, 480px" priority
                alt="Close up of a handwritten Physics answer marked by Plumi: M2 crossed on the working and A1 crossed on the final value." />
              <figcaption><span className="hp-mark-chip is-lost">M2</span><span className="hp-mark-chip is-lost">A1</span>
                <span>{content.slug === "physics" ? "The 10\u00a0kΩ belongs on top of the fraction. That cost a method mark and the answer mark." : "This one’s Physics. It lost a method mark and the answer mark on the lines you can see."}</span></figcaption>
            </figure>
          </div>
        </section>

        <section id="how" className="hp-subject-steps" aria-labelledby="steps-title">
          <div className="hp-wrap">
            <div className="hp-section-head is-center" data-reveal>
              <p className="hp-eyebrow">How it marks</p>
              <h2 id="steps-title" className="hp-h2">{content.stepsTitle}</h2>
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
              <h2 id="spec-title" className="hp-h2">Your topic map follows your board’s units.</h2>
              <p className="hp-lede">GCSE and A-Level {content.name}, for AQA, OCR and Edexcel. Each topic in a unit gets its own square.</p>
            </div>
            {(["GCSE", "A-Level"] as const).map(level => (
              <div key={level} className="hp-spec-level">
                <h3 className="hp-spec-level-title">{level} {content.name}</h3>
                <div className="hp-spec-grid">
                  {specs.filter(s => s.level === level).map(s => <SpecCard key={s.code} board={s.board} code={s.code} units={s.units} />)}
                </div>
              </div>
            ))}
            <div className="hp-section-cta is-stacked" data-reveal>
              <AppStoreBadge placement={`${content.slug}-spec`} height={52} />
              <p className="hp-small">You choose your board the first time you open it.</p>
            </div>
          </div>
        </section>

        <section id="pricing" className="hp-subject-pricing" aria-labelledby="price-title">
          <div className="hp-wrap hp-narrow is-center-text" data-reveal>
            <h2 id="price-title" className="hp-h2">What you get free each week.</h2>
            <ul className="hp-free-tiles" aria-label="Free every week">
              {[["10", "answers marked"], ["5", "new practice questions"], ["12", "AI Pen answers"], ["1", "AI tutor session"]].map(([n, l]) => (
                <li key={l}><strong>{n}</strong><span>{l}</span></li>
              ))}
            </ul>
            <p className="hp-pro-line">Pro is <strong>{prices.yearlyPerMonth} a month</strong>. Billed {prices.yearly} a year, after {prices.trialDays}{"\u00a0"}days free. Or {prices.monthly} a month, with no trial.</p>
            <div className="hp-section-cta"><AppStoreBadge placement={`${content.slug}-pricing`} height={52} /></div>
            <p className="hp-small">Cancel any time in Settings. Needs an iPad with iPadOS 17 or later. <Link href="/#pricing">Compare Free and Pro</Link>.</p>
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
            mainEntity: content.faq.map(f => ({ "@type": "Question", name: plain(f.q), acceptedAnswer: { "@type": "Answer", text: plain(f.a) } })),
          }).replace(/</g, "\\u003c") }} />
        </section>
      </main>
      <HomeFooter />
      <PageStructuredData image={`/og-${content.slug}.png`} path={content.path} name={intentFor(content.path).title} description={intentFor(content.path).description}
        breadcrumb={[{ name: `${content.name} revision`, path: content.path }]} />
      <SectionImpressions />
    </div>
  );
}
