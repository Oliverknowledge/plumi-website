import "server-only";

/** Takes an address off the waitlist through `leave_waitlist`, which checks the token itself. True when the token was right. */
const URL_ = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export type LeaveResult = "left" | "bad_link" | "unconfigured" | "error";

export async function leaveWaitlist(email: string, token: string): Promise<LeaveResult> {
  if (!URL_ || !KEY) return "unconfigured";
  try {
    const response = await fetch(`${URL_.replace(/\/$/, "")}/rest/v1/rpc/leave_waitlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: KEY },
      body: JSON.stringify({ p_email: email, p_token: token }),
      cache: "no-store",
    });
    if (!response.ok) return "error";
    return (await response.json().catch(() => false)) === true ? "left" : "bad_link";
  } catch {
    return "error";
  }
}
