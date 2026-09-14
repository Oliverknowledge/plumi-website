import { BandBars } from "@/components/product/BandBars";
import { evidenceCases, evidenceWeight, examCase, sections } from "@/content/copy";

/**
 * The honest mirror.
 *
 * This section states a RULE rather than a claim, and that is the whole design.
 * "Plumi learns from your work" is something every AI wrapper says and nobody
 * can check. "Notes make a topic seen and nothing more" is falsifiable — a
 * student can go and test it — and falsifiable statements read as true.
 *
 * It sits immediately before the learner model on purpose. Shipped the other way
 * round, the tree reads as generic AI personalisation, because the reader has
 * been shown a consequence without the rule that produced it.
 *
 * Copy is verbatim from `copy.ts`. Only the markup was ported, from the earlier
 * Tailwind generation to this page's own classes.
 */

const barTone = {
  unseen: "var(--color-mastery-unseen)",
  developing: "var(--color-mastery-developing)",
  secure: "var(--color-mastery-secure)",
  mastered: "var(--color-mastery-mastered)",
} as const;

const textTone = {
  unseen: "var(--color-ink-secondary)",
  developing: "var(--color-mastery-developing-text)",
  secure: "var(--color-mastery-secure-text)",
  mastered: "var(--color-mastery-mastered-text)",
} as const;

/** Four rungs: the three from the app's own evidence rules, then the gate. */
const rungs = [...evidenceCases, examCase] as const;

export function WhatCounts() {
  return (
    <section id={sections.whatCounts.id} className="counts-section" data-testid="what-counts-section">
      <div className="story-container counts-layout">
        <div className="counts-heading">
          <div className="scene-eyebrow"><span>04</span> WHAT COUNTS AS EVIDENCE</div>
          <h2>Reading your notes<br /><span className="muted-line">proves nothing.</span></h2>
          <p>{sections.whatCounts.subhead}</p>
        </div>

        <ol className="evidence-rungs">
          {rungs.map((item) => (
            <li key={item.band} data-tone={item.tone}>
              <p className="rung-work">{item.work}</p>
              <div className="rung-band">
                <BandBars filled={evidenceWeight[item.tone]} colour={barTone[item.tone]} />
                <span style={{ color: textTone[item.tone] }}>{item.band}</span>
              </div>
              <p className="rung-note">{item.note}</p>
            </li>
          ))}
        </ol>

        {/* Real, unusual, and the thing students are most relieved to hear:
            there is no forgetting curve in the app. `LearnerModel.stale()`
            reports staleness as a fact and never moves a band down for it. */}
        <p className="counts-closing">
          And it never quietly takes it back. There is no decay curve in Plumi: if it has been a while, it says so, rather
          than moving your topic down while you weren’t looking.
        </p>
      </div>
    </section>
  );
}
