"use client";

import { useSyncExternalStore } from "react";
import { lookTitle, looks } from "./tokens";
import { readDark, readLook, subscribeAppearance, writeDark, writeLook } from "./appearance";
import { Chip, PixelIcon } from "./ui";

/** "blue|light": a primitive snapshot, so React can compare it. */
function snapshot() { return `${readLook()}|${readDark() ? "dark" : "light"}`; }

/**
 * The look (Blue or Lime) and the mode (light or dark), as two small groups of chips. This is
 * what Settings will hold; the style guide uses it to put every palette under a hand.
 */
export function AppearanceSwitch() {
  const state = useSyncExternalStore(subscribeAppearance, snapshot, () => "blue|light");
  const [look, mode] = state.split("|");
  return (
    <div className="st-row" style={{ ["--gap" as string]: "16px" }} data-testid="study-appearance">
      <div className="st-seg" role="group" aria-label="Look">
        {looks.map((l) => (
          <Chip key={l} selected={look === l} onClick={() => writeLook(l)} data-testid={`study-look-${l}`}>{lookTitle[l]}</Chip>
        ))}
      </div>
      <div className="st-seg" role="group" aria-label="Mode">
        <Chip selected={mode === "light"} onClick={() => writeDark(false)} data-testid="study-mode-light"><PixelIcon name="sun" size={16} />Light</Chip>
        <Chip selected={mode === "dark"} onClick={() => writeDark(true)} data-testid="study-mode-dark"><PixelIcon name="moon" size={16} />Dark</Chip>
      </div>
    </div>
  );
}
