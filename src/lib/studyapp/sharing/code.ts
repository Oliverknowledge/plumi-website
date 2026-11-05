import { site } from "@/config/site";
import { CODE_PATTERN } from "./contract";

/** True for a string that can be a share code. It says nothing about whether the deck exists: only the server knows. */
export const isShareCode = (s: unknown): s is string => typeof s === "string" && CODE_PATTERN.test(s);

/**
 * The link a student sends: the app's own host in production (`https://study.tryplumi.app/d/<code>`), and the address the
 * page is open on anywhere else (localhost, a preview), so a link made while developing opens where it was made.
 * `origin` is `window.location.origin` in the browser; leave it out for the production link.
 */
export function shareLink(code: string, origin?: string | null): string {
  const base = origin && !isProductionOrigin(origin) ? origin.replace(/\/+$/, "") : site.studyDomain;
  return `${base}/d/${encodeURIComponent(code)}`;
}

/** The app's host, the marketing host or its www: a link made from any of them is written on the app's host. */
function isProductionOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    const study = new URL(site.studyDomain).hostname;
    const main = new URL(site.domain).hostname;
    return host === study || host === main || host === `www.${main}`;
  } catch {
    return false;
  }
}

/** A code from what was pasted: the code itself, or a link that ends `/d/<code>`. Anything else is null. */
export function parseShareCode(input: string): string | null {
  const text = input.trim();
  if (isShareCode(text)) return text;
  const m = /\/d\/([A-Za-z0-9_-]+)\/?(?:[?#].*)?$/.exec(text);
  return m && isShareCode(m[1]) ? m[1] : null;
}
