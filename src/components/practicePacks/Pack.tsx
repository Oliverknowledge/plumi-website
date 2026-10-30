import { DiscordButton } from "@/components/cosy/DiscordButton";
import { Tape } from "@/components/cosy/Chrome";
import { display } from "@/content/pastPapers";
import { packCopy, packLevels, type PackLevel, type PracticePack } from "@/content/practicePacks";
import "@/app/practice-packs.css";

/**
 * The pieces every practice pack placement shares: the booklet cover drawn in CSS, the
 * difficulty ladder, and the way to get it: free for members of the Plumi Discord.
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

/**
 * How to get a pack: it's free for members of the Plumi Discord (founder, 30 October 2026),
 * so the website shows what's in it and the Discord hands it over. Joining is reported like
 * every Discord button (`discord_clicked`, with this placement).
 */
export function PackGet({ pack, placement }: { pack: PracticePack; placement: string }) {
  return (
    <div className="pk-get">
      <DiscordButton placement={`${placement}-${pack.slug}`} label="Get it free on Discord" className="lp-btn lp-discord pk-dl" />
      <p className="pk-get-line">{packCopy.get.line} the <b>{packCopy.get.channel}</b> channel.</p>
    </div>
  );
}
