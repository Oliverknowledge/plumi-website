import "server-only";
import { cache } from "react";
import { makeLoader, type Loaded } from "./loader";
import { restApi, siteRestConfig } from "./rest";
import { createSharing } from "./service";

/**
 * Reading one shared deck on the server, for the public page. No sign-in and no cookies: the project's public key and the code.
 * A found deck is kept for 20 seconds per server instance (loader.ts), so a stopped deck is gone within that; every other answer
 * is read afresh. React's `cache` makes the page and its metadata share one read per request.
 */
export type { Loaded };
const load = makeLoader((code) => createSharing(restApi(siteRestConfig())).get(code));
export const loadSharedDeck = cache(load);
