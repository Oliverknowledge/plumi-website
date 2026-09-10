import type { MetadataRoute } from "next";

import { site } from "@/config/site";

/**
 * Everything is indexable. There is nothing here that is not meant to be found,
 * and the API route is a POST endpoint no crawler will reach anyway.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${site.domain}/sitemap.xml`,
    host: site.domain,
  };
}
