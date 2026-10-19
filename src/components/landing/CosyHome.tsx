import Image from "next/image";
import Link from "next/link";
import { SectionImpressions } from "@/components/SectionImpressions";
import { AppStoreBadge } from "@/components/home/AppStoreBadge";
import { DiscordButton } from "@/components/cosy/DiscordButton";
import { CosyPage, FaqSchema, Soon, Spiral, WindowBar as Bar } from "@/components/cosy/Chrome";
import { cosyFaq, cosyHero, faqEyebrow, faqTitle, finale, friends, habit, marking, meet, more, plans, shelf } from "@/content/cosyHome";
import { HeroDialog, MeetPlumi, PixelPortrait, RoomScene } from "./LandingClient";
import "@/app/landing.css";

/**
 * The homepage: the founder's cosy notebook design (19 October 2026). The whole page is
 * a sheet of ruled paper; sections are pinned cards, sticky notes and pixel windows on it.
 *
 *   HERO      the promise, the App Store badge, your room at night (coming soon)
 *   MEET      Plumi and its moods
 *   MARKING   a handwritten answer marked line by line, the three steps, the topic map
 *   FRIENDS   groups (released) and the study hall (coming soon)
 *   HABIT     streaks, Pomodoros that block apps, the room you earn (coming soon)
 *   MORE      six sticky notes
 *   SUBJECTS  four books on a shelf, linking to their pages
 *   PRICING   Free and Pro
 *   FAQ       the vetted answers
 *   CLOSE     the badge again
 *
 * The header, footer and paper are shared with every other page (src/components/cosy).
 * Every word is in src/content/cosyHome.ts, which says where each claim comes from.
 * Every App Store link goes through AppStoreBadge / HeaderDownload, so campaign tokens,
 * the phone's "Send it to my iPad", analytics and the Ads conversion all still apply.
 */

const tick = <svg viewBox="0 0 26 22" aria-hidden="true"><path d="M3 12 L10 19 L23 3" stroke="#d33a2f" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const Ok = ({ marks }: { marks: string[] }) => <span className="lp-ok">{marks.map(m => <span key={m}>{tick}{m}</span>)}</span>;

/** The topic map's squares: the design's fixed pattern (a seeded LCG), so it is the same on every render. */
function squares(): string[] {
  let seed = 7;
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const fills = ["var(--lp-needs)", "var(--lp-rusty)", "var(--lp-dev)", "var(--lp-strong)", "#fff"];
  return Array.from({ length: 72 }, () => { const r = rnd(); return fills[r < .1 ? 0 : r < .34 ? 1 : r < .48 ? 2 : r < .84 ? 3 : 4]; });
}

/** Five steps of a flame, one frozen and one missed: a week of streak. */
const flame = [["", 34], ["", 48], ["frz", 40], ["", 58], ["", 66], ["", 74], ["off", 30]] as const;

export function CosyHome({ variant }: { variant?: string }) {
  return (
    <CosyPage home variant={variant} after={<SectionImpressions />}>
      {/* HERO */}
      <section id="product" className="lp-hero" aria-labelledby="hero-title" data-testid="hero-section">
        <div className="lp-wrap">
          <div className="lp-hero-copy">
            <span className="lp-eyebrow">{cosyHero.eyebrow}</span>
            <h1 id="hero-title" data-testid="hero-headline">{cosyHero.h1} <em>{cosyHero.h1em}</em></h1>
            <p className="lp-lead">{cosyHero.lead}</p>
            <div className="lp-cta-row">
              <AppStoreBadge placement="hero" height={56} showLine />
              <p className="lp-cta-note">{cosyHero.note}</p>
            </div>
          </div>
          <div>
            <div className="lp-card lp-window">
              <Bar label={cosyHero.window} />
              <RoomScene room="home" label={cosyHero.sceneLabel} />
              <HeroDialog />
            </div>
            <p className="lp-scene-hint">{cosyHero.hint} <Soon>{cosyHero.soon}</Soon></p>
          </div>
        </div>
      </section>

      {/* MEET PLUMI */}
      <section id="meet" aria-labelledby="meet-title">
        <div className="lp-wrap">
          <div className="lp-card lp-meet">
            <Spiral />
            <MeetPlumi />
            <div className="lp-meet-copy">
              <span className="lp-eyebrow">{meet.eyebrow}</span>
              <h2 id="meet-title">{meet.title} <em>{meet.titleEm}</em></h2>
              <p className="lp-lead">{meet.lead}</p>
              <ul className="lp-traits">
                {meet.traits.map(t => <li key={t.text}><i style={{ background: t.tone }} aria-hidden="true">{t.glyph}</i><span>{t.text}</span></li>)}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT MARKS */}
      <section id="marking" aria-labelledby="marking-title">
        <span id="how" className="lp-anchor" aria-hidden="true" />
        <div className="lp-wrap">
          <div className="lp-sec-head">
            <span className="lp-eyebrow">{marking.eyebrow}</span>
            <h2 id="marking-title">{marking.title} <em>{marking.titleEm}</em></h2>
            <p className="lp-lead">{marking.lead}</p>
          </div>
          <div className="lp-mark-grid">
            <div className="lp-page" role="img" aria-label={marking.pageLabel}>
              <div className="lp-stamp">{marking.stamp}</div>
              <p className="lp-q"><b>1</b>&nbsp; A ball is projected from a point O on horizontal ground with velocity (7<b>i</b> + 19.6<b>j</b>) m s<sup>−1</sup>. It passes through the point P, 21 m horizontally from O.</p>
              <div className="lp-part"><span>(a)</span><span>Find the speed and the angle of projection above the horizontal.</span><span>(3)</span></div>
              <div className="lp-hwl">u = √(7² + 19.6²) = 20.8 m s⁻¹ <Ok marks={["M1", "A1"]} /></div>
              <div className="lp-hwl is-wrong">θ = tan⁻¹(7 ÷ 19.6) = 19.7° <span className="lp-no">✗ A0</span></div>
              <div className="lp-note"><header><Image src="/landing/plumi-mood-thinking.svg" alt="" width={30} height={30} unoptimized />Plumi<span className="lp-m is-needs">A0</span></header>That’s the angle from the vertical. Above the horizontal it’s tan⁻¹(19.6 ÷ 7) = 70.3°.</div>
              <div className="lp-part"><span>(b)</span><span>Show that P is 14.7 m above the ground.</span><span>(3)</span></div>
              <div className="lp-hwl">t = 21 ÷ 7 = 3 s <Ok marks={["M1"]} /></div>
              <div className="lp-hwl">y = 19.6(3) − 4.9(3)² <Ok marks={["M1"]} /></div>
              <div className="lp-hwl">y = 58.8 − 44.1 = 14.7 m <Ok marks={["A1"]} /></div>
            </div>
            <div className="lp-steps">
              {marking.steps.map(s => (
                <div key={s.num} className="lp-card lp-step"><span className="lp-num">{s.num}</span><h3>{s.title}</h3><p>{s.line}</p></div>
              ))}
            </div>
          </div>
          <div className="lp-card lp-topicmap">
            <div>
              <h3>{marking.mapTitle}</h3>
              <p className="lp-map-line">{marking.mapLine}</p>
              <ul className="lp-legend" aria-label="How Plumi rates each topic">
                {marking.legend.map(l => <li key={l.label}><i style={{ background: l.fill }} aria-hidden="true" />{l.label}</li>)}
              </ul>
            </div>
            <div className="lp-squares" aria-hidden="true">{squares().map((fill, i) => <i key={i} style={{ background: fill }} />)}</div>
          </div>
        </div>
      </section>

      {/* STUDY WITH FRIENDS */}
      <section id="friends" className="lp-friends" aria-labelledby="friends-title">
        <div className="lp-wrap">
          <div className="lp-sec-head">
            <span className="lp-eyebrow">{friends.eyebrow}</span>
            <h2 id="friends-title">{friends.title} <em>{friends.titleEm}</em></h2>
            <p className="lp-lead">{friends.lead}</p>
          </div>
          <div className="lp-friends-grid">
            <div>
              <div className="lp-card lp-window">
                <Bar label={friends.window} />
                <RoomScene room="hall" label={friends.sceneLabel} />
                <div className="lp-dialog"><div className="lp-row1"><b>{friends.dialog}</b></div><div className="lp-tip"><span>{friends.dialogTip[0]}</span> {friends.dialogTip[1]}</div></div>
              </div>
              <p className="lp-scene-hint">{friends.hint} <Soon>{friends.soon}</Soon></p>
            </div>
            <div className="lp-feature-list">
              {friends.features.map(f => (
                <div key={f.title} className="lp-card lp-feature">
                  <div className="lp-ic"><PixelPortrait avatar={f.av} /></div>
                  <div><b>{f.title}{f.soon && <> <Soon /></>}</b><span>{f.line}</span></div>
                </div>
              ))}
              <DiscordButton placement="friends" />
            </div>
          </div>
        </div>
      </section>

      {/* HABIT */}
      <section id="habit" aria-labelledby="habit-title">
        <div className="lp-wrap">
          <div className="lp-sec-head">
            <span className="lp-eyebrow">{habit.eyebrow}</span>
            <h2 id="habit-title">{habit.title} <em>{habit.titleEm}</em></h2>
            <p className="lp-lead">{habit.lead}</p>
          </div>
          <div className="lp-habits">
            {habit.cards.map(h => (
              <div key={h.id} className="lp-card lp-habit">
                <div className="lp-art" aria-hidden="true">
                  {h.id === "streak" && <div className="lp-flame">{flame.map(([k, height], i) => <i key={i} className={k} style={{ height }} />)}</div>}
                  {h.id === "pomo" && <span className="lp-pomo">25:00</span>}
                  {h.id === "room" && <div className="lp-outfits">{[0, 1, 2, 3].map(i => <PixelPortrait key={i} outfit={i} />)}</div>}
                </div>
                <h3>{h.title}{h.soon && <> <Soon /></>}</h3>
                <p>{h.line}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ALSO IN THE NOTEBOOK */}
      <section id="more" aria-labelledby="more-title">
        <div className="lp-wrap">
          <div className="lp-sec-head">
            <span className="lp-eyebrow">{more.eyebrow}</span>
            <h2 id="more-title">{more.title} <em>{more.titleEm}</em></h2>
          </div>
          <div className="lp-notes-grid">
            {more.notes.map(n => <div key={n.title} className="lp-sticky"><div className="lp-tape" aria-hidden="true" /><h3>{n.title}</h3><p>{n.line}</p></div>)}
          </div>
        </div>
      </section>

      {/* SUBJECTS */}
      <section id="subjects" aria-labelledby="subjects-title">
        <div className="lp-wrap">
          <div className="lp-sec-head">
            <span className="lp-eyebrow">{shelf.eyebrow}</span>
            <h2 id="subjects-title">{shelf.title} <em>{shelf.titleEm}</em></h2>
            <p className="lp-lead">{shelf.lead}</p>
          </div>
          <ul className="lp-shelf">
            {shelf.books.map(b => (
              <li key={b.name} className="lp-book" style={{ background: b.colour, ["--book-h" as string]: `${b.height}px` }}>
                <Link href={b.href} className="lp-label" data-testid={`subject-${b.href.slice(1)}-link`}><b>{b.name}</b><small>{b.detail}</small><span className="lp-open" aria-hidden="true">Open ›</span></Link>
              </li>
            ))}
          </ul>
          <ul className="lp-boards" aria-label="Exam boards">{shelf.boards.map(b => <li key={b}>{b}</li>)}</ul>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" aria-labelledby="pricing-title">
        <div className="lp-wrap">
          <div className="lp-sec-head">
            <span className="lp-eyebrow">{plans.eyebrow}</span>
            <h2 id="pricing-title">{plans.title} <em>{plans.titleEm}</em></h2>
          </div>
          <div className="lp-plans">
            <article className="lp-card lp-plan">
              <h3>{plans.free.name}</h3>
              <p className="lp-price">{plans.free.price}<small>{plans.free.period}</small></p>
              <p className="lp-plan-lead">{plans.free.lead}</p>
              <ul>{plans.free.items.map(i => <li key={i}>{i}</li>)}</ul>
            </article>
            <article className="lp-card lp-plan is-pro">
              <span className="lp-tag">{plans.pro.tag}</span>
              <h3>{plans.pro.name}</h3>
              <p className="lp-price">{plans.pro.price}<small>{plans.pro.period}</small></p>
              <p className="lp-plan-lead">{plans.pro.lead}</p>
              <ul>{plans.pro.items.map(i => <li key={i}>{i}</li>)}</ul>
              <p className="lp-fine">{plans.pro.fine}</p>
            </article>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" aria-labelledby="faq-title">
        <div className="lp-wrap">
          <div className="lp-sec-head"><span className="lp-eyebrow">{faqEyebrow}</span><h2 id="faq-title">{faqTitle}</h2></div>
          <div className="lp-faq">
            {cosyFaq.map(f => <details key={f.q} data-testid="faq-item"><summary>{f.q}</summary><p>{f.a}</p></details>)}
          </div>
        </div>
        <FaqSchema faq={cosyFaq} />
      </section>

      {/* CLOSE */}
      <section id="close" className="lp-final" aria-labelledby="close-title" data-testid="community-section">
        <div className="lp-wrap">
          <div className="lp-card">
            <Spiral />
            <Image src="/landing/plumi-lofi-cozy-anim.svg" alt="Plumi, cosy and smiling" width={150} height={150} unoptimized />
            <h2 id="close-title">{finale.title} <em>{finale.titleEm}</em></h2>
            <p className="lp-lead">{finale.line}</p>
            <div className="lp-cta-row lp-close-ctas">
              <AppStoreBadge placement="close" height={56} />
              <DiscordButton placement="close" />
            </div>
          </div>
        </div>
      </section>
    </CosyPage>
  );
}
