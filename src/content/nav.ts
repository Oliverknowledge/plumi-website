/**
 * Navigation and footer.
 *
 * Four links, no hamburger. A landing page with a hidden menu is charging the
 * visitor a tap to find out there was nothing worth finding; below 640px the
 * links move to the footer and the bar carries the wordmark and the CTA only.
 */

export interface NavLink {
  label: string;
  href: string;
}

/**
 * Four links, named after the arcs rather than after the features.
 *
 * "How it works" is what every site in this category calls its second link and
 * it commits the reader to nothing. "Can I trust it?" is the question they
 * actually have, and a nav item that asks it out loud is worth more than one
 * that describes a mechanism.
 */
export const navLinks: readonly NavLink[] = [
  { label: "The mark", href: "#the-mark" },
  { label: "Can I trust it?", href: "#trust" },
  { label: "What it learns", href: "#learner-model" },
  { label: "Free & Pro", href: "#free-and-pro" },
] as const;

export const footer = {
  blurb: "Built for iPad and Apple Pencil.",
  columns: [
    {
      title: "Product",
      links: [
        { label: "The mark", href: "#the-mark" },
        { label: "Can I trust it?", href: "#trust" },
        { label: "What it learns", href: "#learner-model" },
        { label: "Your course", href: "#your-course" },
        { label: "Free & Pro", href: "#free-and-pro" },
        { label: "FAQ", href: "#faq" },
      ],
    },
    {
      title: "Company",
      links: [{ label: "Contact", href: "mailto:hello@tryplumi.app" }],
    },
    {
      title: "Legal",
      links: [
        { label: "Privacy", href: "/privacy" },
        { label: "Terms", href: "/terms" },
      ],
    },
  ],
  copyright: "© 2026 Plumi. Made in the UK, for GCSE and A-Level.",
  /**
   * Pre-empts the "this is all concept art" objection that any well-designed
   * pre-launch site attracts.
   *
   * Carefully worded, because the obvious version — "everything here is the
   * real app" — is not true. These are drawings: recreations built from the
   * app's own values. What IS true is that the ingredients are the product's,
   * and every one of them is checkable at launch. On a page whose only social
   * proof is candour, the difference matters.
   */
  honesty:
    "Plumi hasn't launched yet, so every screen here is drawn rather than photographed. Drawn from the app's own colours, its own page geometry and its own handwriting. Nothing is claimed that the app cannot do.",
} as const;
