import { examMode, sections } from "@/content/copy";

/**
 * The credibility keystone.
 *
 * Everything above this argues that Plumi's intelligence is good. This argues
 * that Plumi knows when to switch it off, and it is the best answer available to
 * the category's biggest objection — "isn't this just another AI wrapper?" —
 * precisely because it is the opposite of what a wrapper would build. A wrapper
 * wants you using the AI.
 *
 * ── Why twelve names and not an adjective ───────────────────────────────────
 * `AISurface` in `Exam/ExamSurfaceGuard.swift` is a `CaseIterable` enum of every
 * way Plumi can bring intelligence to bear on a student's work, and `ExamGuard.
 * allows(_:whileSitting:)` answers every case with `false` while the clock runs
 * — written out case by case rather than collapsed to `return false`, so adding
 * a feature is a compile error rather than a silent hole. The list below is that
 * enum, in its own order, with its own titles. It is the most checkable claim on
 * this page and it is the reason the section is not an adjective.
 *
 * Wording is exact. Exam Mode switches off Plumi's own surfaces. It does not
 * lock the iPad: there is no Guided Access, no single-app mode and no screenshot
 * prevention anywhere in the app, and claiming otherwise is a lie a reviewer
 * would catch in a minute.
 *
 * It goes dark, using the app's real dark values rather than a filter. The change
 * of surface is doing work: this is the one moment on the page that is about the
 * exam hall rather than about the notebook.
 */

/** `AISurface.title`, verbatim, in the enum's own order. */
const surfaces = [
  "AI Pen",
  "Marking",
  "Re-mark",
  "Challenge",
  "Tutor",
  "Tutor from the sidebar",
  "Proactive notices",
  "Lecture recording",
  "Document intelligence",
  "Practice",
  "Paper marking",
  "Topic classification",
] as const;

export function ExamMode() {
  return (
    <section id="exam-mode" className="exam-section" data-testid="exam-mode-section">
      <div className="story-container exam-layout">
        <div className="exam-copy">
          <div className="scene-eyebrow"><span>07</span> UNDER A CLOCK</div>
          <h2>Then it takes<br /><span className="muted-line">it all away.</span></h2>
          <p>{sections.underAClock.subhead}</p>
          <p className="exam-footnote">{examMode.footnote}</p>
        </div>

        <div className="exam-stage">
          <div className="exam-clock" aria-label={`${examMode.clock} remaining`}>
            <span className="exam-clock-label">TIME REMAINING</span>
            <b>{examMode.clock}</b>
          </div>
          <ul className="exam-surfaces" aria-label="Everything Plumi switches off while the clock runs">
            {surfaces.map((name, i) => (
              <li key={name} style={{ "--i": i } as React.CSSProperties}>
                <span className="exam-surface-name">{name}</span>
                <span className="exam-surface-state">off</span>
              </li>
            ))}
          </ul>
          <p className="exam-caveat">
            Twelve surfaces, and paper marking is the one that comes back — because marking the paper is what submitting is.
          </p>
        </div>
      </div>
    </section>
  );
}
