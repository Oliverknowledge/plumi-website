"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { noteCtaClick } from "@/lib/cta";
import { site } from "@/config/site";
import { studyEntry } from "@/lib/studyapp/routing";

/**
 * "Get started", top right of the website's header, goes to the web app, study.tryplumi.app (founder, 1 November
 * 2026: one button, not "Sign in" and "Get started"). Its sign-up page doubles as the way in: a student who is
 * already signed in (the session is shared by both hosts, lib/sessionStorage) is passed straight on to the Desk.
 * A different address from the website, so a plain link, not a client navigation. On localhost or a preview it
 * stays on the same host, under /study (lib/studyapp/routing.studyEntry).
 */
const never = () => () => {};
const host = () => window.location.hostname;
const SERVER_HOST = new URL(site.domain).hostname;

const useHostname = () => useSyncExternalStore(never, host, () => SERVER_HOST);

/** In the signed-in account menu: on to the app. */
export function OpenApp() {
  return (
    <Link role="menuitem" className="lp-acct-app" href={studyEntry("login", useHostname())} prefetch={false}
      onClick={() => noteCtaClick("account_menu", "web_app", "Open the app", site.studyDomain)}>Open the app</Link>
  );
}

export function StudyEntry() {
  const hostname = useHostname();
  return (
    <Link className="lp-btn lp-navbtn lp-acct-start" href={studyEntry("start", hostname)} prefetch={false} data-testid="header-get-started"
      onClick={() => noteCtaClick("header", "web_app", "Get started", site.studyDomain)}>Get started</Link>
  );
}
