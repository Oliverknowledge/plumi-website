"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * The root layout's site-wide furniture, left out of the partner embed.
 *
 * `/embed/*` is drawn inside someone else's page, so it carries no skip link, no
 * structured data, no ad tag, no cookie question and no analytics of the site's own.
 * (The embed sends its two PostHog events itself, with no cookies: see EmbedQuestionList.)
 * Every other path renders its children untouched.
 */
export function SiteOnly({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return pathname?.startsWith("/embed/") ? null : <>{children}</>;
}
