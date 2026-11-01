"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * The root layout's site-wide furniture, left out of the partner embed and the study app.
 *
 * `/embed/*` is drawn inside someone else's page, so it carries no skip link, no
 * structured data, no ad tag, no cookie question and no analytics of the site's own.
 * (The embed sends its two PostHog events itself, with no cookies: see EmbedQuestionList.)
 *
 * `/study/*` is the notebook app (study.tryplumi.app), not the marketing site: no marketing
 * structured data, no ad tag and no ad-cookie question inside it. It will wire its own analytics.
 * Every other path renders its children untouched.
 */
export function SiteOnly({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const apart = pathname?.startsWith("/embed/") || pathname === "/study" || pathname?.startsWith("/study/");
  return apart ? null : <>{children}</>;
}
