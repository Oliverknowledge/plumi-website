"use client";

import { browserApi, realtime, social } from "@/lib/social/browser";
import type { LibraryDriver } from "@/components/studyapp/library/driver";
import { farewellFor } from "./farewell";
import { browserLease } from "./lease";
import type { LobbyRealtime } from "./lobbyWatch";

/** The real thing: the website's Supabase client, the same project and accounts as the iPad. `me` is filled in by the page. */
export function browserDriver(): Omit<LibraryDriver, "me" | "farewell" | "lease"> {
  return {
    social,
    realtime: () => realtime() as unknown as LobbyRealtime | null,
    current: () => browserApi.userId(),
  };
}

/** What belongs to one student's visit and so is made when their id is known: how to leave as them, and their one-tab lease. */
export function visitOf(userId: string): Pick<LibraryDriver, "farewell" | "lease"> {
  return { farewell: farewellFor(userId), lease: browserLease(userId) };
}
