import { NextResponse } from "next/server";
import { discordUrl } from "@/config/site";
export const runtime = "nodejs";
// The website now uses Discord, not a signup form. Do not collect legacy POSTs.
export async function POST() {
  return NextResponse.json({ ok: false, code: "community_only", message: "Join the Plumi community on Discord instead.", url: discordUrl }, { status: 410 });
}
