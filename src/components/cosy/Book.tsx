import type { CSSProperties, ReactNode } from "react";

/**
 * A subject as a hardback book, the way the app draws its subjects on the Desk's shelf (the founder,
 * 23 October 2026): a cover in the subject's colour with a cream label plate on it, a spine down the
 * left, a ribbon bookmark, and a body below for what's inside. Used by the question bank's and the past
 * paper library's front doors in place of the spiral notebook cards. The look is in cosy.css (.lp-book).
 */

/** Each subject's colour: the homepage shelf's four, the app's lilac for Further Maths (and IGCSE Additional Maths), a rose for Psychology, a teal for Economics, a parchment for Philosophy, a slate for Computer Science, an apricot for Combined Science, a sage for Sociology, a claret for Business, a leather tan for English Literature, a terracotta for English Language, a moss green for Geography, a law-report indigo for Law, a navy for Politics and a candle gold for Religious Studies. */
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
  Business: "#c4848f",
  "English Literature": "#c4a484",
  "English Language": "#b9836a",
  Geography: "#a9c48a",
  "Religious Studies": "#e0b878",
  Criminology: "#8f9cc0", // a dusk blue
  Law: "#8a93c4",
  Politics: "#7f8fb8",
};

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
