"use client";

import { useState, type ReactNode } from "react";
import { track } from "@/lib/analytics";
import { usePro } from "@/lib/pro/client";
import { ProLockedPanel } from "./ProLockedPanel";

/**
 * A Pro feature's gate on the screen. Children show when the student is Pro; `fallback` (a locked tile or placeholder, supplied by the caller) when they are
 * free, or when their sign-in has run out (the plan is then not known, and the locked panel says to sign in again); `pending` (default nothing) while it is not known yet, so a Pro student never sees a lock and a free student never sees a flash of the feature.
 *
 *     <ProGate feature="mark-scheme-decks" fallback={<LockedTile />}>...</ProGate>
 *
 * This is the screen only. A feature that ships content or costs money must ALSO check on the server with `requirePro` (lib/pro/server.ts): see docs/study/pro.md.
 * `feature` is an id from lib/pro/features.ts. Use `useProLock(feature)` inside a fallback to open the locked panel.
 */
export function ProGate({ feature, fallback, pending = null, children }: { feature: string; fallback: ReactNode; pending?: ReactNode; children: ReactNode }) {
  const { state } = usePro();
  void feature;
  return <>{state === "pro" ? children : state === "free" || state === "session" ? fallback : pending}</>;
}

/** For a locked thing's tap: `lock.tap()` records it and opens the panel; render `lock.panel` once beside it. */
export function useProLock(feature: string): { tap: () => void; panel: ReactNode } {
  const [open, setOpen] = useState(false);
  return {
    tap: () => { track("pro_locked_tapped", { feature }); setOpen(true); },
    panel: open ? <ProLockedPanel feature={feature} onClose={() => setOpen(false)} /> : null,
  };
}
