import type { Metadata } from "next";
import { AuthPage } from "@/components/account/AuthPage";
import "@/app/auth.css";

/** Sign in: Google, email and password, or an emailed code (components/account/AuthPage). */
export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Plumi with Google, your email and password, or a code by email. The same account as Plumi on iPad.",
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return <AuthPage start="sign-in" />;
}
