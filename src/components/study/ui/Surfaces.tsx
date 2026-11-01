import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { Mascot, type MascotPose } from "./Mascot";

type DivProps = HTMLAttributes<HTMLElement> & { className?: string; children?: ReactNode };
const join = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

/**
 * A card: warm off-white, a 3px line, a 5px hard shadow.
 *   hero    the one dominant surface on a screen (more padding)
 *   inner   a card inside a screen (subject card, stat tile)
 *   flat    no shadow (a footer)
 *   quiet   an inset panel that still has a line
 */
export function Card({
  as, hero, inner, flat, quiet, className, ...rest
}: DivProps & { as?: ElementType; hero?: boolean; inner?: boolean; flat?: boolean; quiet?: boolean }) {
  const Tag = as ?? "div";
  return (
    <Tag
      className={join("st-card", hero && "st-card--hero", inner && "st-card--inner", flat && "st-card--flat", quiet && "st-card--quiet", className)}
      {...rest}
    />
  );
}

/** A panel inside a card: no line, no shadow. */
export function Inset({ className, ...rest }: DivProps) {
  return <div className={join("st-inset", className)} {...rest} />;
}

/** The small caps label above a value or a section. */
export function Eyebrow({ className, ...rest }: DivProps) {
  return <div className={join("st-eyebrow", className)} {...rest} />;
}

export type TagKind = "info" | "live" | "pro" | "count";
/** Not interactive. */
export function Tag({ kind = "info", className, ...rest }: DivProps & { kind?: TagKind }) {
  return <span className={join("st-tag", kind !== "info" && `st-tag--${kind}`, className)} {...rest} />;
}

export type MarkState = "earned" | "partial" | "lost" | "none";
/**
 * A mark code: M1, A1, B0. The only place green, amber and red appear on a marked answer, and
 * the word is always there (the title) so colour is never the only signal.
 */
export function MarkChip({ code, state = "none" }: { code: string; state?: MarkState }) {
  const word = { earned: "Awarded", partial: "Partly awarded", lost: "Not awarded", none: "Available" }[state];
  return (
    <span className={join("st-mark", state !== "none" && `st-mark--${state}`)} title={word}>
      <span className="st-sr">{word}: </span>
      {code}
    </span>
  );
}

/** What Plumi says, in the first person, short and kind. Never longer than two lines. */
export function Says({
  pose = "idle", children, height = 96, side = "right", stacked,
}: { pose?: MascotPose; children: ReactNode; height?: number; side?: "left" | "right"; /** bubble above, Plumi beneath */ stacked?: boolean }) {
  return (
    <div className={join("st-says", stacked && "st-says--stacked")} style={stacked ? undefined : { flexDirection: side === "left" ? "row-reverse" : "row" }}>
      <div className={join("st-bubble", side === "left" && "st-bubble--left")}>{children}</div>
      <Mascot pose={pose} height={height} />
    </div>
  );
}
