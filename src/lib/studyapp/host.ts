"use client";

import { useSyncExternalStore } from "react";
import { hostPath, isStudyHostname } from "./routing";

export { canonicalPath, hostPath } from "./routing";

/**
 * Where the app's own pages live, as the address bar should show them.
 *
 * One deployment serves both sites. On study.tryplumi.app the app is at the root (/, /library,
 * /flashcards: src/proxy.ts rewrites them); everywhere else (localhost, a preview, the main site's own
 * /study) it is under /study. Code writes the canonical `/study/...` form, and `useAppHref()` turns it into
 * the form for the host it is open on, so a link never sends a student to study.tryplumi.app/study/library.
 *
 * The server never knows the host here (the pages are static), so it renders the /study form and the browser
 * corrects it as soon as it reads the address. That is not a hydration mismatch: useSyncExternalStore
 * hydrates with the server value, then re-renders with the real one.
 */

const never = () => () => {};
const onStudyHost = () => isStudyHostname(window.location.hostname);

/** True in the browser when the app is open on study.tryplumi.app. */
export function useOnStudyHost() {
  return useSyncExternalStore(never, onStudyHost, () => false);
}

export function useAppHref() {
  const on = useOnStudyHost();
  return (canonical: string) => hostPath(on, canonical);
}
