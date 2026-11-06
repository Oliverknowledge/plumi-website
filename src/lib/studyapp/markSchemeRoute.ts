import { requirePro, type ProDeps } from "@/lib/pro/server";

/**
 * The mark scheme cards route, on top of the Pro layer (lib/pro/server.ts): an example of a route that ships Pro content. `requirePro` is its first line;
 * the cards are loaded (src/lib/studyapp/proDecksLoader.ts, server-only) only after it says yes.
 */

/** The ten specifications with mark scheme cards, as the URL names them (the lower case of the spec id). */
export const MS_SLUGS = ["aqa-7402", "ocr-h420", "aqa-8461", "aqa-7405", "ocr-h432", "aqa-8462", "aqa-7408", "ocr-h556", "edexcel-9ph0", "aqa-8463"] as const;
export type MsSlug = (typeof MS_SLUGS)[number];
export const isMsSlug = (s: unknown): s is MsSlug => typeof s === "string" && (MS_SLUGS as readonly string[]).includes(s);

/** GET /api/premade/markscheme/<spec>: the spec's cards (200) only to a Pro account; 400 an unknown spec (checked first), then the answers of `requirePro`. */
export async function handleMarkScheme(req: Request, spec: unknown, deps: ProDeps, load: (slug: MsSlug) => Promise<unknown>): Promise<Response> {
  if (!isMsSlug(spec)) return new Response(JSON.stringify({ error: "spec" }), { status: 400, headers: { "Cache-Control": "private, no-store", "Content-Type": "application/json" } });
  const g = await requirePro(req, deps);
  if (!g.ok) return g.response;
  const headers = { "Cache-Control": "private, no-store", "Content-Type": "application/json", "X-Content-Type-Options": "nosniff" };
  try { return new Response(JSON.stringify(await load(spec)), { status: 200, headers }); } catch { return new Response(JSON.stringify({ error: "data" }), { status: 500, headers }); }
}
