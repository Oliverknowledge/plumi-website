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
  env: { NEXT_PUBLIC_LIBRARY_ART: libraryArtVersion() },
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
       * No page may be framed, except the partner embed under /embed/. That one
       * answers with a Content-Security-Policy `frame-ancestors` built from the
       * partner allowlist (src/proxy.ts, src/config/embedPartners.ts), so it is
       * left out of this rule rather than overridden: a DENY here would win in
       * browsers that read X-Frame-Options first. Every other path, including
       * /embed.js and all of /question-bank, is still DENY.
       */
      {
        source: "/((?!embed/).*)",
        headers: [{ key: "X-Frame-Options", value: "DENY" }],
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
    ];
  },
};

export default nextConfig;
