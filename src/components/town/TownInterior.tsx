"use client";

import { useEffect, useState } from "react";
import { cafeDemoDriver } from "@/lib/studyapp/library/cafeDemo";
import { demoDriver } from "@/lib/studyapp/library/demo";
import { CAFE_ROOM } from "@/lib/studyapp/library/rooms";
import type { InteriorId } from "@/lib/town/place";
import { LibraryRoom } from "@/components/studyapp/library/Library";

/**
 * What is behind a door (dev page): the real room and panel on the fake world, exactly as /study/library/demo and /study/cafe/demo. Loaded only when a
 * door is opened (a separate chunk). ESC leaves for the town unless the library's own panel, menu or Leave question is open (those answer ESC first);
 * the library's "Leave the library" and the button below do the same.
 */
export default function TownInterior({ id, onExit }: { id: InteriorId; onExit: () => void }) {
  const [driver] = useState(() => (id === "cafe" ? cafeDemoDriver({}) : demoDriver({})));
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      // the library closes ONE thing per Escape: its drawer, its menu, its Leave question; only with none of them open does Escape leave the building
      if (document.querySelector('.lb-drawer.is-open, .lb-mpop, .lb-ask, [role="dialog"]')) return;
      e.preventDefault(); e.stopPropagation();       // the library's own handler (bubble phase) sees defaultPrevented and does nothing
      onExit();
    };
    window.addEventListener("keydown", esc, true);
    return () => window.removeEventListener("keydown", esc, true);
  }, [onExit]);
  return (
    <>
      <LibraryRoom driver={driver} onLeave={async () => { onExit(); return true; }} room={id === "cafe" ? CAFE_ROOM : undefined} />
      <div className="tw-exit"><button type="button" className="btn" onClick={onExit} data-testid="town-exit" aria-label="Back to the town">
        <svg className="tw-ico" viewBox="0 0 20 20" aria-hidden="true"><path d="M13 4l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>Town
      </button></div>
    </>
  );
}
