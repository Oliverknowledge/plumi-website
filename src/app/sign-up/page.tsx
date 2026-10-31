import type { Metadata } from "next";
import { AuthPage } from "@/components/account/AuthPage";
import "@/app/auth.css";

/** Make an account: Google, or an email and password confirmed with an emailed code. */
export const metadata: Metadata = {
  title: "Make your account",
  description: "Make a free Plumi account with Google or your email. The same account works in Plumi on iPad.",
  robots: { index: false, follow: false },
};

export default function SignUpPage() {
  return <AuthPage start="sign-up" />;
}
