"use client";

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
  const line = signedOut ? "Taking you to sign in…" : "Opening your desk…";
  return (
    <div className="gate" role="status" aria-live="polite" aria-label={`Plumi. ${line}`} data-testid="auth-gate">
      <div className="gate-lockup" aria-hidden="true">
        <svg className="gate-mascot" viewBox="0 0 32 32" shapeRendering="crispEdges">
          <path fill="#514446" d="M28 1h2v12h-1v4h-2v3h-2v2h-2v2h-2v2h-3v2h-3v2h-3v1H9v-2H7v-3H6v-6H4v-2H2v-2H1v-5h2V9h3v1h2v3h1v3h1v-3h2v-3h2V8h2V6h3V4h3V3h3V2h3Z" />
          <path fill="#fbf6e9" d="M28 2h1v10h-1v4h-2v3h-2v2h-2v2h-2v2h-3v2h-3v2h-3v1H10v-2H8v-3H7v-6H5v-2H3v-2H2v-3h2v-2h2v2h1v3h1v2h3v-3h2v-3h2V9h2V7h3V5h3V4h3V3h2Z" />
          <path fill="#afdcd9" d="M28 3h1v9h-1v4h-2v3h-2v2h-2v2h-2v2h-2v-4h1v-3h-2v-3h2v-3h2V9h2V7h2V5h2V4h1Z" />
          <path fill="#689bc8" d="M28 3h1v7h-1v3h-2v2h-2v2h-2v2h-3v-2h1v-3h2v-3h2V8h2V5h1V4h1ZM8 24h1v2h2v2h3v1h-3v1h-1v-2H8Z" />
          <path fill="#514446" d="M10 19h2v2h-2zm6 0h2v2h-2zm-4 3h4v1h-1v1h-2v-1h-1z" />
          <path fill="#eeaaa3" d="M8 21h2v1H8zm10 0h2v1h-2z" />
        </svg>
        <svg className="gate-wordmark" viewBox="0 0 39 13" shapeRendering="crispEdges">
          <path fill="currentColor" fillRule="evenodd" d="M0 4h6v1h2v5H6v1H2v2H0zm2 2v3h4V6zM10 1h2v10h-2zm5 3h2v5h4V4h2v7h-6V10h-2zm11 0h11v1h1v6h-2V6h-3v5h-2V6h-3v5h-2z" transform="scale(.91 1)" />
          <path fill="currentColor" d="M37 1h2v2h-2zm0 3h2v7h-2z" />
        </svg>
      </div>
      <p aria-hidden="true">{line}</p>
      <div className="gate-dots" aria-hidden="true"><i /><i /><i /></div>
    </div>
  );
}
