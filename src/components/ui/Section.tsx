import type { ReactNode } from "react";

import type { SectionCopy } from "@/content/copy";

/**
 * The frame every section shares: an id to anchor to, an eyebrow, a headline,
 * a sub-line, and then whatever the section is actually here to show.
 *
 * Consistency here is what stops a long page reading as several pages stapled
 * together. The rules are: one headline size for every section, one measure for
 * every sub-line, and vertical rhythm from a single scale.
 */

interface SectionProps {
  copy: SectionCopy;
  children?: ReactNode;
  /** A tone change, used sparingly: the paper darkens for Exam Mode and for the close. */
  tone?: "paper" | "surface" | "dark";
  /** Centres the heading block. Default is left, which reads faster. */
  centred?: boolean;
  className?: string;
  /** Replaces the standard heading block entirely. */
  heading?: ReactNode;
}

const tones = {
  paper: "bg-[var(--color-paper)] text-[var(--color-ink)]",
  surface: "bg-[var(--color-surface)] text-[var(--color-ink)]",
  dark: "bg-[var(--color-surface-dark)] text-[var(--color-ink-inverse)]",
} as const;

export function Section({
  copy,
  children,
  tone = "paper",
  centred = false,
  className = "",
  heading,
}: SectionProps) {
  const dark = tone === "dark";

  return (
    <section id={copy.id} className={`${tones[tone]} py-20 sm:py-28 lg:py-36 ${className}`}>
      <div className="container-plumi">
        {heading ?? (
          <header className={centred ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
            {copy.eyebrow && (
              <p className={`eyebrow ${dark ? "!text-[var(--color-blue-300)]" : ""}`}>{copy.eyebrow}</p>
            )}
            <h2 className="mt-4 text-h2 font-medium text-balance">{copy.headline}</h2>
            {copy.subhead && (
              <p
                className={`mt-5 measure-wide text-lead text-pretty ${
                  dark ? "text-[var(--color-ink-inverse-secondary)]" : "text-[var(--color-ink-secondary)]"
                } ${centred ? "mx-auto" : ""}`}
              >
                {copy.subhead}
              </p>
            )}
          </header>
        )}

        {children && <div className="mt-12 sm:mt-16">{children}</div>}
      </div>
    </section>
  );
}
