import type { NextConfig } from "next";

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
};

export default nextConfig;
