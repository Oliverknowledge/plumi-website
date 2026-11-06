import type { Metadata } from "next";
import { ProSuccess } from "@/components/studyapp/pro/ProSuccess";
import "../success.css";

export const metadata: Metadata = { title: "You're all set" };

/**
 * Where Stripe sends a student after they pay (study.tryplumi.app/success). The page does not believe the redirect: it asks
 * the server whether this account is Pro, and only says so when the server does (see ProSuccess).
 */
export default function SuccessPage() {
  return <ProSuccess />;
}
