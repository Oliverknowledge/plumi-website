import type { NextConfig } from "next";

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

const nextConfig: NextConfig = {
  /**
   * Security headers.
   *
   * The site has no accounts, no user content and one form, so this is a short
   * list — but a site collecting email addresses with no headers at all is an
   * easy finding for anyone who looks.
   */
  allowedDevOrigins: ["*.preview.emergentagent.com", "*.cluster-5.preview.emergentcf.cloud"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          // Nothing here needs a camera, a microphone or a location.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
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
    return nonCanonicalHosts.map((host) => ({
      source: "/:path*",
      has: [{ type: "host" as const, value: host }],
      destination: `${canonicalOrigin}/:path*`,
      permanent: true,
    }));
  },
};

export default nextConfig;
