import "server-only";
import { cache } from "react";
import { createSharing } from "./service";
import { restApi, siteRestConfig } from "./rest";
import type { SharedDeck } from "./contract";

/**
 * Reading one shared deck on the server, for the public page. No sign-in and no cookies are involved: it is the project's public
 * key and the code. `gone` is every way the deck is simply not there (unknown, stopped, hidden, rate limited, a project that has not
 * had the sharing migration, no project configured); `busy` is only a connection that failed, which is worth another try.
 */
export type Loaded = { kind: "deck"; deck: SharedDeck } | { kind: "gone" } | { kind: "busy" };

/** Once per request: the page and its metadata both ask. */
export const loadSharedDeck = cache(async (code: string): Promise<Loaded> => {
  const r = await createSharing(restApi(siteRestConfig())).get(code);
  if (r.ok) return { kind: "deck", deck: r.value };
  return r.reason === "offline" || r.reason === "busy" || r.reason === "other" ? { kind: "busy" } : { kind: "gone" };
});
