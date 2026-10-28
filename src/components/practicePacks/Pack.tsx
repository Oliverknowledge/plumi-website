import Link from "next/link";
import { Tape } from "@/components/cosy/Chrome";
import { display } from "@/content/pastPapers";
import { packCopy, packFile, packFileName, packLevels, packPath, practicePacks, type PackLevel, type PracticePack } from "@/content/practicePacks";
import { PackClickTracker } from "./PackClickTracker";
import "@/app/practice-packs.css";

/**
 * The pieces every practice pack placement shares: the booklet cover drawn in CSS, the
 * difficulty ladder, the two download buttons and the small card beside past papers.
 * The disclaimer travels with the cover, so a pack is never shown as the board's own.
 */

export const levelClass = (l: PackLevel) => `pk-lv-${l.toLowerCase().replace(" ", "-")}`;

/** The pack as an exam booklet, in its subject's colour, with the FREE stamp. */
export function PackCover({ pack, small = false }: { pack: PracticePack; small?: boolean }) {
  return (
    <div className={`pk-cover${small ? " pk-cover-sm" : ""}`} style={{ ["--pk" as string]: pack.colour }} aria-hidden="true">
      <Tape />
      <span className="pk-cover-kicker">Plumi practice pack</span>
      <b className="pk-cover-title">{display(pack.title)}</b>
      <span className="pk-cover-board">{pack.board}-style · {pack.spec}</span>
      <span className="pk-cover-meta">{pack.questions.length} questions · {pack.marks} marks</span>
      <span className="pk-cover-lines"><i /><i /><i /></span>
      <span className="pk-stamp">Free</span>
    </div>
  );
}

/** Thirty squares, one per question, a row per section, coloured by how hard it is. */
export function PackLadder({ pack, legend = false }: { pack: PracticePack; legend?: boolean }) {
  return (
    <div className="pk-ladder">
      <div className="pk-ladder-rows" role="img" aria-label={`${pack.questions.length} questions in ${pack.sections.length} sections, each climbing from Easy to Super hard`}>
        {pack.sections.map(s => (
          <div key={s.letter} className="pk-ladder-row">
            <span>{s.letter}</span>
            {pack.questions.filter(q => q.section === s.letter).map(q => <i key={q.n} className={levelClass(q.level)} title={`Q${q.n} · ${q.level} · ${q.topic}`} />)}
          </div>
        ))}
      </div>
      {legend && <PackLegend />}
    </div>
  );
}

/** What the ladder's colours mean. */
export const PackLegend = () => <ul className="pk-legend" aria-label="Difficulty">{packLevels.map(l => <li key={l}><i className={levelClass(l)} />{l}</li>)}</ul>;

/** The questions and the mark scheme, each one tap, tracked as `pack_downloaded`. */
export function PackDownloads({ pack, placement }: { pack: PracticePack; placement: string }) {
  const file = (f: "questions" | "mark-scheme", label: string, primary: boolean) => (
    <a href={packFile(pack, f)} download={packFileName(pack, f)} target="_blank" rel="noopener"
      className={`lp-btn pk-dl${primary ? " pk-dl-main" : ""}`} data-pack={pack.slug} data-file={f} data-placement={placement}
      data-testid={`${placement}-${pack.slug}-${f}`}>
      <svg viewBox="0 0 16 16" aria-hidden="true" shapeRendering="crispEdges"><path fill="currentColor" d="M7 1h2v7h2v1h-1v1H9v1H7v-1H6V9H5V8h2zM2 11h2v2h8v-2h2v4H2z" /></svg>
      <span>{label.replace(/ PDF$/, "")}<span className="pk-pdf"> PDF</span></span>
    </a>
  );
  return (
    <div className="pk-dls">
      {file("questions", packCopy.download.questions, true)}
      {file("mark-scheme", packCopy.download.scheme, false)}
    </div>
  );
}

/** A pack beside the board's own papers: on the past paper and question bank pages. */
export function PackPromo({ pack, placement }: { pack: PracticePack; placement: string }) {
  return (
    <aside className="lp-card pk-promo" aria-labelledby={`${placement}-pack-title`}>
      <PackCover pack={pack} small />
      <div className="pk-promo-copy">
        <span className="lp-eyebrow">{packCopy.eyebrow}</span>
        <h2 id={`${placement}-pack-title`}>Done the past papers? <em>Try ours.</em></h2>
        <p>
          Our {pack.board}-style {display(pack.title)} pack: {pack.questions.length} new questions across the whole course,
          {" "}{pack.marks} marks, from easy to super hard, with a full mark scheme.
        </p>
        <PackDownloads pack={pack} placement={placement} />
        <p className="pk-small"><Link href={packPath(pack.slug)}>See what’s inside ›</Link> · {pack.disclaimer}</p>
      </div>
      <PackClickTracker />
    </aside>
  );
}

/** Every pack at once, for the past paper library's front page. */
export function PacksCallout() {
  return (
    <aside className="lp-card pk-promo pk-callout" aria-labelledby="packs-callout-title">
      <ul className="pk-callout-covers">{practicePacks.map(p => <li key={p.slug}><Link href={packPath(p.slug)} aria-label={`${p.board}-style ${p.title} practice pack`}><PackCover pack={p} small /></Link></li>)}</ul>
      <div className="pk-promo-copy">
        <span className="lp-eyebrow">{packCopy.eyebrow}</span>
        <h2 id="packs-callout-title">Run out of past papers? <em>Try ours.</em></h2>
        <p>Whole practice packs written by Plumi: 30 new exam-style questions each, easy to super hard, with a full mark scheme. Free, no sign-up.</p>
        <Link href="/practice-papers" className="lp-btn pk-dl pk-dl-main">See the practice packs ›</Link>
      </div>
    </aside>
  );
}
