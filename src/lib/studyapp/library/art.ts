/**
 * Where the Grand Library's art is asked for. next.config.ts fingerprints public/library and serves any
 * `/library/<file>?v=<fingerprint>` for a year (the fingerprint changes when a byte does), so the Study page's
 * repeat visits fetch none of it. With no fingerprint (a test, a partial checkout) the plain URL is used, which the
 * server revalidates as it always did.
 */
const VERSION = process.env.NEXT_PUBLIC_LIBRARY_ART;

export const artUrl = (name: string): string => "/library/" + name + (VERSION ? "?v=" + VERSION : "");
