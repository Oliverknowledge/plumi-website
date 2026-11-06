import { loadMarkSchemeFile } from "@/lib/studyapp/proDecksLoader";
import { handleMarkScheme } from "@/lib/studyapp/markSchemeRoute";
import { realDeps } from "@/lib/pro/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The mark scheme cards of one specification: Pro accounts only (lib/studyapp/markSchemeRoute.ts, on lib/pro/server.ts). Not cached anywhere. */
export async function GET(req: Request, ctx: { params: Promise<{ spec: string }> }) {
  const { spec } = await ctx.params;
  return handleMarkScheme(req, spec, realDeps(), loadMarkSchemeFile);
}
