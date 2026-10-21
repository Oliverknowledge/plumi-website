import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { PageStructuredData } from "@/components/StructuredData";
import { AppStoreBadge } from "@/components/home/AppStoreBadge";
import { CosyPage, FaqSchema, SectionHead, Spiral, Tape, WindowBar } from "@/components/cosy/Chrome";
import { intentFor } from "@/config/routes";
import { site } from "@/config/site";
import { metadataFor } from "@/lib/metadata";
import {
  parentsBuying, parentsClose, parentsConcerns, parentsContact, parentsFaq, parentsHero, parentsPrice, parentsSteps,
  type ConcernId,
} from "@/content/parents";
import "@/app/pages.css";
import "@/app/parents.css";

/**
 * For parents and carers. Students send a parent here from the app to ask for Plumi Pro,
 * so the page is the app shown, the price drawn, and a parent's questions as tiles: a
 * heading, one line, and a small drawing of the answer. Every word is in
 * src/content/parents.ts, which says where in the app each claim comes from.
 */

export const metadata = metadataFor("/parents");

const PATH = "/parents";

/* Small line drawings, in the notebook's brown ink. Decorative: every tile says it in words. */
const Ico = ({ children }: { children: ReactNode }) => (
  <svg className="lp-pa-ico" viewBox="0 0 32 32" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);
const icons: Record<ConcernId | "tap" | "ask" | "cancel" | "mail", ReactNode> = {
  marking: <Ico><path d="M5 17l6 6L27 7" /></Ico>,
  boards: <Ico><path d="M6 6h14l6 6v14H6z" /><path d="M20 6v6h6M10 17h12M10 22h8" /></Ico>,
  work: <Ico><path d="M7 25l3-1 14-14-2-2L8 22z" /><path d="M19 7l4 4" /><path d="M5 29h22" /></Ico>,
  friends: <Ico><circle cx="11" cy="11" r="4" /><circle cx="22" cy="12" r="3.4" /><path d="M3 26c1-5 4-7 8-7s7 2 8 7M19 19c4 0 7 2 8 6" /></Ico>,
  data: <Ico><rect x="7" y="14" width="18" height="13" rx="3" /><path d="M11 14v-4a5 5 0 0110 0v4" /><circle cx="16" cy="20.5" r="1.6" /></Ico>,
  ads: <Ico><rect x="4" y="8" width="24" height="16" rx="3" /><path d="M6 28L26 4" /></Ico>,
  wellbeing: <Ico><path d="M16 27S5 20 5 12a5.5 5.5 0 0111-1.5A5.5 5.5 0 0127 12c0 8-11 15-11 15z" /></Ico>,
  device: <Ico><rect x="5" y="4" width="18" height="24" rx="3" /><path d="M27 6l-4 18 2 2 2-2z" /></Ico>,
  age: <Ico><rect x="5" y="6" width="22" height="20" rx="3" /><path d="M5 12h22M11 3v6M21 3v6" /></Ico>,
  tap: <Ico><rect x="6" y="3" width="20" height="26" rx="3" /><path d="M12 17l3 3 6-7" /></Ico>,
  ask: <Ico><rect x="10" y="3" width="13" height="26" rx="3" /><path d="M14 25h5" /><path d="M13 13l2.5 2.5L20 11" /></Ico>,
  cancel: <Ico><circle cx="16" cy="16" r="11" /><path d="M11 16h10" /></Ico>,
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
        <div className="lp-pa-art lp-pa-shot">
          <Image src={c.tutor.src} width={c.tutor.w} height={c.tutor.h} alt={c.tutor.alt} sizes="(max-width: 620px) 150vw, 580px" />
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

export default function Page() {
  const intent = intentFor(PATH);
  const h = parentsHero;
  const p = parentsPrice;
  return (
    <CosyPage after={
      <PageStructuredData path={PATH} name={intent.title} description={intent.description} breadcrumb={[{ name: "For parents", path: PATH }]} />
    }>
      {/* HERO: what it is, shown */}
      <section className="lp-hero lp-pa-hero" aria-labelledby="parents-title">
        <div className="lp-wrap">
          <div className="lp-hero-copy">
            <span className="lp-eyebrow">{h.eyebrow}</span>
            <h1 id="parents-title">Plumi, explained <em>for parents.</em></h1>
            <p className="lp-lead">{h.lead}</p>
            <ul className="lp-pa-facts" aria-label="At a glance">{h.chips.map(c => <li key={c}>{c}</li>)}</ul>
            <div className="lp-cta-row">
              <AppStoreBadge placement="parents-hero" height={56} />
            </div>
          </div>
          <div className="lp-sp-stage">
            <div className="lp-card lp-window lp-sp-shot">
              <WindowBar label="Marked by Plumi" />
              <div className="lp-sp-screen">
                <Image src={h.image.src} width={h.image.w} height={h.image.h} alt={h.image.alt} preload sizes="(max-width: 980px) 92vw, 600px" />
              </div>
            </div>
            <figure className="lp-card lp-sp-loupe">
              <Tape />
              <Image src={h.zoom.src} width={h.zoom.w} height={h.zoom.h} alt={h.zoom.alt} sizes="(max-width: 980px) 88vw, 520px" />
              <figcaption><span className="lp-pa-mk is-ok">M1</span><span className="lp-m is-needs">M2</span><span className="lp-m is-needs">A1</span><span>{h.zoom.caption}</span></figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS: four real captures */}
      <section aria-labelledby="parents-steps">
        <div className="lp-wrap">
          <SectionHead eyebrow={parentsSteps.eyebrow} title={parentsSteps.title} id="parents-steps" />
          <ol className="lp-pa-steps">
            {parentsSteps.steps.map(s => (
              <li key={s.n} className="lp-card lp-pa-step">
                <div className="lp-pa-step-img"><Image src={s.image} width={s.w} height={s.h} alt={s.alt} sizes="(max-width: 620px) 88vw, (max-width: 980px) 44vw, 270px"
                  style={{ objectFit: s.fit, objectPosition: "pos" in s ? s.pos : "50% 50%" }} /></div>
                <span className="lp-num">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.line}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* PRICE: Free and Pro, then how buying works */}
      <section id="cost" aria-labelledby="parents-cost">
        <div className="lp-wrap">
          <SectionHead eyebrow={p.eyebrow} title={p.title} id="parents-cost" />
          <div className="lp-pa-plans">
            <div className="lp-card lp-pa-plan">
              <h3>{p.free.name}</h3>
              <p className="lp-pa-price">{p.free.price}</p>
              <ul className="lp-sp-tiles lp-pa-tiles" aria-label={p.free.tilesLabel}>
                {p.free.tiles.map(([n, l]) => <li key={l}><strong>{n}</strong><span>{l}</span></li>)}
              </ul>
              <p className="lp-pa-plan-note">{p.free.tilesLabel}. {p.free.note}</p>
            </div>
            <div className="lp-card lp-pa-plan is-pro">
              <Tape />
              <h3>{p.pro.name}</h3>
              <div className="lp-pa-options">
                <div className="lp-pa-option">
                  <p className="lp-pa-price">{p.pro.monthly.price}<small>{p.pro.monthly.period}</small></p>
                </div>
                <span className="lp-pa-or" aria-hidden="true">or</span>
                <div className="lp-pa-option">
                  <p className="lp-pa-price">{p.pro.yearly.price}<small>{p.pro.yearly.period}</small></p>
                  <span className="lp-tag">{p.pro.yearly.tag}</span>
                </div>
              </div>
              <ul className="lp-pa-ticks">{p.pro.items.map(i => <li key={i}>{i}</li>)}</ul>
              <p className="lp-pa-plan-note">{p.launch}</p>
            </div>
          </div>

          <div className="lp-card lp-pa-buy">
            <h3>{parentsBuying.title}</h3>
            <ol className="lp-pa-flow">
              {parentsBuying.steps.map((s, i) => (
                <li key={s.id}>
                  <span className="lp-pa-flow-ico">{icons[s.id]}</span>
                  <b><span className="lp-num">{String(i + 1).padStart(2, "0")}</span> {s.title}</b>
                  <span>{s.line}</span>
                </li>
              ))}
            </ol>
            <p className="lp-fine">{parentsBuying.fine}</p>
          </div>
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

      {/* CONTACT */}
      <section className="lp-pa-contact-sec" aria-labelledby="parents-contact">
        <div className="lp-wrap">
          <div className="lp-card lp-pa-contact">
            <span className="lp-pa-flow-ico">{icons.mail}</span>
            <div>
              <h2 id="parents-contact">{parentsContact.title}</h2>
              <p className="lp-lead">{parentsContact.line}</p>
            </div>
            <a className="lp-btn" href={`mailto:${site.contactEmail}`} data-testid="parents-contact-link">{site.contactEmail}</a>
          </div>
        </div>
      </section>

      {/* CLOSE */}
      <section className="lp-final" aria-labelledby="parents-close">
        <div className="lp-wrap">
          <div className="lp-card">
            <Spiral />
            <Image src="/landing/plumi-lofi-cozy-anim.svg" alt="Plumi, the app's mascot, cosy and smiling" width={150} height={150} unoptimized />
            <h2 id="parents-close">{parentsClose.title}</h2>
            <AppStoreBadge placement="parents-footer" height={56} />
          </div>
        </div>
      </section>
    </CosyPage>
  );
}
