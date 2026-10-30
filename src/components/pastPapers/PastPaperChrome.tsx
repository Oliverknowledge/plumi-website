import { site } from "@/config/site";

/**
 * What every past paper page ends with: the credit line. (The "get it marked on iPad" card,
 * the three ways to use a paper and the practice pack promo went, founder, 30 October 2026:
 * the pages are the papers.)
 */
/** Whose papers they are. Every file is our copy of the board's published paper. */
export function SourceCredit() {
  return (
    <p className="pp-credit">
      Past papers, mark schemes and examiner’s reports are © their exam boards, from the papers each board publishes.
      Plumi isn’t affiliated with any exam board. Something missing or broken? <a href={`mailto:${site.contactEmail}`}>Tell us</a>.
    </p>
  );
}
