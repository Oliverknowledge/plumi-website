import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { PageStructuredData } from "@/components/StructuredData";
import { AppStoreBadge } from "@/components/home/AppStoreBadge";
import { CosyPage, FaqSchema, SectionHead, Tape } from "@/components/cosy/Chrome";
import { intentFor } from "@/config/routes";
import { site } from "@/config/site";
import { metadataFor } from "@/lib/metadata";
import {
  parentsClose, parentsConcerns, parentsFaq, parentsFeatures, parentsHero, parentsMore, parentsStack,
  type ConcernId,
} from "@/content/parents";
import "@/app/pages.css";
import "@/app/parents.css";

/**
 * For parents and carers (rebuilt 23 October 2026): what Plumi is, shown on an iPad; why one
 * app beats the usual pile; the three things it does best, each with a real screen; the rest of
 * revision in a grid; then a parent's questions as tiles: a heading, one line, and a small
 * drawing of the answer. Every word is in src/content/parents.ts, which says where each claim
 * and picture comes from. The look is in parents.css.
 */

export const metadata = metadataFor("/parents");

const PATH = "/parents";

/* Small line drawings, in the notebook's brown ink. Decorative: every tile says it in words. */
const Ico = ({ children }: { children: ReactNode }) => (
  <svg className="lp-pa-ico" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);
const icons: Record<ConcernId | "mail", ReactNode> = {
  marking: <Ico><path d="M5 17l6 6L27 7" /></Ico>,
  boards: <Ico><path d="M6 6h14l6 6v14H6z" /><path d="M20 6v6h6M10 17h12M10 22h8" /></Ico>,
  work: <Ico><path d="M7 25l3-1 14-14-2-2L8 22z" /><path d="M19 7l4 4" /><path d="M5 29h22" /></Ico>,
  friends: <Ico><circle cx="11" cy="11" r="4" /><circle cx="22" cy="12" r="3.4" /><path d="M3 26c1-5 4-7 8-7s7 2 8 7M19 19c4 0 7 2 8 6" /></Ico>,
  data: <Ico><rect x="7" y="14" width="18" height="13" rx="3" /><path d="M11 14v-4a5 5 0 0110 0v4" /><circle cx="16" cy="20.5" r="1.6" /></Ico>,
  ads: <Ico><rect x="4" y="8" width="24" height="16" rx="3" /><path d="M6 28L26 4" /></Ico>,
  wellbeing: <Ico><path d="M16 27S5 20 5 12a5.5 5.5 0 0111-1.5A5.5 5.5 0 0127 12c0 8-11 15-11 15z" /></Ico>,
  device: <Ico><rect x="5" y="4" width="18" height="24" rx="3" /><path d="M27 6l-4 18 2 2 2-2z" /></Ico>,
  age: <Ico><rect x="5" y="6" width="22" height="20" rx="3" /><path d="M5 12h22M11 3v6M21 3v6" /></Ico>,
  mail: <Ico><rect x="4" y="7" width="24" height="18" rx="3" /><path d="M5 9l11 8 11-8" /></Ico>,
};

/** The drawing under each concern's line. */
function ConcernArt({ id }: { id: ConcernId }) {
  const c = parentsConcerns;
  switch (id) {
    case "marking":
      return (
        <div className="lp-pa-art lp-pa-marks" aria-hidden="true">
          <span className="lp-pa-mk is-ok">M1 ✓</span><span className="lp-pa-mk is-no">M2 ✗</span><span className="lp-pa-mk is-no">A1 ✗</span>
          <span className="lp-pa-ask">Is this what you wrote?</span>
        </div>
      );
    case "boards":
      return <ul className="lp-pa-art lp-pa-chips" aria-label="Exam boards">{c.boards.map(b => <li key={b}>{b}</li>)}</ul>;
    case "work":
      return (
        <div className="lp-pa-art lp-pa-signed">
          {/* The tutor's ladder, drawn in the marked card's hand: their slip, Plumi's question back, then their fix. */}
          <div className="lp-pa-sheet" role="img" aria-label={c.tutor.alt}>
            <p className="is-you is-wrong">∫ e<sup>2x</sup> dx = e<sup>2x</sup> + C</p>
            <p className="is-plumi">What’s the derivative of e<sup>2x</sup>?</p>
            <p className="is-you">d/dx (e<sup>2x</sup>) = 2e<sup>2x</sup> {tick}</p>
            <p className="is-plumi">So what undoes that 2?</p>
            <p className="is-you">∫ e<sup>2x</sup> dx = ½ e<sup>2x</sup> + C {tick}</p>
          </div>
          <PlumiMark mood="thinking" />
        </div>
      );
    case "friends":
      return (
        <div className="lp-pa-art">
          <span className="lp-pa-code" aria-label="A friend code looks like this: eight letters and numbers">{c.friends.code}</span>
          <ul className="lp-pa-chips is-small" aria-label="Chat rules">{c.friends.chips.map(t => <li key={t}>{t}</li>)}</ul>
        </div>
      );
    case "data":
      return (
        <div className="lp-pa-art">
          <ul className="lp-pa-chips is-ticks" aria-label="Their data">{c.data.map(t => <li key={t}>{t}</li>)}</ul>
          <Link className="lp-pa-more" href="/privacy">Privacy notice</Link>
        </div>
      );
    case "ads":
      return <div className="lp-pa-art lp-pa-zero" aria-hidden="true"><strong>0</strong><span>adverts</span></div>;
    case "wellbeing":
      return (
        <ul className="lp-pa-art lp-pa-lines" aria-label="Who the tutor shows them">
          {c.helplines.map(h => <li key={h.name}><b>{h.name}</b><span>{h.detail}</span></li>)}
        </ul>
      );
    case "device":
      return (
        <div className="lp-pa-art lp-pa-device">
          <svg viewBox="0 0 120 84" aria-hidden="true">
            <rect x="6" y="6" width="92" height="70" rx="9" fill="#fdf9f1" stroke="#5b4741" strokeWidth="3.5" />
            <rect x="14" y="14" width="76" height="54" rx="3" fill="#fff" stroke="#e2d6c2" strokeWidth="2" />
            <path d="M24 46c6-10 10 4 16-6s8 2 14-4" stroke="#1f3d8a" strokeWidth="3" fill="none" strokeLinecap="round" />
            <g transform="rotate(28 104 40)"><rect x="100" y="6" width="9" height="62" rx="4" fill="#fdf9f1" stroke="#5b4741" strokeWidth="3" /><path d="M100 68l4.5 10 4.5-10" fill="#5b4741" /></g>
          </svg>
          <span>{c.device}</span>
        </div>
      );
    case "age":
      return <div className="lp-pa-art lp-pa-age" aria-hidden="true"><span>Under 18</span><span>18 or over</span></div>;
  }
}

/** A red tick in the marker's hand, as on the homepage's marked page. */
const tick = <svg className="lp-pa-tick" viewBox="0 0 26 22" aria-hidden="true"><path d="M3 12 L10 19 L23 3" stroke="#d33a2f" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;

/** Plumi, perched on a corner of a piece of work at a tilt: its mark, so it's plain who marked or wrote it. */
const PlumiMark = ({ mood }: { mood: "happy" | "thinking" }) => (
  <Image className={`lp-pa-plumi is-${mood}`} src={`/landing/plumi-mood-${mood}.svg`} alt="" width={64} height={64} unoptimized />
);

/** An iPad, drawn: a dark bezel round a real screen. */
function IPad({ image, sizes, priority = false, className = "" }: {
  image: { src: string; w: number; h: number; alt: string }; sizes: string; priority?: boolean; className?: string;
}) {
  return (
    <div className={`lp-pa-ipad ${className}`.trim()}>
      <Image src={image.src} width={image.w} height={image.h} alt={image.alt} sizes={sizes} preload={priority} />
    </div>
  );
}

export default function Page() {
  const intent = intentFor(PATH);
  const h = parentsHero;
  return (
    <CosyPage after={
      <PageStructuredData path={PATH} name={intent.title} description={intent.description} breadcrumb={[{ name: "For parents", path: PATH }]} />
    }>
      {/* HERO: what it is, on an iPad */}
      <section className="lp-hero lp-pa-hero" aria-labelledby="parents-title">
        <div className="lp-wrap">
          <div className="lp-hero-copy">
            <span className="lp-eyebrow">{h.eyebrow}</span>
            <h1 id="parents-title">{h.title} <em>{h.titleEm}</em></h1>
            <p className="lp-lead">{h.lead}</p>
            <ul className="lp-pa-facts" aria-label="At a glance">{h.chips.map(c => <li key={c}>{c}</li>)}</ul>
            <div className="lp-cta-row">
              <AppStoreBadge placement="parents-hero" height={56} />
            </div>
          </div>
          <div className="lp-pa-hero-art">
            <IPad image={h.screen} priority sizes="(max-width: 980px) 92vw, 640px" />
            <figure className="lp-card lp-pa-marked">
              <Tape />
              <div className="lp-pa-marked-crop"><Image src={h.marked.src} width={h.marked.w} height={h.marked.h} alt={h.marked.alt} sizes="(max-width: 980px) 70vw, 340px" /></div>
              <figcaption>{h.markedLabel}</figcaption>
              <PlumiMark mood="happy" />
            </figure>
          </div>
        </div>
      </section>

      {/* WHY ONE APP: the usual pile against one notebook */}
      <section className="lp-pa-why" aria-labelledby="parents-why">
        <div className="lp-wrap">
          <SectionHead eyebrow={parentsStack.eyebrow} title={parentsStack.title} titleEm={parentsStack.titleEm} id="parents-why" />
          <div className="lp-pa-stack">
            <div className="lp-pa-pile">
              <span className="lp-pa-label">{parentsStack.beforeLabel}</span>
              <ul>{parentsStack.before.map(b => <li key={b}>{b}</li>)}</ul>
            </div>
            <span className="lp-pa-arrow" aria-hidden="true">→</span>
            <div className="lp-card lp-pa-one">
              <span className="lp-pa-label">{parentsStack.afterLabel}</span>
              <ul>
                {parentsStack.after.map(a => <li key={a.title}><b>{a.title}</b><span>{a.line}</span></li>)}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT IT DOES BEST: three rows, each with a real screen */}
      <section className="lp-pa-features" aria-label="What Plumi does">
        <div className="lp-wrap">
          {parentsFeatures.map((f, i) => (
            <article key={f.id} className={`lp-pa-feature${i % 2 ? " is-flip" : ""}`} aria-labelledby={`parents-${f.id}`}>
              <div className="lp-pa-feature-copy">
                <span className="lp-eyebrow">{f.eyebrow}</span>
                <h2 id={`parents-${f.id}`}>{f.title} <em>{f.titleEm}</em></h2>
                <p className="lp-lead">{f.line}</p>
                <ul className="lp-pa-points">{f.points.map(p => <li key={p}>{p}</li>)}</ul>
              </div>
              <IPad image={f.image} sizes="(max-width: 980px) 92vw, 620px" />
            </article>
          ))}
        </div>
      </section>

      {/* AND THE REST: four smaller screens */}
      <section aria-labelledby="parents-more">
        <div className="lp-wrap">
          <SectionHead eyebrow={parentsMore.eyebrow} title={parentsMore.title} titleEm={parentsMore.titleEm} id="parents-more" />
          <ul className="lp-pa-more-grid">
            {parentsMore.items.map(m => (
              <li key={m.id} className="lp-card lp-pa-more-card">
                <IPad image={m.image} className="is-small" sizes="(max-width: 620px) 88vw, (max-width: 980px) 44vw, 540px" />
                <h3>{m.title}</h3>
                <p>{m.line}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CONCERNS: nine tiles */}
      <section id="questions" aria-labelledby="parents-questions">
        <div className="lp-wrap">
          <SectionHead eyebrow={parentsConcerns.eyebrow} title={parentsConcerns.title} id="parents-questions" />
          <ul className="lp-pa-grid">
            {parentsConcerns.items.map(c => (
              <li key={c.id} className={`lp-card lp-pa-tile is-${c.id}`}>
                <div className="lp-pa-tile-head">
                  <span className="lp-pa-tile-ico">{icons[c.id]}</span>
                  <h3>{c.q}</h3>
                </div>
                <p>{c.a}</p>
                <ConcernArt id={c.id} />
              </li>
            ))}
          </ul>
        </div>
        <FaqSchema faq={parentsFaq} />
      </section>

      {/* CLOSE: the App Store, and a way to ask */}
      <section className="lp-final lp-pa-close" aria-labelledby="parents-close">
        <div className="lp-wrap">
          <div className="lp-card">
            <Image src="/landing/plumi-lofi-cozy-anim.svg" alt="Plumi, the app's mascot, cosy and smiling" width={130} height={130} unoptimized />
            <h2 id="parents-close">{parentsClose.title} <em>{parentsClose.titleEm}</em></h2>
            <p className="lp-lead">{parentsClose.line}</p>
            <div className="lp-cta-row lp-close-ctas"><AppStoreBadge placement="parents-footer" height={56} /></div>
            <p className="lp-pa-write"><span className="lp-pa-flow-ico" aria-hidden="true">{icons.mail}</span>{parentsClose.ask} <a href={`mailto:${site.contactEmail}`} data-testid="parents-contact-link">{site.contactEmail}</a></p>
          </div>
        </div>
      </section>
    </CosyPage>
  );
}
