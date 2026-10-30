import { NextResponse } from "next/server";

import { leaveWaitlist } from "@/lib/waitlist/leave";
import { emailFromParam } from "@/lib/waitlist/unsubscribe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Leave the Android waitlist. POST only, so a mail scanner opening the link in an email cannot take anyone off the list:
 * the page asks first, and a mail app's one-click "Unsubscribe" (RFC 8058) posts here with the same `e` and `t`.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const email = emailFromParam(url.searchParams.get("e"));
  const token = url.searchParams.get("t");
  if (!email || !token || !/^[0-9a-f]{64}$/i.test(token)) {
    return NextResponse.json({ ok: false, code: "bad_link", message: "That link isn't right." }, { status: 400 });
  }
  switch (await leaveWaitlist(email, token)) {
    case "left":
      return NextResponse.json({ ok: true, code: "left" });
    case "bad_link":
      return NextResponse.json({ ok: false, code: "bad_link", message: "That link isn't right." }, { status: 400 });
    default:
      return NextResponse.json({ ok: false, code: "server_error", message: "Something went wrong. Try again in a moment." }, { status: 502 });
  }
}
