import type { MetadataRoute } from "next";

import { site } from "@/config/site";

/**
 * Three pages. A sitemap this small changes nothing for a crawler that has
 * already found the homepage, but it costs one file and it is the difference
 * between the legal pages being discovered on day one and on day thirty.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: site.domain, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${site.domain}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${site.domain}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
