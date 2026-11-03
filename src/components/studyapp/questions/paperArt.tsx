import Image from "next/image";
import type { PaperState } from "@/lib/studyapp/questions/papers";

/**
 * THE ONE PLACE a paper card's look is defined. A card is the paper itself (cream, ruled, a little tilted), a strip of washi
 * tape holding it up, a sticker in the corner, and a stamp once it is finished. Today all of it is CSS shapes and the
 * mascots already in the app; the final art swaps in here: give `PAPER_ART` image urls (a paper texture, a tape, stickers,
 * a stamp) and `PaperArt` draws those instead of the shapes. The card's text and behaviour (PaperCard) never change.
 * The CSS that draws the default shapes is the block marked PAPER CARD ART in questions-home.css.
 */
export const PAPER_ART: {
  /** Stickers in the paper's lower corner, taken in turn so a shelf is not a row of copies. Urls; `null` for none. */
  stickers: readonly string[];
  /** Washi tape colours: the subject's tint is used, so a shelf reads as its subject. These are only the positions in turn. */
  tapes: readonly ("left" | "centre" | "right")[];
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
  tilts: [-1.4, 1, -0.6, 1.5, -1, 0.7],
};

export interface Look { tilt: number; tape: "left" | "centre" | "right"; sticker: string }

/** The look of the n-th card of a shelf (a shelf's cards differ a little from each other; the same card always looks the same). */
export function lookFor(n: number): Look {
  const a = PAPER_ART;
  return { tilt: a.tilts[n % a.tilts.length], tape: a.tapes[n % a.tapes.length], sticker: a.stickers[(n * 3 + 1) % a.stickers.length] };
}

/** The decorative layers of a paper card, behind and over its text. Nothing here is read out (the card names itself). */
export function PaperArt({ look, state }: { look: Look; state: PaperState }) {
  const img = PAPER_ART.images;
  return (
    <>
      <span className="qh-grain" aria-hidden="true" style={img?.paper ? { backgroundImage: `url(${img.paper})` } : undefined} />
      <span className={`qh-tape ${look.tape}`} aria-hidden="true" style={img?.tape ? { backgroundImage: `url(${img.tape})` } : undefined} />
      <span className="qh-sticker" aria-hidden="true"><Image src={look.sticker} alt="" width={44} height={44} unoptimized loading="lazy" /></span>
      {state.kind === "done" && (
        <span className="qh-stamp" aria-hidden="true" style={img?.stamp ? { backgroundImage: `url(${img.stamp})` } : undefined}>
          {state.pct == null || state.partial ? <i className="qh-stamp-tick" /> : <b>{state.pct}%</b>}
        </span>
      )}
    </>
  );
}
