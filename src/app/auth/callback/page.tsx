import type { Metadata } from "next";
import { CosyPage } from "@/components/cosy/Chrome";
import { AuthCallback } from "@/components/account/AuthCallback";
import "@/app/pages.css";

/**
 * Where Google sends a student back to after "Continue with Google". The browser
 * finishes the sign-in (lib/account's client trades the code in the address for a
 * session) and returns to the page they started on. Not a page anyone should find.
 */
export const metadata: Metadata = {
  title: "Signing in",
  robots: { index: false, follow: false },
};

export default function AuthCallbackPage() {
  return (
    <CosyPage>
      <AuthCallback />
    </CosyPage>
  );
}
