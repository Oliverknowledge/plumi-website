"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { noteCtaClick } from "@/lib/cta";
import { site } from "@/config/site";
import { studyEntry } from "@/lib/studyapp/routing";

/**
 * "Log in" and "Get started" in the website's header: both go to the web app, study.tryplumi.app. Log in opens
 * the app (a signed-in student lands on the Desk, anyone else on its sign-in page); Get started opens its
 * sign-up page. The app is a different address from the website, so a plain link, not a client navigation.
 * On localhost or a preview they stay on the same host, under /study (lib/studyapp/routing.studyEntry).
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
    <>
      <Link className="lp-acct-in" href={studyEntry("login", hostname)} prefetch={false} data-testid="header-login"
        onClick={() => noteCtaClick("header", "web_app", "Log in", site.studyDomain)}>Log in</Link>
      <Link className="lp-btn lp-navbtn lp-acct-start" href={studyEntry("start", hostname)} prefetch={false} data-testid="header-get-started"
        onClick={() => noteCtaClick("header", "web_app", "Get started", site.studyDomain)}>Get started</Link>
    </>
  );
}
