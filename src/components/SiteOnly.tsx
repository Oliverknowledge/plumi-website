"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { isStudyHostname } from "@/lib/studyapp/routing";

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
 *
 * On study.tryplumi.app the app is at /, /library and /flashcards, served from the same prerendered pages as
 * /study, /study/library and /study/flashcards (src/proxy.ts), whose HTML already has no furniture. In the
 * browser the path reads "/" there, so those three are told apart from the marketing site by the host. The
 * host is read in the hydration snapshot too, deliberately: the HTML being hydrated was made for /study, and
 * hydrating it as the marketing homepage would be a mismatch (and would load the ad tag and cookie question
 * into the app). Other paths there (/sign-in, /sign-up, /auth/callback) are the website's own static pages,
 * furniture and all, and stay as they are.
 */
const APP_PLACES = new Set(["/", "/library", "/flashcards"]);
const never = () => () => {};
const onStudyHost = () => typeof window !== "undefined" && isStudyHostname(window.location.hostname);

export function SiteOnly({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const studyHost = useSyncExternalStore(never, onStudyHost, onStudyHost);
  const apart = pathname?.startsWith("/embed/") || pathname === "/study" || pathname?.startsWith("/study/") || (studyHost && APP_PLACES.has(pathname ?? ""));
  return apart ? null : <>{children}</>;
}
