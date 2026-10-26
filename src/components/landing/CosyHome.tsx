import Image from "next/image";
import Link from "next/link";
import { SectionImpressions } from "@/components/SectionImpressions";
import { AppStoreBadge } from "@/components/home/AppStoreBadge";
import { DiscordButton } from "@/components/cosy/DiscordButton";
import { CosyPage, FaqSchema, Soon, Spiral, WindowBar as Bar } from "@/components/cosy/Chrome";
import { cosyFaq, cosyHero, faqEyebrow, faqTitle, finale, friends, habit, marking, meet, more, practice, shelf } from "@/content/cosyHome";
import { bankPath, bankSubjects } from "@/content/questionBank";
import { packCopy, packPath, practicePacks } from "@/content/practicePacks";
import { PackCover, PackDownloads, PackLadder, PackLegend } from "@/components/practicePacks/Pack";
import { PackClickTracker } from "@/components/practicePacks/PackClickTracker";
import { PastPapersCard } from "@/components/practicePacks/PastPapersCard";
import { CafeHero, FriendsCafe, Look, MeetPlumi } from "./LandingClient";
import "@/app/landing.css";

/**
 * The homepage: the founder's cosy notebook design (19 October 2026). The whole page is
 * a sheet of ruled paper; sections are pinned cards, sticky notes and pixel windows on it.
 *
 *   HERO      the promise, the App Store badge, the two free tickets (question bank, past
 *             papers), the café: students studying, and you walking in to pull up a chair
 *             (LimeZu art, see cafeScene.ts)
 *   PRACTICE  the free question bank and past paper library on this site, each subject one
 *             tap away, and the Discord's daily question
 *   MARKING   a handwritten answer marked line by line, the three steps, the topic map
 *   MEET      Plumi and its moods
 *   FRIENDS   groups and the study hall
 *   HABIT     streaks, Pomodoros that block apps, the room you earn
 *   MORE      six sticky notes
 *   SUBJECTS  four books on a shelf, linking to their pages
 *   FAQ       the vetted answers
 *   CLOSE     the badge again, and the Discord
 *   BANK      every question bank subject, one column per exam board (the practice card
 *             names only the boards, so it stays short as subjects are added)
 *
 * No pricing (founder, 23 October 2026): see the note at the top of cosyHome.ts.
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

/** Every question in the bank, across its subjects. */
const bankQuestions = bankSubjects.reduce((n, s) => n + s.count, 0);

/** Boards and levels in the order students look for them; one added to the bank later goes at the end. */
const boardOrder = ["AQA", "Edexcel", "OCR", "OCR MEI", "Eduqas", "CAIE"];
const levelOrder = ["A-Level", "GCSE", "IGCSE"];
const byOrder = (order: string[]) => (a: string, b: string) => ((order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
const boardName: Record<string, string> = { CAIE: "Cambridge (CAIE)" };
/** Each board's colour: its column's header in the index, and the dot on its chip in the card. */
const boardColour: Record<string, string> = { AQA: "#a9cbeb", Edexcel: "#8fd0a0", OCR: "#eaa99a", "OCR MEI": "#f2c96b", Eduqas: "#c9b3e6", CAIE: "#7cc6c2" };
const boardStyle = (board: string) => ({ ["--board" as string]: boardColour[board] ?? "#d9c8ec" });
const boardId = (board: string) => `bank-${board.toLowerCase().replace(/\s+/g, "-")}`;

/**
 * The bank's subjects by board, then level: the card's board chips and the index at the foot
 * of the page. Read from the bank, so a subject added there shows up here with no edit.
 */
const bankBoards = [...new Set(bankSubjects.map(s => s.board))].sort(byOrder(boardOrder)).map(board => {
  const subjects = bankSubjects.filter(s => s.board === board);
  return {
    board,
    count: subjects.reduce((n, s) => n + s.count, 0),
    levels: [...new Set(subjects.map(s => s.level))].sort(byOrder(levelOrder)).map(level => ({
      level,
      subjects: subjects.filter(s => s.level === level).sort((a, b) => a.subject.localeCompare(b.subject)),
    })),
  };
});

/** Pixel icons for the hero's tickets, drawn on a 16px grid like the Discord key's. */
const QuestionIcon = () => <svg viewBox="0 0 16 16" aria-hidden="true" shapeRendering="crispEdges"><path fill="currentColor" d="M3 1h8l3 3v11H3zm1 1v12h9V5h-3V2zm2 5h5v1H6zm0 2h5v1H6zm0 2h3v1H6z" /></svg>;
const PackIcon = () => <svg viewBox="0 0 16 16" aria-hidden="true" shapeRendering="crispEdges"><path fill="currentColor" d="M3 1h10v14H3zm1 1v12h1V2zm2 0v12h6V2zm1 2h4v1H7zm0 2h4v1H7zm0 2h2v1H7z" /></svg>;

/** Five steps of a flame, one frozen and one missed: a week of streak. */
const flame = [["", 34], ["", 48], ["frz", 40], ["", 58], ["", 66], ["", 74], ["off", 30]] as const;

export function CosyHome({ variant }: { variant?: string }) {
  return (
    <CosyPage home variant={variant} after={<><SectionImpressions /><PackClickTracker /></>}>
      {/* HERO */}
      <section id="product" className="lp-hero lp-hero-cafe" aria-labelledby="hero-title" data-testid="hero-section">
        <div className="lp-wrap">
          <div className="lp-hero-copy">
            <span className="lp-eyebrow">{cosyHero.eyebrow}</span>
            <h1 id="hero-title" data-testid="hero-headline">{cosyHero.h1} <em>{cosyHero.h1em}</em></h1>
            <p className="lp-lead">{cosyHero.lead}</p>
            <div className="lp-cta-row">
              <AppStoreBadge placement="hero" height={56} showLine />
              <p className="lp-cta-note">{cosyHero.note}</p>
            </div>
            <div className="lp-tickets">
              <p>{cosyHero.freeLabel}</p>
              <a href="#practice-papers" className="lp-ticket pk-ticket" data-testid="hero-practice-papers-link">
                <i aria-hidden="true"><PackIcon /></i>
                <span><b>{practice.packs.ticket}</b><small>{practice.packs.ticketHero}</small></span>
                <span className="pk-new">New</span>
              </a>
              <Link href="/question-bank" className="lp-ticket" data-testid="hero-question-bank-link">
                <i aria-hidden="true"><QuestionIcon /></i>
                <span><b>{practice.bank.name}</b><small>{bankQuestions.toLocaleString("en-GB")} {practice.bank.hero}</small></span>
              </Link>
            </div>
          </div>
          <div>
            <div className="lp-card lp-window">
              <Bar label={cosyHero.window} />
              <CafeHero label={cosyHero.sceneLabel} />
            </div>
            <p className="lp-scene-hint">{cosyHero.hint}</p>
          </div>
        </div>
      </section>

      {/* FREE PRACTICE */}
      <section id="free-practice" className="lp-free" aria-labelledby="practice-title">
        <div className="lp-wrap">
          <div className="lp-sec-head">
            <span className="lp-eyebrow">{practice.eyebrow}</span>
            <h2 id="practice-title">{practice.title} <em>{practice.titleEm}</em></h2>
            <p className="lp-lead">{practice.lead}</p>
          </div>
          <div id="practice-papers" className="lp-card pk-feature" data-testid="practice-papers">
            <div className="lp-tape" aria-hidden="true" />
            <div className="pk-feature-copy">
              <span className="lp-tag">{practice.packs.tag}</span>
              <h3><Link href="/practice-papers" data-testid="practice-papers-link">{practice.packs.title} <em>{practice.packs.titleEm}</em></Link></h3>
              <p>{practice.packs.line}</p>
              <ul className="pk-proof">{packCopy.proof.map(p => <li key={p.title}>{tick}<span><b>{p.title}.</b> <span className="pk-proof-line">{p.line}</span></span></li>)}</ul>
              <Link href="/practice-papers" className="lp-btn pk-all">{practice.packs.all} ›</Link>
            </div>
            <div className="pk-feature-right">
              <ul className="pk-feature-packs">
                {practicePacks.map(p => (
                  <li key={p.slug} className="pk-feature-pack">
                    <Link href={packPath(p.slug)} className="pk-cover-link" aria-label={`${p.board}-style ${p.title} practice pack: ${practice.packs.inside}`}><PackCover pack={p} /></Link>
                    <PackLadder pack={p} />
                    <PackDownloads pack={p} placement="home" />
                    <p className="pk-disclaimer">{p.disclaimer}</p>
                  </li>
                ))}
              </ul>
              <PackLegend />
            </div>
            <PastPapersCard placement="home" strip />
          </div>
          <div className="lp-practice">
            <article className="lp-card lp-practice-card" data-testid="practice-question-bank">
              <span className="lp-tag">{bankQuestions.toLocaleString("en-GB")} questions</span>
              <h3><Link href="/question-bank" data-testid="practice-question-bank-link">{practice.bank.name}</Link></h3>
              <p>{practice.bank.line}</p>
              <p className="lp-bank-boards-label">{practice.bank.boardsLabel} <a href="#bank-subjects">{bankSubjects.length} subjects ↓</a></p>
              <ul className="lp-bank-chips" aria-label="Question bank exam boards">
                {bankBoards.map(b => <li key={b.board} style={boardStyle(b.board)}><a href={`#${boardId(b.board)}`}>{boardName[b.board] ?? b.board}</a></li>)}
              </ul>
              <Link href="/question-bank" className="lp-btn">{practice.bank.cta} ›</Link>
            </article>
            <aside className="lp-sticky lp-daily" aria-labelledby="daily-title">
              <div className="lp-tape" aria-hidden="true" />
              <h3 id="daily-title">{practice.discord.title}</h3>
              <p>{practice.discord.line}</p>
              <DiscordButton placement="practice" />
            </aside>
          </div>
          <p className="lp-bridge">{practice.bridge} <a href="#marking">{practice.bridgeLink} ›</a></p>
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
                <FriendsCafe label={friends.sceneLabel} session={friends.session} jar={friends.jar} />
              </div>
              <p className="lp-scene-hint">{friends.hint}</p>
            </div>
            <div className="lp-feature-list">
              {friends.features.map(f => (
                <div key={f.title} className="lp-card lp-feature">
                  <div className="lp-ic"><Look look={f.look} scale={2} top={5} rows={24} /></div>
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
                  {h.id === "room" && <div className="lp-outfits">{[4, 7, 11, 2].map(i => <Look key={i} look={i} scale={3} top={4} rows={28} />)}</div>}
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
              <li key={b.name} className="lp-shelf-book" style={{ background: b.colour, ["--book-h" as string]: `${b.height}px` }}>
                <Link href={b.href} className="lp-label" data-testid={`subject-${b.href.slice(1)}-link`}><b>{b.name}</b><small>{b.detail}</small><span className="lp-open" aria-hidden="true">Open ›</span></Link>
              </li>
            ))}
          </ul>
          <ul className="lp-boards" aria-label="Exam boards">{shelf.boards.map(b => <li key={b}>{b}</li>)}</ul>
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

      {/* EVERY SUBJECT IN THE QUESTION BANK */}
      <section id="bank-subjects" className="lp-bank-index" aria-labelledby="bank-index-title" data-testid="bank-index">
        <div className="lp-wrap">
          <div className="lp-sec-head">
            <span className="lp-eyebrow">{practice.bankIndex.eyebrow}</span>
            <h2 id="bank-index-title">{practice.bankIndex.title} <em>{practice.bankIndex.titleEm}</em></h2>
            <p className="lp-lead">{practice.bankIndex.lead}</p>
          </div>
          <div className="lp-bank-boards">
            {bankBoards.map(b => (
              <div key={b.board} id={boardId(b.board)} className="lp-bank-board" style={boardStyle(b.board)}>
                <div className="lp-tape" aria-hidden="true" />
                <header>
                  <h3>{b.board === "CAIE" ? "Cambridge" : b.board}</h3>
                  <small>{b.board === "CAIE" && "CAIE · "}{b.count.toLocaleString("en-GB")} questions</small>
                </header>
                {b.levels.map(l => (
                  <div key={l.level} className="lp-bank-level">
                    <h4>{l.level}</h4>
                    <ul>
                      {l.subjects.map(s => (
                        <li key={s.slug}>
                          <Link href={bankPath(s.slug)}><span>{s.subject}</span><i aria-hidden="true" /><small>{s.count.toLocaleString("en-GB")}<span className="sr-only"> questions</span></small></Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>
    </CosyPage>
  );
}
