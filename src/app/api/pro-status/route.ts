import { handleProStatus, realDeps } from "@/lib/pro/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Does the signed-in student hold Plumi Pro? Reads their own entitlement row with their own token; never takes a device slot. */
export function GET(req: Request) {
  return handleProStatus(req, realDeps());
}
