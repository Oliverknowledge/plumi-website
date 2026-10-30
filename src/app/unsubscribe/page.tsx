import type { Metadata } from "next";

import { CosyPage, SectionHead } from "@/components/cosy/Chrome";
import { UnsubscribeForm } from "@/components/UnsubscribeForm";
import "@/app/pages.css";

/** A link in an email, never a page to find: kept out of search. */
export const metadata: Metadata = { title: "Leave the Android waitlist", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ e?: string; t?: string }> }) {
  const { e, t } = await searchParams;
  const valid = typeof e === "string" && typeof t === "string" && /^[0-9a-f]{64}$/i.test(t);
  return (
    <CosyPage>
      <section className="lp-wrap lp-aw">
        <SectionHead
          as="h1"
          eyebrow="Android"
          title={valid ? "Leave the Android waitlist?" : "That link isn't right."}
          lead={valid ? "We'll delete your email address and send you nothing more about Android." : "Use the Unsubscribe link in the email, or write to hello@tryplumi.app."}
        />
        {valid && <UnsubscribeForm e={e} t={t} />}
      </section>
    </CosyPage>
  );
}
