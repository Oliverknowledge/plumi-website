"use client";

import { useState } from "react";
import { track } from "@/lib/analytics";
import type { FaqItem } from "@/content/copy";

/**
 * One question, as a native `<details>`.
 *
 * The whole disclosure is the browser's: keyboard operable for free, findable by
 * ⌘F even while closed where the browser supports it, and correct with
 * JavaScript switched off. The only reason this file is a client component at
 * all is the `onToggle` handler, so it stays as thin as it can be — the markup,
 * not the section, is what crosses the boundary.
 *
 * `faq_opened` carries the question, which turns the FAQ into a free ranking of
 * the objections people actually have. It is the cheapest research on the site.
 */
export function FaqEntry({ item, open = false }: { item: FaqItem; open?: boolean }) {
  // Genuinely controlled rather than a default. The first question is rendered
  // open on the server, so it is in the HTML and readable with JavaScript off,
  // and a visitor can still close it — which an uncontrolled `open` attribute
  // would fight the moment anything above it re-rendered.
  const [isOpen, setIsOpen] = useState(open);

  return (
    <details
      open={isOpen}
      className="faq-entry"
      // Deliberately not an exclusive accordion: a student comparing "is it
      // free?" against "can I trust the marking?" should hold both open at once.
      onToggle={(event) => {
        const nowOpen = event.currentTarget.open;
        setIsOpen(nowOpen);
        if (nowOpen) track("faq_opened", { question: item.question });
      }}
    >
      <summary>
        {item.question}
        {/* A plus that becomes a minus. Two lines, one of which rotates — a
            rotating chevron at this size reads as a wobble. */}
        <span className="faq-toggle" aria-hidden="true"><i /><i /></span>
      </summary>
      <p>{item.answer}</p>
    </details>
  );
}
