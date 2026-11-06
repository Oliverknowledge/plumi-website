"use client";

import { useId } from "react";
import { useSyncSetting } from "@/lib/studyapp/sync/browser";
import { COPY, lineFor } from "@/lib/studyapp/sync/status";
import { useApp } from "@/lib/studyapp/store";

/**
 * "Back up my notes": one switch in Settings, off until the student chooses it (never a surprise upload). On, it merges their decks, cards and tasks
 * with their account in the background and says how that is going in one of three short lines. Drawn only for a signed-in student, and only once the
 * project is known to have it. Every word is in sync/status.ts, where a test holds it to the house rules.
 */
export function SyncSetting() {
  useApp();   // opens the study app's data, which is also what starts the backup
  const s = useSyncSetting();
  const id = useId();
  if (!s.visible) return null;
  const line = lineFor(s.status);
  return (
    <section className="stg-sec stg-sync" aria-labelledby={`${id}-t`} data-testid="settings-sync">
      <div className="stg-sync-row">
        <h3 id={`${id}-t`}>{COPY.title}</h3>
        <button
          type="button" role="switch" aria-checked={s.on} aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`} className={`stg-switch${s.on ? " on" : ""}`}
          onClick={() => (s.on ? s.disable() : s.enable())} data-testid="settings-sync-switch"
        ><span aria-hidden="true" /></button>
      </div>
      <p className="stg-sync-line" id={`${id}-d`} role="status" data-testid="settings-sync-status">
        {s.on ? line : COPY.offLine}
        {s.on && s.status.note && <><br /><span data-testid="settings-sync-note">{COPY.note}</span></>}
      </p>
      {s.on && <p className="stg-sync-line is-quiet">{COPY.onLine}</p>}
    </section>
  );
}
