import { markKeyFor } from "@/lib/studyapp/questions/markKey";
import type { QPart, QSet } from "@/lib/studyapp/questions/model";

/**
 * The plain-English key to the letters on a mark scheme (M, A, B, oe, ft: what they mean for this subject), a collapsed "?" under
 * "Mark yourself". A multiple-choice part has no shorthand to explain. Check.tsx renders it; its look is the `.qs-mkey` block in the stylesheet.
 */
export function MarkKey({ set, part }: { set: QSet; part: QPart }) {
  if (part.k && !part.ms) return null;
  const key = markKeyFor(set.subject);
  return (
    <details className="qs-mkey" data-testid="mark-key">
      <summary>{key.summary}</summary>
      <dl className="qs-mkey-body">
        {key.entries.map((e) => <div key={e.term}><dt>{e.term}</dt><dd>{e.means}</dd></div>)}
      </dl>
    </details>
  );
}
