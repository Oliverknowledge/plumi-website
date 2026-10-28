/**
 * Helpers for the partner embed (/embed/question-bank/...). Safe to import from the
 * browser: no Node, no allowlist (that lives in src/config/embedPartners.ts and is
 * only read on the server).
 */
import { appStoreLink } from "@/config/site";

/** The same shape the server accepts for `?ref=`. */
const PARTNER_ID = /^[a-z0-9-]{1,32}$/;

/** `?ref=` from a query string, or null when it is missing or malformed. */
export function partnerFromSearch(search: string): string | null {
  const ref = new URLSearchParams(search).get("ref")?.trim().toLowerCase() ?? "";
  return PARTNER_ID.test(ref) ? ref : null;
}

/**
 * A link out of the embed: `?ref=<partner>&topic=<topic>`, plus the UTM pair the
 * rest of the site's attribution already understands (lib/attribution.ts), so a
 * partner's visitor is credited on arrival. Relative paths stay relative: the
 * embed is served from Plumi's own origin, so they resolve to the right host.
 */
export function withEmbedParams(href: string, partner: string | null, topic: string): string {
  const url = new URL(href, "https://embed.invalid");
  url.searchParams.set("ref", partner ?? "direct");
  url.searchParams.set("topic", topic);
  url.searchParams.set("utm_source", partner ?? "direct");
  url.searchParams.set("utm_medium", "embed");
  const relative = !/^[a-z][a-z0-9+.-]*:/i.test(href);
  return relative ? `${url.pathname}${url.search}${url.hash}` : url.toString();
}

/** The App Store listing for an embed visitor on iPad, or null if the site has none. */
export function embedAppStoreHref(partner: string | null, topic: string): string | null {
  const store = appStoreLink("embed");
  return store ? withEmbedParams(store, partner, topic) : null;
}

/**
 * An iPad, the only device Plumi installs on (iPhone visitors go to the topic page, as
 * the site's own App Store badge treats them). iPadOS 13+ Safari reports itself as a
 * Mac, so a "Mac" with a touch screen is an iPad. Browser only.
 */
export function isAppleTouchDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  if (/iPad/.test(navigator.userAgent)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

const yearOf = (s: string) => { const y = s.match(/^[A-Z]{3}(\d\d)/); return y ? 2000 + Number(y[1]) : 0; };
const seriesRank = (s: string) => yearOf(s) * 100 + (s.startsWith("NOV") ? 11 : s.startsWith("OCT") ? 10 : s.startsWith("JUN") ? 6 : 0);

/**
 * Newest first, the order the topic page settles on once its list has loaded:
 * within a sitting the full A-Level papers before AS, then paper, then question
 * order. (The bank's own sort lives inside QuestionBank, which this deliberately
 * does not touch.)
 */
export function sortNewest<T extends { p: string; s: string; l: string }>(papers: readonly { id: string; as: boolean }[], parts: readonly T[]): T[] {
  const paperRank = (p: string) => (papers.find(x => x.id === p)?.as ? 1 : 0);
  return [...parts].sort((a, b) =>
    seriesRank(b.s) - seriesRank(a.s) || paperRank(a.p) - paperRank(b.p) || a.p.localeCompare(b.p) || a.s.localeCompare(b.s) || a.l.localeCompare(b.l, undefined, { numeric: true }));
}
