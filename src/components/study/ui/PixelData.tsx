import type { ReactNode } from "react";

const join = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

/**
 * Mastery, in the app's one vocabulary (TopicState.label). Each state has its own square
 * texture as well as its own colour, so a student who cannot tell the colours apart can still
 * tell the states apart: hollow, solid red, hatched, half, solid.
 *
 * "Too early to tell" is deliberately the quietest: Plumi has not watched, and an absence of
 * evidence must look like an absence, not like a low score.
 */
export const masteryStates = [
  { id: "notEnough", label: "Too early to tell" },
  { id: "needsAttention", label: "Needs attention" },
  { id: "rusty", label: "Rusty" },
  { id: "developing", label: "Developing" },
  { id: "strong", label: "Strong" },
] as const;
export type MasteryState = (typeof masteryStates)[number]["id"];

/** One topic square. Pass `onSelect` to make it a button (the topic map). */
export function Tile({
  state = "notEnough", large, label, onSelect,
}: { state?: MasteryState; large?: boolean; label?: string; onSelect?: () => void }) {
  const word = masteryStates.find((s) => s.id === state)?.label ?? "";
  const cls = join("st-tile", large && "st-tile--lg");
  if (onSelect) {
    return <button type="button" className={cls} data-state={state} onClick={onSelect} aria-label={label ? `${label}: ${word}` : word} />;
  }
  return <span className={cls} data-state={state} role="img" aria-label={label ? `${label}: ${word}` : word} />;
}

/** A row of topic squares. */
export function Tiles({ states, large }: { states: readonly MasteryState[]; large?: boolean }) {
  return (
    <div className={join("st-tiles", large && "st-tiles--lg")}>
      {states.map((s, i) => <Tile key={i} state={s} large={large} />)}
    </div>
  );
}

/** The key to the squares: the same squares, with their words. */
export function Legend({ states = masteryStates.map((s) => s.id) }: { states?: readonly MasteryState[] }) {
  return (
    <div className="st-legend">
      {states.map((id) => (
        <span key={id}>
          <span className="st-tile" data-state={id} aria-hidden="true" />
          {masteryStates.find((s) => s.id === id)?.label}
        </span>
      ))}
    </div>
  );
}

/**
 * Progress as blocks. `value` of `max` are filled. Always give it a `label` that says the
 * whole fact ("42 of 60 minutes studied today"): the blocks are a picture of it.
 */
export function PixelBlocks({
  value, max, label, goal,
}: { value: number; max: number; label: string; /** the wide, flexible goal bar */ goal?: boolean }) {
  return (
    <div className={join("st-blocks", goal && "st-blocks--goal")} role="img" aria-label={label}>
      {Array.from({ length: max }, (_, i) => <span key={i} className={join("st-block", i < value && "is-on")} />)}
    </div>
  );
}

/** Seven bars, one per day, tallest day fills the height. */
export function WeekBars({
  values, days = ["M", "T", "W", "T", "F", "S", "S"], label, height = 150,
}: { values: readonly number[]; days?: readonly string[]; label: string; height?: number }) {
  const top = Math.max(1, ...values);
  return (
    <div role="img" aria-label={label}>
      <div className="st-week" style={{ ["--wh" as string]: `${height}px` }}>
        {values.map((v, i) => (
          <span key={i} className={join("st-week-bar", v > 0 && "is-on")} style={{ height: `${Math.max(4, (v / top) * 100)}%` }} />
        ))}
      </div>
      <div className="st-row" style={{ ["--gap" as string]: "6px", flexWrap: "nowrap" }} aria-hidden="true">
        {days.map((d, i) => <span key={i} className="st-eyebrow" style={{ flex: "1 1 0", maxWidth: 26, minWidth: 8, textAlign: "center", fontSize: 11 }}>{d}</span>)}
      </div>
    </div>
  );
}

/** An eyebrow over a number: "TODAY / 42 / 60 min". Numbers are Nunito, never pixel. */
export function Stat({
  label, value, unit, goal,
}: { label: string; value: ReactNode; unit?: string; /** the value is a target (drawn in the accent) */ goal?: boolean }) {
  return (
    <div className="st-stat">
      <div className="st-eyebrow">{label}</div>
      <div>
        <span className={join("st-num-lg", goal && "is-goal")}>{value}</span>
        {unit && <span className="st-unit"> {unit}</span>}
      </div>
    </div>
  );
}

/** A subject on the Desk: coloured spine, level and board, three stats, and its topic squares. */
export function SubjectCard({
  subject, name, meta, now, headedFor, goal, tiles, href,
}: {
  subject: string;
  name: string;
  meta: string;
  now: string;
  headedFor: string;
  goal: string;
  tiles: readonly MasteryState[];
  href?: string;
}) {
  const body = (
    <div className="st-subject-body">
      <div className="st-eyebrow">{meta}</div>
      <div className="st-h2">{name}</div>
      <div className="st-stats">
        <Stat label="Now" value={now} />
        <Stat label="Headed for" value={headedFor} />
        <Stat label="Goal" value={goal} goal />
      </div>
      <Tiles states={tiles} />
    </div>
  );
  return href ? (
    <a className="st-card st-subject" data-subject={subject} href={href}>{body}</a>
  ) : (
    <div className="st-card st-subject" data-subject={subject}>{body}</div>
  );
}
