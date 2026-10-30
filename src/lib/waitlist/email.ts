import "server-only";

import { site } from "@/config/site";
import { androidWelcomeHtml, androidWelcomeSubject, androidWelcomeText } from "@/lib/waitlist/androidWelcomeEmail";

/**
 * Sends the Android waitlist's welcome email through Resend's HTTP API (no SDK: one POST).
 *
 * It is a courtesy, never a gate: the signup is already saved when this runs, so a missing key or a failed
 * send is logged and the student still sees "You're on the list". Nothing is sent without RESEND_API_KEY.
 *
 * The From address must be on a domain verified in Resend (tryplumi.app). See docs/WAITLIST.md.
 */
const API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.WAITLIST_EMAIL_FROM ?? `Plumi <${site.contactEmail}>`;
const ENDPOINT = process.env.RESEND_API_URL ?? "https://api.resend.com/emails";

export type EmailResult = "sent" | "unconfigured" | "failed";

export async function sendAndroidWelcome(to: string): Promise<EmailResult> {
  if (!API_KEY) {
    console.error("[plumi] Android welcome email not sent: RESEND_API_KEY is not set. See docs/WAITLIST.md.");
    return "unconfigured";
  }
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        reply_to: site.contactEmail,
        subject: androidWelcomeSubject,
        html: androidWelcomeHtml(),
        text: androidWelcomeText(),
        headers: { "List-Unsubscribe": `<mailto:${site.contactEmail}?subject=unsubscribe>` },
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error(`[plumi] Android welcome email failed: Resend responded ${response.status}: ${(await response.text().catch(() => "")).slice(0, 200)}`);
      return "failed";
    }
    return "sent";
  } catch (cause) {
    console.error("[plumi] Android welcome email failed:", cause instanceof Error ? cause.message : cause);
    return "failed";
  }
}
