import { loadMarkSchemeFile } from "@/lib/studyapp/proDecksLoader";
import { handleMarkScheme, supabaseEnv } from "@/lib/studyapp/proServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The mark scheme cards of one specification: Pro accounts only (lib/studyapp/proServer.ts). Not cached anywhere. */
export async function GET(req: Request, ctx: { params: Promise<{ spec: string }> }) {
  const { spec } = await ctx.params;
  return handleMarkScheme(req, spec, { env: supabaseEnv(), fetch, now: Date.now }, loadMarkSchemeFile);
}
