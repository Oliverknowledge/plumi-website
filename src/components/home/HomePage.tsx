import type { ReactNode } from "react";
import Image from "next/image";
import { Caveat } from "next/font/google";
import Link from "next/link";
import { footerLinks } from "@/components/SiteFooter";
import { site } from "@/config/site";
import { SectionImpressions } from "@/components/SectionImpressions";
import { AppStoreBadge, HeaderDownload, HomeAnchor } from "./AppStoreBadge";
import { HomeMotion } from "./Motion";
import { Ring, Underline } from "./Doodles";
import { BentoDots } from "./BentoDots";
import { bento, close, faq, faqTitle, hero, identity, pain, pricing, questions, story, subjects, weak } from "@/content/home";
import "@/app/home.css";

/** The pencil voice of the doodle notes: a handwriting face, used for a few words only. */
const hand = Caveat({ subsets: ["latin"], weight: ["600"], variable: "--font-hand", display: "swap" });

/**
 * The homepage, in the order the ad tells it (plumi-ad-v90), then the rest of the app.
 *
 *   HERO        the promise, the badge, the marked page
 *   PAIN        screenshots into AI, and losing track of what you are weak at
 *   STORY       pinned iPad: write, marked, why, better
 *   WEAK        the topic map
 *   QUESTIONS   a question written on a gap, and the diagrams
 *   BENTO       notes, streaks, study time, Focus, friends, past papers
 *   IDENTITY    the habit, and the grade it builds towards
 *   SUBJECTS    four subjects, three boards
 *   PRICING     free, then Pro
 *   FAQ         what students and parents ask
 *   CLOSE       the badge again, and a QR code for a desktop visitor
 *
 * Every product image is a real capture from the app (see src/content/home.ts).
 */
export function IPad({ src, alt, priority = false, fit = "cover", className = "", sizes = "(max-width: 760px) 92vw, (max-width: 1200px) 60vw, 760px", children }: { src: string; alt: string; priority?: boolean; fit?: "cover" | "contain"; className?: string; sizes?: string; children?: ReactNode }) {
  return (
    <div className={`hp-ipad ${className}`}>
      <div className="hp-ipad-screen">
        <Image src={src} alt={alt} width={2000} height={1500} priority={priority}
          sizes={sizes}
          className={fit === "contain" ? "is-contain" : ""} />
        {children}
      </div>
    </div>
  );
}

/** The app's subject icons, drawn as plain strokes on the subject colour. */
function SubjectGlyph({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    Physics: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" fill="currentColor" />,
    Maths: <text x="12" y="16.5" textAnchor="middle" fontSize="11.5" fontWeight="700" fontStyle="italic" fill="currentColor" fontFamily="Georgia, serif">f(x)</text>,
    Chemistry: <path d="M9 3h6M10 3v6.2L4.8 18.4A1.8 1.8 0 0 0 6.4 21h11.2a1.8 1.8 0 0 0 1.6-2.6L14 9.2V3M7.5 15h9" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />,
    Biology: <path d="M5 19c0-8 5-14 15-15-1 10-7 15-15 15Zm0 0 7-7" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />,
  };
  return <span className="hp-subject-glyph" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24">{paths[name]}</svg></span>;
}

/** The app's topic square: a coloured tile with a glyph, so no state is colour alone. */
function TopicGlyph({ tone, glyph }: { tone: string; glyph: string }) {
  const paths: Record<string, ReactNode> = {
    alert: <><path d="M12 5 20 19H4Z" fill="#fff" /><path d="M12 10.2v4" stroke="var(--tone-c)" strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="16.6" r="1.1" fill="var(--tone-c)" /></>,
    half: <><circle cx="12" cy="12" r="6.2" fill="none" stroke="#fff" strokeWidth="2" /><path d="M12 5.8a6.2 6.2 0 0 1 0 12.4Z" fill="#fff" /></>,
    clock: <><circle cx="12" cy="12" r="6.2" fill="none" stroke="#fff" strokeWidth="2" /><path d="M12 8.6V12l2.4 1.6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></>,
    check: <path d="m7.5 12.4 3 3 6-6.4" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />,
    none: null,
  };
  return <svg className={`hp-topic ${tone}`} viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect width="24" height="24" rx="6" className="hp-topic-tile" />{paths[glyph]}</svg>;
}

/** Apple's footer: fine print first, then the links, then the line. */
export function HomeFooter() {
  return (
    <footer className="hp-footer">
      <div className="hp-wrap">
        <p className="hp-footer-fine">Plumi writes its own exam-style questions and mark schemes. It is not affiliated with or endorsed by AQA, OCR or Pearson Edexcel. iPad and Apple Pencil are trademarks of Apple Inc.</p>
        <div className="hp-footer-row">
          <Link href="/" data-testid="footer-home-link" aria-label="Plumi home" className="hp-footer-brand">
            <Image src="/site/app-icon.webp" alt="" width={22} height={22} /><span>Plumi</span>
          </Link>
          <nav aria-label="Footer navigation" className="hp-footer-links">
            {footerLinks.map(([label, href]) => (
              <Link key={label} href={href} data-testid={`footer-${label.toLowerCase().replaceAll(" ", "-")}-link`}>{label}</Link>
            ))}
          </nav>
        </div>
        <div className="hp-footer-base">
          <span>© 2026 Plumi. Made in the UK.</span>
          <a href={`mailto:${site.contactEmail}`} data-testid="footer-contact-link">{site.contactEmail}</a>
        </div>
      </div>
    </footer>
  );
}

export function HomePage({ variant }: { variant?: string }) {
  return (
    <div className={`hp ${hand.variable}`} data-variant={variant}>
      <HomeMotion />
      <header className="hp-nav">
        <nav aria-label="Main navigation" className="hp-nav-inner">
          <Link href="/" aria-label="Plumi home" className="hp-nav-brand" data-testid="header-home-link">
            <Image src="/site/app-icon.webp" alt="" width={28} height={28} className="hp-nav-icon" />
            <span className="hp-nav-name">Plumi</span>
          </Link>
          <div className="hp-nav-links">
            <a href="#how" data-testid="nav-how-link">How it marks</a>
            <a href="#features" data-testid="nav-features-link">Features</a>
            <a href="#pricing" data-testid="nav-pricing-link">Pricing</a>
            <a href="#faq" data-testid="nav-faq-link">FAQ</a>
          </div>
          <HeaderDownload />
        </nav>
      </header>

      <main id="main">
        {/* HERO */}
        <section className="hp-hero" data-testid="hero-section" aria-labelledby="hero-title">
          <div className="hp-wrap hp-hero-copy">
            <p className="hp-eyebrow hp-rise" style={{ ["--d" as string]: "0ms" }}>{hero.eyebrow}</p>
            <h1 id="hero-title" className="hp-hero-title" data-testid="hero-headline">
              <span className="hp-rise" style={{ ["--d" as string]: "80ms" }}>{hero.h1a}</span>{" "}
              <span className="hp-rise hp-blue hp-h1b" style={{ ["--d" as string]: "200ms" }}>{hero.h1b}<Underline className="hp-hero-underline" /></span>
            </h1>
            <p className="hp-hero-sub hp-rise" style={{ ["--d" as string]: "320ms" }}><span className="hp-sub-long">{hero.sub}</span><span className="hp-sub-short">{hero.subShort}</span></p>
            <div className="hp-hero-cta hp-rise" style={{ ["--d" as string]: "420ms" }}>
              <AppStoreBadge placement="hero" height={56} />
              <div className="hp-hero-qr" aria-hidden="true">
                <Image src="/site/qr-app-store.svg" alt="" width={56} height={56} unoptimized />
                <span>{hero.qr}</span>
              </div>
            </div>
            <p className="hp-hero-note hp-rise" style={{ ["--d" as string]: "480ms" }}>{hero.note} <span className="hp-ipad-only">{hero.device}</span></p>
            <HomeAnchor href="#how" label="See how it marks" placement="hero-how" className="hp-link hp-hero-how" />
          </div>
          <div className="hp-hero-stage">
            <IPad src="/site/shot-mark.webp" priority className="hp-hero-ipad"
              sizes="(max-width: 760px) 92vw, (max-width: 1100px) 90vw, 1040px"
              alt="Plumi on iPad: a handwritten A-Level Physics answer marked 3 out of 5, with ticks, crosses and the mark breakdown.">
              <span className="hp-ring" aria-hidden="true" style={{ left: `${hero.ring.x * 100}%`, top: `${hero.ring.y * 100}%`, width: `${hero.ring.w * 100}%`, height: `${hero.ring.h * 100}%` }} />
            </IPad>
            <figure className="hp-loupe hp-hero-loupe">
              <Image src={hero.zoom.image} width={hero.zoom.w} height={hero.zoom.h} alt={hero.zoom.alt} sizes="(max-width: 760px) 92vw, 520px" priority />
              <figcaption><span className="hp-mark-chip is-lost">M2</span><span className="hp-mark-chip is-lost">A1</span><span>{hero.zoom.caption}</span></figcaption>
            </figure>
          </div>
        </section>

        {/* PAIN */}
        <section className="hp-pain" aria-labelledby="pain-title" data-nav="dark">
          <div className="hp-wrap hp-narrow">
            <p className="hp-eyebrow is-dark" data-reveal>{pain.eyebrow}</p>
            <h2 id="pain-title" className="sr-only">{pain.lines.join(" ")}</h2>
            <div className="hp-pain-lines" aria-hidden="true">
              {pain.lines.map(line => <p key={line} data-lit className="hp-pain-line">{line}</p>)}
            </div>
            <p className="hp-pain-answer" data-reveal>{pain.answer}</p>
            <ul className="hp-contrast">
              {pain.contrast.map((c, i) => (
                <li key={c.title} data-reveal style={{ ["--d" as string]: `${i * 90}ms` }}>
                  <strong>{c.title}</strong><span>{c.line}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* STORY: pinned iPad */}
        <section id="how" className="hp-story" aria-labelledby="story-title" data-story data-active="write">
          <div className="hp-wrap">
            <div className="hp-story-grid">
              <div className="hp-story-left">
              <div className="hp-section-head hp-story-head" data-reveal>
                <p className="hp-eyebrow">{story.eyebrow}</p>
                <h2 id="story-title" className="hp-h2">{story.title}</h2>
              </div>
              <ol className="hp-story-steps">
                {story.steps.map(s => (
                  <li key={s.id} data-step={s.id} className="hp-step">
                    <p className="hp-step-kicker">{s.kicker}</p>
                    <h3 className="hp-h3">{s.title}</h3>
                    <p className="hp-body">{s.line}</p>
                    <figure className="hp-step-media hp-loupe">
                      <Image src={s.zoom.image} width={s.zoom.w} height={s.zoom.h} alt={s.alt} sizes="92vw" />
                    </figure>
                  </li>
                ))}
              </ol>
              </div>
              <div className="hp-story-stage" aria-hidden="true">
                <div className="hp-story-pin">
                  <div className="hp-story-device">
                    <div className="hp-ipad hp-story-ipad">
                      <div className="hp-ipad-screen">
                        {story.steps.map(s => (
                          <Image key={s.id} src={s.image} alt="" width={2000} height={1500} data-screen={s.id}
                            sizes="(max-width: 1200px) 55vw, 720px" className={s.fit === "contain" ? "is-contain" : ""} />
                        ))}
                      </div>
                    </div>
                    {story.steps.map(s => (
                      <figure key={s.id} className={`hp-loupe hp-story-loupe is-${s.id}`} data-loupe={s.id}>
                        <Image src={s.loupe.image} width={s.loupe.w} height={s.loupe.h} alt="" sizes="440px" />
                      </figure>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="hp-story-cta" data-reveal>
              <AppStoreBadge placement="story-end" height={52} />
              <p>{story.cta}</p>
            </div>
          </div>
        </section>

        {/* WEAK SPOTS */}
        <section id="features" className="hp-weak" aria-labelledby="weak-title">
          <div className="hp-wrap">
            <div className="hp-section-head is-center" data-reveal>
              <p className="hp-eyebrow">{weak.eyebrow}</p>
              <h2 id="weak-title" className="hp-h2">{weak.title}</h2>
              <p className="hp-lede">{weak.line}</p>
              <ul className="hp-legend" aria-label="How Plumi rates each topic">
                {weak.legend.map((l, i) => <li key={l.label}><TopicGlyph tone={l.tone} glyph={l.glyph} />{l.label}{i === 0 && <Ring className="hp-legend-ring" />}</li>)}
              </ul>
            </div>
            <figure className="hp-loupe hp-map-zoom">
              <Image src={weak.zoom.image} width={weak.zoom.w} height={weak.zoom.h} alt={weak.zoom.alt} sizes="92vw" />
            </figure>
            <figure className="hp-loupe hp-map-zoom">
              <Image src={weak.next.image} width={weak.next.w} height={weak.next.h} alt={weak.next.alt} sizes="92vw" />
              <figcaption>{weak.next.caption}</figcaption>
            </figure>
            <div data-reveal className="hp-zoom">
              <IPad src="/site/shot-map.webp" className="is-wide"
                alt="Plumi's course map for OCR A-Level Physics: every topic on the specification as a square coloured by how well you know it, with practice suggestions picked from it.">
                <span className="hp-ring" aria-hidden="true" style={{ left: `${weak.next.ring.x * 100}%`, top: `${weak.next.ring.y * 100}%`, width: `${weak.next.ring.w * 100}%`, height: `${weak.next.ring.h * 100}%` }} />
              </IPad>
              <p className="hp-map-caption"><span className="hp-map-caption-dot" />{weak.next.caption}</p>
            </div>
            <div className="hp-section-cta" data-reveal><AppStoreBadge placement="weak-end" height={48} /></div>
          </div>
        </section>

        {/* QUESTIONS */}
        <section className="hp-questions" aria-labelledby="q-title" data-nav="dark">
          <div className="hp-wrap">
            <div className="hp-section-head is-center" data-reveal>
              <p className="hp-eyebrow is-dark">{questions.eyebrow}</p>
              <h2 id="q-title" className="hp-h2">{questions.title}</h2>
              <p className="hp-lede">{questions.line}</p>
            </div>
            <ul className="hp-diagrams" aria-label="Examples of diagrams Plumi draws in its questions">
              {questions.diagrams.map((d, i) => (
                <li key={d.id} data-reveal style={{ ["--d" as string]: `${(i % 3) * 70}ms` }}>
                  <figure>
                    <div className="hp-diagram-paper">
                      <Image src={`/site/diagram-${d.id}.webp`} width={640} height={480} sizes="(max-width: 760px) 92vw, 340px"
                        alt={d.alt} />
                    </div>
                    <figcaption><span className="hp-diagram-subject">{d.subject}</span>{d.label}</figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* BENTO */}
        <section className="hp-bento-section" aria-labelledby="bento-title">
          <div className="hp-wrap">
            <div className="hp-section-head" data-reveal>
              <p className="hp-eyebrow">{bento.eyebrow}</p>
              <h2 id="bento-title" className="hp-h2">{bento.title}</h2>
            </div>
            <div className="hp-bento" id="hp-bento">
              {bento.tiles.map((t, i) => (
                <article key={t.id} className={`hp-tile hp-tile-${t.id}`} data-reveal style={{ ["--d" as string]: `${(i % 3) * 80}ms` }}>
                  <div className="hp-tile-copy">
                    <h3 className="hp-tile-title">{t.title}</h3>
                    <p className="hp-tile-line">{t.line}</p>
                  </div>
                  <div className="hp-tile-media">
                    <Image src={t.image} width={t.w} height={t.h} alt={t.alt} sizes="(max-width: 760px) 80vw, 640px" />
                  </div>
                </article>
              ))}
            </div>
            <BentoDots count={bento.tiles.length} target="hp-bento" />
          </div>
        </section>

        {/* IDENTITY */}
        <section className="hp-identity" aria-labelledby="id-title" data-nav="dark">
          <div className="hp-wrap hp-identity-grid">
            <div data-reveal>
              <p className="hp-eyebrow is-dark">{identity.eyebrow}</p>
              <h2 id="id-title" className="hp-h2 is-light">{identity.title}</h2>
              <p className="hp-lede is-light">{identity.line}</p>
            </div>
            <div className="hp-grade" data-reveal>
              <div className="hp-grade-card" role="img" aria-label="An example grade card: predicted A, current B, goal A star.">
                {identity.grades.map((g, i) => (
                  <div key={g.label} className="hp-grade-cell">
                    {i > 0 && <div className="hp-grade-rule" />}
                    <div className="hp-grade-col"><span>{g.label}</span><strong className={g.tone}>{g.value}</strong></div>
                  </div>
                ))}
              </div>
              <p className="hp-grade-caption">{identity.caption}</p>
              <Image src="/site/plumi-celebrating.webp" alt="" width={700} height={732} className="hp-grade-quill" />
            </div>
          </div>
        </section>

        {/* SUBJECTS */}
        <section className="hp-subjects" aria-labelledby="subjects-title">
          <div className="hp-wrap">
            <div className="hp-section-head is-center" data-reveal>
              <p className="hp-eyebrow">{subjects.eyebrow}</p>
              <h2 id="subjects-title" className="hp-h2">{subjects.title}</h2>
              <p className="hp-lede">{subjects.line}</p>
            </div>
            <ul className="hp-subject-grid">
              {subjects.list.map((s, i) => (
                <li key={s.name} className="hp-subject" data-reveal style={{ ["--d" as string]: `${i * 70}ms`, ["--tone" as string]: subjects.tones[s.name] }}>
                  <SubjectGlyph name={s.name} />
                  <span className="hp-subject-level">GCSE · A-Level</span>
                  <strong>{s.name}</strong>
                  <span className="hp-subject-detail">{s.detail}</span>
                  {"links" in s && (
                    <span className="hp-subject-links">
                      {s.links.map(l => <Link key={l.href} href={l.href} data-testid={`subject-${l.href.slice(1)}-link`}>{l.label} ›</Link>)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <ul className="hp-boards" aria-label="Exam boards" data-reveal>
              {subjects.boards.map(b => <li key={b}>{b}</li>)}
            </ul>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="hp-pricing" aria-labelledby="pricing-title">
          <div className="hp-wrap">
            <div className="hp-section-head is-center" data-reveal>
              <p className="hp-eyebrow">{pricing.eyebrow}</p>
              <h2 id="pricing-title" className="hp-h2">{pricing.title}</h2>
            </div>
            <div className="hp-plans">
              <article className="hp-plan" data-reveal>
                <h3 className="hp-plan-name">{pricing.free.name}</h3>
                <p className="hp-plan-price"><strong>{pricing.free.price}</strong> <span>{pricing.free.period}</span></p>
                <p className="hp-plan-lead">{pricing.free.lead}</p>
                <ul>{pricing.free.items.map(i => <li key={i}>{i}</li>)}</ul>
                <div className="hp-plan-cta"><AppStoreBadge placement="pricing-free" height={48} /></div>
              </article>
              <article className="hp-plan is-pro" data-reveal style={{ ["--d" as string]: "80ms" }}>
                <Image src="/site/plumi-encouraging.webp" alt="" width={700} height={732} sizes="72px" className="hp-perch hp-perch-pro" />
                <p className="hp-plan-badge">7 days free</p>
                <h3 className="hp-plan-name">{pricing.pro.name}</h3>
                <p className="hp-plan-price"><strong>{pricing.pro.price}</strong> <span>{pricing.pro.period}</span></p>
                <p className="hp-plan-billing">{pricing.pro.billing}<br />{pricing.pro.billing2}</p>
                <p className="hp-plan-lead">{pricing.pro.lead}</p>
                <ul>{pricing.pro.items.map(i => <li key={i}>{i}</li>)}</ul>
                <div className="hp-plan-cta"><AppStoreBadge placement="pricing" height={48} /></div>
              </article>
            </div>
            <p className="hp-small">{pricing.small}</p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="hp-faq" aria-labelledby="faq-title">
          <div className="hp-wrap hp-narrow">
            <h2 id="faq-title" className="hp-h2 hp-faq-title" data-reveal>{faqTitle}</h2>
            <div className="hp-faq-list">
              {faq.map(f => (
                <details key={f.q} className="hp-faq-item" data-testid="faq-item">
                  <summary>{f.q}<span className="hp-faq-plus" aria-hidden="true" /></summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faq.map(f => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
          }) }} />
        </section>

        {/* CLOSE */}
        <section id="close" className="hp-close" data-testid="community-section" aria-labelledby="close-title">
          <div className="hp-wrap hp-close-inner" data-reveal>
            <Image src="/site/app-icon.webp" alt="Plumi app icon" width={112} height={112} className="hp-close-icon" />
            <h2 id="close-title" className="hp-h2 is-xl">{close.title}</h2>
            <p className="hp-lede">{close.line}</p>
            <div className="hp-close-cta">
              <AppStoreBadge placement="close" height={56} />
              <div className="hp-qr">
                <Image src="/site/qr-app-store.svg" alt="QR code linking to Plumi on the App Store" width={92} height={92} unoptimized />
                <span>{close.qr}</span>
              </div>
            </div>
          </div>
        </section>
      </main>
      <HomeFooter />
      <SectionImpressions />
    </div>
  );
}
