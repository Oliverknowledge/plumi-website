"use client";

import { discordUrl } from "@/config/site";
import { noteCtaClick } from "@/lib/cta";

/**
 * Join the Discord (founder, 19 October 2026): the community, beside the App Store badge.
 * A plain pixel key that opens Discord in a new tab and reports itself like every CTA
 * (`noteCtaClick`, `discord_clicked`). Discord's own terms and age rules apply there
 * (see the privacy page's "Joining the community").
 */
export function DiscordButton({ placement }: { placement: string }) {
  return (
    <a
      className="lp-btn lp-discord"
      href={discordUrl}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={`discord-${placement}`}
      onClick={() => noteCtaClick(placement, "discord", "Join the Discord", discordUrl)}
    >
      <svg width="22" height="22" viewBox="0 0 16 16" aria-hidden="true" shapeRendering="crispEdges">
        <path fill="currentColor" d="M3 4h10v1h1v6h-1v1h-3l-1-1H7l-1 1H3v-1H2V5h1zM5 7v2h2V7zm4 0v2h2V7z" />
      </svg>
      Join the Discord
    </a>
  );
}
