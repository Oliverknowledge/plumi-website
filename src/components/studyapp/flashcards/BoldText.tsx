import { richRuns } from "@/lib/studyapp/boldText";

/**
 * A card's words: `**bold**` runs drawn bold, and the superscripts and subscripts of a maths span (`$10^{8}$`, `$SO_4^{2-}$`) drawn raised and lowered.
 * React text, `<strong>`, `<sup>` and `<sub>` only: no HTML is ever parsed. `bold={false}` leaves the bold markers out (the mark scheme bands).
 */
export function BoldText({ text, bold = true }: { text: string; bold?: boolean }) {
  const runs = richRuns(text, { bold });
  if (runs.length === 1 && !runs[0].bold && !runs[0].script) return <>{runs[0].text}</>;
  return (
    <>
      {runs.map((r, i) => {
        const inner = r.script === "sup" ? <sup>{r.text}</sup> : r.script === "sub" ? <sub>{r.text}</sub> : r.text;
        return r.bold ? <strong key={i}>{inner}</strong> : <span key={i}>{inner}</span>;
      })}
    </>
  );
}
