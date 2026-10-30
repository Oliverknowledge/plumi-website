"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { track } from "@/lib/analytics";
import "@/app/android-cta.css";

/**
 * Plumi is iPad only today. Every way onto the Android waitlist (/android) lives here, so each reports
 * itself the same way (`cta_clicked`, `cta_kind: android_waitlist`, with its `placement`).
 */
export const androidPath = "/android";

/** Google's Material "android" mark, in the text colour. */
export function AndroidIcon({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className="aw-icon">
      <path d="M6 18c0 .55.45 1 1 1h1v3.5a1.5 1.5 0 0 0 3 0V19h2v3.5a1.5 1.5 0 0 0 3 0V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8A1.5 1.5 0 0 0 2 9.5v7a1.5 1.5 0 0 0 3 0v-7A1.5 1.5 0 0 0 3.5 8zm17 0A1.5 1.5 0 0 0 19 9.5v7a1.5 1.5 0 0 0 3 0v-7A1.5 1.5 0 0 0 20.5 8zm-4.97-5.84l1.3-1.3a.5.5 0 0 0-.7-.7l-1.48 1.48A5.97 5.97 0 0 0 12 1c-.96 0-1.86.23-2.66.63L7.85.15a.5.5 0 0 0-.7.7l1.31 1.31A5.98 5.98 0 0 0 6 7h12c0-1.99-.97-3.75-2.47-4.84zM10 5H9V4h1v1zm5 0h-1V4h1v1z" />
    </svg>
  );
}

const noChange = () => () => {};

/** Apple's logo, in the text colour: the mark beside "Try on iPad" in the top bar. */
export function AppleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className="aw-icon aw-apple">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

/** True on an Android phone or tablet, once the page is in the browser. False on the server and the first paint. */
export function useIsAndroid(): boolean {
  return useSyncExternalStore(noChange, () => /android/i.test(navigator.userAgent), () => false);
}

function note(placement: string, label: string) {
  track("cta_clicked", { placement, cta_kind: "android_waitlist", label, destination: "self" });
}

/** The pill in the top bar: the Android mark and "Android waitlist" (the mark alone on a small screen). */
export function AndroidHeaderButton({ className = "lp-btn lp-navbtn" }: { className?: string }) {
  return (
    <Link href={androidPath} className={`${className} aw-header`} data-testid="header-android-button"
      aria-label="Join the Android waitlist" onClick={() => note("header", "Android waitlist")}>
      <AndroidIcon />
      <span className="aw-header-label">Android waitlist</span>
    </Link>
  );
}

/** A quiet line under a download badge for the student whose phone or tablet is not an iPad. */
export function AndroidInlineLink({ placement }: { placement: string }) {
  return (
    <Link href={androidPath} className="aw-inline" data-testid={`${placement}-android-link`}
      onClick={() => note(placement, "On Android? Join the waitlist")}>
      <AndroidIcon size={16} />
      <span>On Android? Join the waitlist</span>
    </Link>
  );
}

/** The key an Android visitor gets in place of "Send it to my iPad". */
export function AndroidKey({ placement }: { placement: string }) {
  return (
    <Link href={androidPath} className="aw-key" data-testid={`${placement}-android-key`}
      onClick={() => note(placement, "Join the Android waitlist")}>
      <AndroidIcon size={20} />
      <span>Join the Android waitlist</span>
    </Link>
  );
}
