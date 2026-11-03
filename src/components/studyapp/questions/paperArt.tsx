import Image from "next/image";
import type { PaperState } from "@/lib/studyapp/questions/papers";

/**
 * THE ONE PLACE a paper card's look is defined. A card is the paper itself (cream, ruled, a little tilted, punched and
 * margined a little differently from its neighbour), a strip of washi tape holding it up (stripe, dots, plain or two
 * strips, in the subject's colour), a sticker in the middle of the page, and a stamp once it is finished (or begun).
 * Today all of it is CSS shapes and the mascots already in the app; the final art swaps in here: give `PAPER_ART`
 * image urls (a paper texture, a tape, stickers, a stamp) and `PaperArt` draws those instead of the shapes. The card's
 * text and behaviour (PaperCard) never change. The CSS that draws the default shapes is the block marked PAPER CARD ART
 * in questions-home.css.
 */
export const PAPER_ART: {
  /** Stickers on the paper's middle band, taken in turn so a shelf is not a row of copies. Urls. */
  stickers: readonly string[];
  /** Where the washi tape sits, in turn. */
  tapes: readonly ("left" | "centre" | "right")[];
  /** What the tape looks like, in turn: the subject's tint is always the colour. */
  tapeStyles: readonly TapeStyle[];
  /** How the paper is punched, in turn. */
  holes: readonly Holes[];
  /** The colour of the margin line, in turn. */
  margins: readonly ("red" | "blue")[];
  /** Tilts in degrees, taken in turn; the card straightens on hover and focus. */
  tilts: readonly number[];
  /** Final art, when it arrives. Any left unset keeps the CSS shape. */
  images?: { paper?: string; tape?: string; stamp?: string };
} = {
  stickers: [
    "/study/mascot/plumi-lofi-cozy.svg", "/study/mascot/plumi-thinking.svg", "/study/mascot/plumi-focused.svg", "/study/mascot/plumi-lofi-cool.svg",
    "/study/mascot/plumi-curious.svg", "/study/mascot/plumi-welcoming.svg", "/study/mascot/plumi-lofi-sleepy.svg", "/study/mascot/plumi-explaining.svg",
  ],
  tapes: ["centre", "left", "right", "centre", "right", "left"],
  tapeStyles: ["stripe", "dots", "solid", "double"],
  holes: ["three", "two", "spiral"],
  margins: ["red", "blue"],
  tilts: [-1.4, 1, -0.6, 1.5, -1, 0.7],
};

export type TapeStyle = "stripe" | "dots" | "solid" | "double";
export type Holes = "three" | "two" | "spiral";
export interface Look { tilt: number; tape: "left" | "centre" | "right"; tapeStyle: TapeStyle; holes: Holes; margin: "red" | "blue"; sticker: string }

/** The look of the n-th card of a shelf (a shelf's cards differ a little from each other; the same card always looks the same). */
export function lookFor(n: number): Look {
  const a = PAPER_ART;
  return {
    tilt: a.tilts[n % a.tilts.length], tape: a.tapes[n % a.tapes.length], tapeStyle: a.tapeStyles[(n * 3 + 1) % a.tapeStyles.length],
    holes: a.holes[(n * 5 + 2) % a.holes.length], margin: a.margins[(n * 7 + 1) % a.margins.length], sticker: a.stickers[(n * 3 + 1) % a.stickers.length],
  };
}

/** The paper and its tape, behind and over the card's text. Nothing here is read out (the card names itself). */
export function PaperArt({ look }: { look: Look }) {
  const img = PAPER_ART.images;
  return (
    <>
      <span className={`qh-grain h-${look.holes} m-${look.margin}`} aria-hidden="true" style={img?.paper ? { backgroundImage: `url(${img.paper})` } : undefined} />
      <span className={`qh-tape ${look.tape} t-${look.tapeStyle}`} aria-hidden="true" style={img?.tape ? { backgroundImage: `url(${img.tape})` } : undefined} />
    </>
  );
}

/** What the card's stamp says. Only the state decides (papers.ts `phase`): a finished paper is stamped, a begun or half-marked one is half stamped, an untouched one has a sticker. */
export type StampKind = "done" | "half" | null;
export function stampOf(state: Pick<PaperState, "phase">): StampKind {
  if (state.phase === "done") return "done";
  if (state.phase === "new") return null;
  return "half";
}

/** The middle of the paper: a sticker while it is untouched, the stamp once it is begun or done (and a small one for the best finished try while a retry is open). */
export function Mid({ look, state }: { look: Look; state: PaperState }) {
  const img = PAPER_ART.images;
  const stamp = stampOf(state);
  const best = stamp !== "done" ? state.best : null;
  return (
    <span className="qh-mid" aria-hidden="true">
      {stamp === null && <span className="qh-sticker"><Image src={look.sticker} alt="" width={56} height={56} unoptimized loading="lazy" /></span>}
      {stamp === "done" && (
        <span className="qh-stamp" style={img?.stamp ? { backgroundImage: `url(${img.stamp})` } : undefined}>
          {state.pct == null ? <i className="qh-stamp-tick" /> : <b>{state.pct}%</b>}
        </span>
      )}
      {stamp === "half" && <span className="qh-stamp half"><b>Started</b></span>}
      {best && <span className="qh-stamp small" title="Best finished attempt"><b>{best.got}/{best.total}</b></span>}
    </span>
  );
}
