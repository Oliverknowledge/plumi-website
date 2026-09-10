import { Section } from "@/components/ui/Section";
import { examMode, sections } from "@/content/copy";

/**
 * The credibility keystone.
 *
 * Everything else on this page argues that Plumi's intelligence is good. This
 * section argues that Plumi knows when to switch it off, and it is the best
 * answer available to the category's biggest objection — "isn't this just
 * another AI app?" — precisely because it is the opposite of what an AI wrapper
 * would build. A wrapper wants you using the AI.
 *
 * It goes dark, and it is one of only two sections that do. The change of
 * surface is doing work: this is the one moment on the page that is about the
 * exam hall rather than about the notebook.
 *
 * Wording is exact. Exam Mode switches off Plumi's own AI surfaces. It does not
 * lock the iPad — there is no Guided Access, no single-app mode and no
 * screenshot prevention anywhere in the app, and claiming otherwise would be a
 * lie a reviewer would catch in a minute.
 */

const facts = [
  { title: "The AI Pen leaves the toolbar", detail: "Not greyed out. Gone." },
  { title: "The lasso captures nothing", detail: "There is no way to ask." },
  { title: "No request is made at all", detail: "Nothing is sent while the clock runs." },
] as const;

export function UnderAClock() {
  return (
    <Section copy={sections.underAClock} tone="dark">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:items-center lg:gap-16">
        <div>
          <div className="space-y-5">
            <ToolbarState label="Writing" />
            <ToolbarState label="Exam Mode" exam />
          </div>

          <p className="mt-6 text-sm text-[var(--color-ink-inverse-secondary)]">
            {examMode.footnote}
          </p>
        </div>

        <ul className="space-y-6">
          {facts.map((fact) => (
            <li key={fact.title}>
              <p className="text-[1.0625rem] font-medium text-[var(--color-ink-inverse)]">
                {fact.title}
              </p>
              <p className="mt-1 text-[0.9375rem] leading-snug text-[var(--color-ink-inverse-secondary)]">
                {fact.detail}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

/**
 * The same tool tray, twice. Showing both states side by side rather than
 * animating between them means the comparison survives a screenshot, a
 * reduced-motion preference, and a phone that never scrolled far enough to
 * trigger anything.
 */
function ToolbarState({ label, exam = false }: { label: string; exam?: boolean }) {
  return (
    <div>
      <p className="mb-2.5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-inverse-secondary)]">
        {label}
      </p>

      <div className="flex items-center gap-1 overflow-hidden rounded-full border border-[var(--color-hairline-dark)] bg-[var(--color-elevated-dark)] px-3 py-2.5 sm:gap-2 sm:px-4">
        <Tool>
          <path d="M9 4h6v11l-3 5-3-5z" />
        </Tool>
        <Tool>
          <path d="M10 4h4v11l-2 5-2-5z" />
        </Tool>
        <Tool dimmed={exam}>
          <path d="M8 4h8v10l-4 6-4-6z" />
        </Tool>

        <span className="mx-1 h-5 w-px shrink-0 bg-[var(--color-hairline-dark)] sm:mx-2" />

        <Tool>
          <path d="M5 18h7l7-7-5-5-9 9z" />
        </Tool>
        <Tool dimmed={exam}>
          <ellipse cx="12" cy="13" rx="8" ry="5.5" strokeDasharray="3 3" />
        </Tool>

        {/* The whole argument, in one component — by its absence.
            In Exam Mode the AI Pen is not dimmed, not disabled, not behind a
            confirmation. It is not in the toolbar. The gap where it was is the
            most persuasive thing on this page, so nothing is put in it. */}
        {!exam && (
          <>
            <span className="mx-1 h-5 w-px shrink-0 bg-[var(--color-hairline-dark)] sm:mx-2" />
            <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[color-mix(in_srgb,var(--color-blue-600)_22%,transparent)] px-3 py-1.5 text-[0.8125rem] font-semibold text-[var(--color-blue-300)]">
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 3.5c.7 4.3 3.5 7.1 7.8 7.8v1.4c-4.3.7-7.1 3.5-7.8 7.8h-1.4c-.7-4.3-3.5-7.1-7.8-7.8v-1.4c4.3-.7 7.1-3.5 7.8-7.8h1.4Z"
                  fill="currentColor"
                />
              </svg>
              AI Pen
            </span>
          </>
        )}

        {exam && (
          <span className="ml-auto shrink-0 pl-3 font-mono text-[0.875rem] tabular-nums text-[var(--color-ink-inverse)]">
            {examMode.clock}
          </span>
        )}
      </div>
    </div>
  );
}

function Tool({ children, dimmed = false }: { children: React.ReactNode; dimmed?: boolean }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`shrink-0 ${dimmed ? "opacity-25" : "opacity-70"}`}
      fill="none"
      stroke="var(--color-ink-inverse)"
      strokeWidth="1.5"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}
