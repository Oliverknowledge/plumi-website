"use client";

import { track } from "@/lib/analytics";
import type { FaqItem } from "@/content/copy";

/**
 * One question, as a native `<details>`.
 *
 * The whole disclosure is the browser's: keyboard operable for free, findable
 * by ⌘F even while closed in browsers that support it, and correct with
 * JavaScript switched off. The only reason this file is a client component at
 * all is the `onToggle` handler, so it stays as thin as it can be — the
 * markup, not the section, is what crosses the boundary.
 *
 * The open/close animation is `interpolate-size` plus a height transition on
 * `::details-content`. Browsers that do not know that pseudo-element ignore the
 * rule entirely and snap open, which is exactly the behaviour we had before.
 */
export function FaqEntry({ item }: { item: FaqItem }) {
  return (
    <details
      // Deliberately not an exclusive accordion (`name=`): a student comparing
      // "is it free?" against "when does it launch?" should be able to hold both
      // open at once.
      onToggle={(event) => {
        if (event.currentTarget.open) track("faq_opened", { question: item.question });
      }}
      className="group border-b border-[var(--color-hairline)] [interpolate-size:allow-keywords] [&::details-content]:h-0 [&::details-content]:overflow-hidden [&::details-content]:transition-[height,content-visibility] [&::details-content]:duration-300 [&::details-content]:ease-[var(--ease-out-soft)] [&::details-content]:[transition-behavior:allow-discrete] open:[&::details-content]:h-auto"
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-6 text-left text-h3 font-medium text-[var(--color-ink)] transition-colors duration-150 marker:content-none hover:text-[var(--color-blue-700)] [&::-webkit-details-marker]:hidden">
        {item.question}

        {/* A plus that becomes a minus. Two lines, one of which rotates — a
            rotating chevron at this size reads as a wobble. */}
        <span
          aria-hidden="true"
          className="relative mt-1.5 h-5 w-5 shrink-0 text-[var(--color-ink-tertiary)] transition-colors group-open:text-[var(--color-blue-600)]"
        >
          <span className="absolute top-1/2 left-0 h-px w-5 -translate-y-1/2 bg-current" />
          <span className="absolute top-1/2 left-0 h-px w-5 -translate-y-1/2 rotate-90 bg-current transition-transform duration-300 ease-[var(--ease-out-soft)] group-open:rotate-0" />
        </span>
      </summary>

      <p className="measure-wide pb-7 text-[var(--color-ink-secondary)] text-pretty">
        {item.answer}
      </p>
    </details>
  );
}
