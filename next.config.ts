import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";

/**
 * A short fingerprint of everything in public/library (the Grand Library's art), taken whenever the config loads.
 * The Study page asks for its art as `/library/<file>?v=<this>` (src/lib/studyapp/library/art.ts), so a file's URL
 * changes exactly when its bytes do, and the `?v=` URLs below can be cached for a year without ever going stale.
 */
function libraryArtVersion(): string {
  const dir = join(process.cwd(), "public", "library");
  const h = createHash("sha256");
  try {
    for (const name of readdirSync(dir).sort()) h.update(name).update(readFileSync(join(dir, name)));
  } catch {
    return "";   // no art folder (a partial checkout): the page asks for plain URLs, which are revalidated as before
  }
  return h.digest("hex").slice(0, 10);
}

/**
 * The bucket's public address. Production sets NEXT_PUBLIC_PAPERS_URL to it; a preview build falls back to r2.dev (as
 * src/config/papers.ts, which this file can't import: its module resolution differs by Node version), because the
 * question bank's topic pages read their data from R2 as they build. A local build stays on /papers-local unless
 * .env.local says otherwise.
 */
const papersUrl = process.env.NEXT_PUBLIC_PAPERS_URL ?? (process.env.VERCEL ? "https://pub-e8a9dbab8e2a4d089f52b2a45e0d0b50.r2.dev" : undefined);

/**
 * The question bank's data used to be served from public/question-bank/<slug>/<file>.json; it now lives on R2 under
 * its content hash (bankDataUrl in src/content/questionBank.ts). The Discord bot (plumibot/bank.py) still reads the
 * old URLs for the question of the day, so each one redirects to the bank's current file, read off the bank's meta.
 */
function bankDataRedirects() {
  const papers = (papersUrl ?? "").replace(/\/$/, "");
  if (!papers.startsWith("http")) return [];
  const dir = join(process.cwd(), "src", "content", "questionBank");
  return readdirSync(dir).flatMap(name => {
    const meta = JSON.parse(readFileSync(join(dir, name), "utf8")) as { slug?: string; data?: Record<string, string> };
    return Object.entries(meta.data ?? {}).filter(([file]) => file !== "solutions").map(([file, hash]) => ({
      source: `/question-bank/${meta.slug}/${file}.json`,
      destination: `${papers}/bank-data/${meta.slug}/${file}.${hash}.json`,
      permanent: false,   // the next cut is a new file
    }));
  });
}

/**
 * Every host that is not the canonical one, and must 308 to it.
 *
 * Both plumi.study and tryplumi.app are attached to this same Vercel project,
 * so before this redirect existed they each answered 200 with byte-identical
 * HTML — two copies of the site competing for the same queries. The canonical
 * tag alone is a hint; a 308 is not, and Google weighs redirects, the sitemap
 * and rel=canonical together when it picks a winner. Make all three agree.
 *
 * Keep this in sync with `site.alternateDomain` in src/config/site.ts.
 */
const nonCanonicalHosts = ["plumi.study", "www.plumi.study", "www.tryplumi.app"];

const canonicalOrigin = "https://tryplumi.app";

/** [removed path, where it goes] */
const removedPages: readonly (readonly [string, string])[] = [
  ["/how-it-works", "/#marking"],
  ["/ai-handwriting-tutor", "/"],
  ["/ipad-study-app", "/"],
  // The subject shelf left the homepage and these four pages with it (founder, 31 October 2026): the
  // question bank and past papers cover every subject and board now.
  ["/physics-revision", "/question-bank"],
  ["/chemistry-revision", "/question-bank"],
  ["/biology-revision", "/question-bank"],
  ["/gcse-maths", "/question-bank"],
];

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_LIBRARY_ART: libraryArtVersion(), ...(papersUrl ? { NEXT_PUBLIC_PAPERS_URL: papersUrl } : {}) },
  /**
   * Security headers.
   *
   * Accounts sign in from the browser straight to Supabase, so this is still a
   * short list — but a site collecting email addresses with no headers at all is
   * an easy finding for anyone who looks.
   *
   * 127.0.0.1 is localhost's twin with its own storage: a signed-out window onto
   * the dev server, for trying /sign-in without signing out (development only).
   */
  allowedDevOrigins: ["*.preview.emergentagent.com", "*.cluster-5.preview.emergentcf.cloud", "127.0.0.1", "study.localhost"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Nothing here needs a camera, a microphone or a location.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
      /**
       * A shared flashcard deck (/d/<code>, src/app/d): the code is in the address and the page is read from the database on every
       * visit, so the address is never passed on as a referrer, nothing keeps a copy of the page, and crawlers are told at the
       * header as well as in the HTML.
       */
      {
        source: "/d/:code",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      /**
       * The Grand Library's art, asked for with its fingerprint (`?v=`): the same URL is always the same bytes, so
       * it is kept for a year and a repeat visit fetches none of it. Without `?v=` (the homepage's own copy of the
       * room, the sign-in page's door) the files keep the default and are revalidated each time.
       */
      {
        source: "/library/:file*",
        has: [{ type: "query", key: "v" }],
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      /**
       * The people layers are a binary file, and a CDN will not compress `application/octet-stream` (587 KB raw, 312 KB
       * gzipped). Served as text/plain it is compressed like any text; the page reads it with fetch().arrayBuffer(),
       * which does not care what the type says.
       */
      {
        source: "/library/people-layers.bin",
        headers: [{ key: "Content-Type", value: "text/plain" }],
      },
      /**
       * Pages may only be framed through the partner embed under /embed/ or the
       * same-origin calculator under /calculator/. The partner embed
       * answers with a Content-Security-Policy `frame-ancestors` built from the
       * partner allowlist (src/proxy.ts, src/config/embedPartners.ts), so it is
       * left out of this rule rather than overridden: a DENY here would win in
       * browsers that read X-Frame-Options first. Every other path, including
       * /embed.js and all of /question-bank, is still DENY.
       */
      {
        source: "/((?!embed/|calculator/).*)",
        headers: [{ key: "X-Frame-Options", value: "DENY" }],
      },
      {
        // The calculator is framed only by Plumi itself. Other pages retain DENY.
        source: "/calculator/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },

  /**
   * Path is preserved, so plumi.study/privacy lands on tryplumi.app/privacy
   * rather than dumping every inbound link on the homepage — a redirect that
   * loses the path also loses whatever ranking that URL had earned.
   */
  async redirects() {
    return [
      ...nonCanonicalHosts.map((host) => ({
        source: "/:path*",
        has: [{ type: "host" as const, value: host }],
        destination: `${canonicalOrigin}/:path*`,
        permanent: true,
      })),
      /**
       * Pages that only restated the homepage. A removed URL that used to answer
       * 200 redirects permanently rather than 404ing, so any inbound link or
       * indexed result lands on the nearest thing that still exists.
       */
      ...removedPages.map(([source, destination]) => ({ source, destination, permanent: true })),
      ...bankDataRedirects(),
    ];
  },
};

export default nextConfig;
