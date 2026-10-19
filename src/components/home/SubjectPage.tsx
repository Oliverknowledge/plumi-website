import Image from "next/image";
import Link from "next/link";
import { SectionImpressions } from "@/components/SectionImpressions";
import { PageStructuredData } from "@/components/StructuredData";
import { CosyPage, FaqSchema, SectionHead, Tape, WindowBar } from "@/components/cosy/Chrome";
import { intentFor } from "@/config/routes";
import { AppStoreBadge } from "./AppStoreBadge";
import { SpecCard } from "./SpecCard";
import { hero as homeHero, prices } from "@/content/home";
import { specUnits } from "@/content/specs";
import { subjectPages, type SubjectPageContent } from "@/content/subjects";
import "@/app/pages.css";

/**
 * A subject revision page (Physics, Chemistry, Biology), in the cosy notebook like every
 * other page: the homepage's promise narrowed to one science, with every unit of every
 * specification Plumi tracks for it, at GCSE and A-Level, for AQA, OCR and Edexcel.
 * Every word is in src/content/subjects.ts; the captures are real ones, pinned to the
 * page as cards.
 */
export function SubjectPage({ content }: { content: SubjectPageContent }) {
  const specs = specUnits[content.name];
  const others = Object.values(subjectPages).filter(p => p.slug !== content.slug);
  return (
    <CosyPage style={{ ["--tone" as string]: content.tone }} after={<>
      <PageStructuredData image={`/og-${content.slug}.png`} path={content.path} name={intentFor(content.path).title} description={intentFor(content.path).description}
        breadcrumb={[{ name: `${content.name} revision`, path: content.path }]} />
      <SectionImpressions />
    </>}>
      <section className="lp-hero lp-sp-hero" aria-labelledby="subject-title">
        <div className="lp-wrap">
          <div className="lp-hero-copy">
            <h1 id="subject-title" className="lp-sp-title">
              <span className="lp-eyebrow">{content.eyebrow}</span>{" "}
              <span>{content.h1a}</span>{" "}
              <em>{content.h1b}</em>
            </h1>
            <p className="lp-lead"><span className="lp-sub-long">{content.sub}</span><span className="lp-sub-short">{content.subShort}</span></p>
            <div className="lp-cta-row">
              <AppStoreBadge placement={`${content.slug}-hero`} height={56} showLine />
            </div>
            <p className="lp-cta-note">{homeHero.note} <span className="lp-ipad-only">{homeHero.device}</span></p>
          </div>
          <div className="lp-sp-stage">
            {content.hero.kind === "ipad"
              ? (
                <div className="lp-card lp-window lp-sp-shot">
                  <WindowBar label={content.name} />
                  <div className="lp-sp-screen">
                    <Image src={content.hero.image} width={2000} height={1500} priority alt={content.hero.alt} sizes="(max-width: 980px) 92vw, 600px" />
                  </div>
                </div>
              )
              : (
                <figure className="lp-card lp-sp-figure">
                  <div className="lp-sp-paper"><Image src={content.hero.image} width={1200} height={900} priority alt={content.hero.alt} sizes="(max-width: 980px) 92vw, 560px" /></div>
                  <figcaption>{content.hero.caption}</figcaption>
                </figure>
              )}
            <figure className="lp-card lp-sp-loupe">
              <Tape />
              <Image src="/site/loupe-mark4.webp" width={885} height={148} sizes="(max-width: 980px) 88vw, 520px" priority
                alt="Close up of a handwritten Physics answer marked by Plumi: M2 crossed on the working and A1 crossed on the final value." />
              <figcaption><span className="lp-m is-needs">M2</span><span className="lp-m is-needs">A1</span>
                <span>{content.slug === "physics" ? "The 10 kΩ belongs on top of the fraction. That cost a method mark and the answer mark." : "A Physics answer, marked by Plumi. Your answers get their ticks on the lines you wrote them too."}</span></figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section id="how" aria-labelledby="steps-title">
        <div className="lp-wrap">
          <SectionHead eyebrow="How it marks" title={content.stepsTitle} id="steps-title" />
          <ol className="lp-sp-steps">
            {content.steps.map((s, i) => (
              <li key={s.title} className="lp-card lp-step">
                <span className="lp-num">{String(i + 1).padStart(2, "0")}</span>
                <h3>{s.title}</h3>
                <p>{s.line}</p>
              </li>
            ))}
          </ol>
          {content.figures.length > 1 && (
            <ul className="lp-sp-figs" aria-label={`Diagrams from Plumi ${content.name} questions`}>
              {content.figures.map(f => (
                <li key={f.image}>
                  <figure className="lp-card lp-sp-figure">
                    <div className="lp-sp-paper"><Image src={f.image} width={640} height={480} alt={f.alt} sizes="(max-width: 620px) 88vw, 340px" /></div>
                    <figcaption>{f.label}</figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section id="specification" aria-labelledby="spec-title">
        <div className="lp-wrap">
          <SectionHead eyebrow="Your specification" title="Your topic map follows your board’s units." id="spec-title"
            lead={`GCSE and A-Level ${content.name}, for AQA, OCR and Edexcel. Each topic in a unit gets its own square.`} />
          {(["GCSE", "A-Level"] as const).map(level => (
            <div key={level} className="lp-sp-level">
              <h3>{level} {content.name}</h3>
              <div className="lp-sp-specs">
                {specs.filter(s => s.level === level).map(s => <SpecCard key={s.code} board={s.board} code={s.code} units={s.units} />)}
              </div>
            </div>
          ))}
          <div className="lp-cta-row lp-sp-cta">
            <AppStoreBadge placement={`${content.slug}-spec`} height={52} />
            <p className="lp-cta-note">You choose your board the first time you open it.</p>
          </div>
        </div>
      </section>

      <section id="pricing" aria-labelledby="price-title">
        <div className="lp-wrap">
          <div className="lp-card lp-sp-price">
            <h2 id="price-title">What you get free each week.</h2>
            <ul className="lp-sp-tiles" aria-label="Free every week">
              {[["10", "answers marked"], ["5", "new practice questions"], ["12", "AI Pen answers"], ["1", "AI tutor session"]].map(([n, l]) => (
                <li key={l}><strong>{n}</strong><span>{l}</span></li>
              ))}
            </ul>
            <p className="lp-sp-pro">Pro is <strong>{prices.yearlyPerMonth} a month, billed yearly</strong>: {prices.yearly} a year, after {prices.trialDays}{" "}days free. Or {prices.monthly} a month, with no trial.</p>
            <div className="lp-cta-row"><AppStoreBadge placement={`${content.slug}-pricing`} height={52} /></div>
            <p className="lp-fine">Cancel any time in Settings. Needs an iPad with iPadOS 17 or later. <Link href="/#pricing">Compare Free and Pro</Link>.</p>
          </div>
        </div>
      </section>

      <section id="faq" aria-labelledby="faq-title">
        <div className="lp-wrap">
          <SectionHead title={`${content.name} questions`} id="faq-title" />
          <div className="lp-faq">
            {content.faq.map(f => <details key={f.q} data-testid="faq-item"><summary>{f.q}</summary><p>{f.a}</p></details>)}
          </div>
          <nav className="lp-sp-more" aria-label="Other subjects">
            <span>Also on Plumi:</span>
            {others.map(o => <Link key={o.slug} href={o.path}>{o.name} revision</Link>)}
            <Link href="/gcse-maths">GCSE Maths</Link>
            <Link href="/ai-tutor-for-a-level-maths">A-Level Maths</Link>
          </nav>
        </div>
        <FaqSchema faq={content.faq} />
      </section>
    </CosyPage>
  );
}
