"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { signInHref, useAccount } from "@/lib/account";

/**
 * The app is for signed-in students: signed out, it goes to the sign-in page and comes back here afterwards
 * (study.tryplumi.app/sign-in, the same page and the same accounts as the website and the iPad).
 *
 * This is a door, not a lock. The session lives in the browser, so the check runs in the browser; what a
 * signed-out visitor could reach by skipping it is only the tasks and cards saved on their own device. The
 * lock on anything shared (friends, the library, chat) is the server's row-level security.
 *
 * With accounts switched off (no Supabase project configured, e.g. a bare local build) there is nobody to
 * sign in as, so the app opens as it is.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready, user, on } = useAccount();
  const router = useRouter();
  const signedOut = on && ready && !user;

  useEffect(() => {
    if (signedOut) router.replace(signInHref("header", `${window.location.pathname}${window.location.search}`));
  }, [signedOut, router]);

  if (!on || user) return <>{children}</>;
  return (
    <div className="gate" role="status" aria-live="polite" data-testid="auth-gate">
      <Image src="/study/mascot/plumi-lofi-cozy.svg" alt="" width={64} height={64} unoptimized priority />
      <p>{signedOut ? "Taking you to sign in…" : "Opening your desk…"}</p>
    </div>
  );
}
