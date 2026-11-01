"use client";

import { useSyncExternalStore } from "react";
import type { LibrarySession, Snapshot } from "@/lib/studyapp/library/session";

/** The visit's state as a store: a component that asks is told when it changes (never every step on the floor: that goes to the room). */
export function useSnapshot(session: LibrarySession): Snapshot {
  return useSyncExternalStore(session.subscribe, session.snapshot, session.snapshot);
}
