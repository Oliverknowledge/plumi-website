import { boldRuns } from "@/lib/studyapp/boldText";

/** A card's words with its `**bold**` runs drawn bold. React text and `<strong>` only: no HTML is ever parsed. */
export function BoldText({ text }: { text: string }) {
  const runs = boldRuns(text);
  if (runs.length === 1 && !runs[0].bold) return <>{runs[0].text}</>;
  return <>{runs.map((r, i) => (r.bold ? <strong key={i}>{r.text}</strong> : <span key={i}>{r.text}</span>))}</>;
}
