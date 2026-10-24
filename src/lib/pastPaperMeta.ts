import type { Metadata } from "next";

import { site } from "@/config/site";
import {
  boardHeading, boardPath, boardsFor, hasKind, shareImage, subjectPath, subjectTitle,
  type BoardPapers, type SubjectHub,
} from "@/content/pastPapers";

/**
 * Titles and descriptions for the generated past paper pages. These pages are not
 * in src/config/routes.ts (there are dozens, and they come from data), so this is
 * their equivalent of the route registry: one primary query each, written the way
 * students type it — "AQA A-Level Chemistry past papers" — with the brand last.
 */
const withBrand = (title: string) => (title.length + 8 <= 60 ? `${title} | Plumi` : title);

export function boardPageMeta(hub: SubjectHub, board: BoardPapers) {
  const heading = boardHeading(hub, board);
  const title = withBrand(`${heading} Past Papers & Mark Schemes`);
  const spec = board.specCodes.length ? ` (${board.specCodes.slice(0, 2).join(", ")})` : "";
  const ma = hasKind(board, "er") ? ", examiner reports" : "";
  let description = `Free ${heading}${spec} past papers, mark schemes${ma}, ${board.firstYear}–${board.lastYear}, by paper. No sign-up. Then get your answers marked in Plumi.`;
  if (description.length > 158) description = `Free ${heading} past papers and mark schemes, ${board.firstYear}–${board.lastYear}, every paper on one page. No sign-up needed.`;
  return { title, description };
}

export function subjectPageMeta(hub: SubjectHub) {
  const boards = boardsFor(hub.slug);
  const names = boards.map(b => b.label);
  const first = Math.min(...boards.map(b => b.firstYear));
  const last = Math.max(...boards.map(b => b.lastYear));
  const title = withBrand(`${subjectTitle(hub)} Past Papers & Mark Schemes`);
  let description = `Free ${subjectTitle(hub)} past papers and mark schemes for ${names.join(", ")}, ${first}–${last}. Pick your exam board; every paper is on one page.`;
  if (description.length > 158) description = `Free ${subjectTitle(hub)} past papers and mark schemes for every exam board, ${first}–${last}. Pick your board; every paper is on one page.`;
  return { title, description };
}

/** Same shape as src/lib/metadata.ts, for a page that is not in the route registry. */
export function pastPaperMetadata(path: string, meta: { title: string; description: string }, image = "/og-lofi.png"): Metadata {
  const img = { url: image, width: 1200, height: 630, alt: meta.title };
  return {
    title: { absolute: meta.title },
    description: meta.description,
    alternates: { canonical: path },
    openGraph: { type: "website", url: path, title: meta.title, description: meta.description, siteName: site.name, locale: site.locale, images: [img] },
    twitter: { card: "summary_large_image", title: meta.title, description: meta.description, images: [img.url] },
  };
}

export const boardMetadata = (hub: SubjectHub, board: BoardPapers) =>
  pastPaperMetadata(boardPath(hub.slug, board.slug), boardPageMeta(hub, board), shareImage(hub));
export const subjectMetadata = (hub: SubjectHub) => pastPaperMetadata(subjectPath(hub.slug), subjectPageMeta(hub), shareImage(hub));
