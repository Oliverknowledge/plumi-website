import { site } from "@/config/site";

/**
 * Which site a request belongs to, decided from its host and path alone (no cookies), so it can run in
 * src/proxy.ts in front of every cached page.
 *
 *   study.tryplumi.app   the web app. `/`, `/library` and `/flashcards` are the app's three places and are
 *                        served from /study, /study/library and /study/flashcards; the sign-in pages and
 *                        Next's own files pass through; the marketing pages are not here, so they go to
 *                        tryplumi.app. The address bar never shows a /study/ prefix.
 *   tryplumi.app         the marketing site. Its old /study, /study/library and /study/flashcards go to the
 *                        app's own host, so there is one home for the app.
 *   anything else        localhost, a preview deployment, 127.0.0.1: nothing changes, the app is under /study.
 *
 * Paths with a file extension never reach this (the proxy matcher skips them), so images, fonts and
 * /robots.txt-like files are not decided here.
 */

export const STUDY_HOST = new URL(site.studyDomain).hostname;
const MAIN_HOSTS = new Set([new URL(site.domain).hostname, `www.${new URL(site.domain).hostname}`]);

/** The app's three places: visible path to where they are served from. */
export const APP_PLACES = { "/": "/study", "/library": "/study/library", "/flashcards": "/study/flashcards" } as const;
const CANONICAL_TO_VISIBLE: Record<string, string> = { "/study": "/", "/study/library": "/library", "/study/flashcards": "/flashcards" };
/** Pages the app host serves as they are: signing in and out, and Supabase's return trip. */
const AUTH_PATHS = ["/sign-in", "/sign-up", "/auth/callback"];

/** `study.tryplumi.app`, or `study.localhost` to try it on a laptop. A port is ignored. */
export function isStudyHostname(hostname: string) {
  const h = hostname.toLowerCase().replace(/:\d+$/, "");
  return h === STUDY_HOST || h === "study.localhost";
}
const isMainHostname = (hostname: string) => MAIN_HOSTS.has(hostname.toLowerCase().replace(/:\d+$/, ""));

export type Routing =
  | { kind: "pass" }
  | { kind: "rewrite"; to: string }
  | { kind: "redirect"; to: string }
  | { kind: "robots" };

const trim = (p: string) => (p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p);

export function routeFor(host: string, rawPath: string, search = ""): Routing {
  const path = trim(rawPath);
  if (isStudyHostname(host)) {
    if (path === "/robots.txt") return { kind: "robots" };
    // The /study/ prefix is never shown on this host: /study/library comes back as /library.
    const visible = CANONICAL_TO_VISIBLE[path];
    if (visible !== undefined) return { kind: "redirect", to: visible + search };
    const place = APP_PLACES[path as keyof typeof APP_PLACES];
    if (place) return { kind: "rewrite", to: place + search };
    if (path.startsWith("/study/") || path.startsWith("/_next/") || path.startsWith("/api/")) return { kind: "pass" };
    if (AUTH_PATHS.includes(path)) return { kind: "pass" };
    // Everything else is the marketing site's (terms, privacy, the question bank, ...).
    return { kind: "redirect", to: `${site.domain}${rawPath}${search}` };
  }
  if (isMainHostname(host) && CANONICAL_TO_VISIBLE[path] !== undefined) {
    return { kind: "redirect", to: `${site.studyDomain}${CANONICAL_TO_VISIBLE[path] === "/" ? "" : CANONICAL_TO_VISIBLE[path]}${search}` };
  }
  return { kind: "pass" };
}

/**
 * Where "Log in" and "Get started" go. The app's own host in production: "Log in" opens the app (a signed-in
 * student lands on the Desk, anyone else on the sign-in page), "Get started" opens the sign-up page. Anywhere
 * else (localhost, a preview) the same places under /study, so clicking either stays where you are.
 */
export function studyEntry(where: "login" | "start", hostname: string) {
  const local = !isMainHostname(hostname) && !isStudyHostname(hostname);
  if (where === "login") return local ? "/study" : site.studyDomain;
  return local ? `/sign-up?next=${encodeURIComponent("/study")}` : `${site.studyDomain}/sign-up`;
}

/** `/study/library` (canonical) to the address for this host. Anything outside /study is returned as it is. */
export function hostPath(onStudy: boolean, canonical: string) {
  if (!onStudy) return canonical;
  if (canonical === "/study") return "/";
  return canonical.startsWith("/study/") ? canonical.slice("/study".length) : canonical;
}

/** `/library` or `/study/library`, either, to the canonical `/study/library` ("/" is the Desk). */
export function canonicalPath(visible: string) {
  const bare = visible.replace(/^\/study(?=\/|$)/, "") || "/";
  return bare === "/" ? "/study" : `/study${bare}`;
}
