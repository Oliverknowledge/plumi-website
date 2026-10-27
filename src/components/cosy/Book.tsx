import type { CSSProperties, ReactNode } from "react";

/**
 * A subject as a hardback book, the way the app draws its subjects on the Desk's shelf (the founder,
 * 23 October 2026): a cover in the subject's colour with a cream label plate on it, a spine down the
 * left, a ribbon bookmark, and a body below for what's inside. Used by the question bank's and the past
 * paper library's front doors in place of the spiral notebook cards. The look is in cosy.css (.lp-book).
 */

/** Each subject's colour: the homepage shelf's four, the app's lilac for Further Maths (and IGCSE Additional Maths), a rose for Psychology, a teal for Economics, a parchment for Philosophy, a slate for Computer Science, an apricot for Combined Science, a sage for Sociology, a leather tan for English Literature and a moss green for Geography. */
export const subjectColours: Record<string, string> = {
  Physics: "#f2c96b",
  Maths: "#6a9bd0",
  "Further Maths": "#b9a3e3",
  "Additional Maths": "#b9a3e3",
  Chemistry: "#8fd0a0",
  Biology: "#eaa99a",
  Psychology: "#e3a6c8",
  Economics: "#8cc7c2",
  Philosophy: "#d8c08e",
  "Computer Science": "#a3b1c9",
  "Combined Science": "#f0b98a",
  Sociology: "#b5c78f",
  "English Literature": "#c4a484",
  Geography: "#a9c48a",
};

/** A row of little squares, one a topic, filling in like the app's topic map: a fixed pattern, the same on every render. */
export function TopicSquares({ count, max = 36 }: { count: number; max?: number }) {
  const n = Math.min(count, max);
  return (
    <span className="lp-book-squares" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => <i key={i} className={`is-${(i * 7 + (i >> 2)) % 4}`} />)}
    </span>
  );
}

export function Book({ subject, kicker, plate, children, as: Tag = "div", className = "", ...rest }: {
  subject: string;
  /** The small line on the cover above the plate: "AQA A-Level". */
  kicker: ReactNode;
  /** What the label plate says: the subject, and anything under it. */
  plate: ReactNode;
  children: ReactNode;
  as?: "div" | "section" | "article";
  className?: string;
} & Record<`aria-${string}`, string>) {
  const style = { "--bk": subjectColours[subject] ?? "#d8c8ad" } as CSSProperties;
  return (
    <Tag className={`lp-book ${className}`.trim()} style={style} {...rest}>
      <div className="lp-book-cover">
        <span className="lp-book-kicker">{kicker}</span>
        <div className="lp-book-plate">{plate}</div>
        <i className="lp-book-rib" aria-hidden="true" />
      </div>
      <div className="lp-book-body">{children}</div>
    </Tag>
  );
}
