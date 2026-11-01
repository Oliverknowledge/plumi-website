"use client";

import { realtime, social } from "@/lib/social/browser";
import type { LibraryDriver } from "@/components/studyapp/library/driver";
import type { LobbyRealtime } from "./lobbyWatch";

/** The real thing: the website's Supabase client, the same project and accounts as the iPad. `me` is filled in by the page. */
export function browserDriver(): Omit<LibraryDriver, "me"> {
  return {
    social,
    realtime: () => realtime() as unknown as LobbyRealtime | null,
  };
}
