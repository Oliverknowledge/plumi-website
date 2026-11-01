/* eslint-disable @next/next/no-img-element -- pixel-art SVGs: no optimisation wanted, and nearest-neighbour scaling must not be touched. */

/**
 * The pixel Plumi, in the app's own pose set (the mascot-pixel sprites, public/study/mascot/).
 * Always drawn with nearest-neighbour scaling, and sized to a whole multiple of its 40-square
 * grid (40, 80, 120, 160) where it can be, so it stays crisp.
 *
 * Use sparingly. The mascot speaks in the first person, is short and kind, and promises the
 * marking ("I'll mark every line"). It never lectures and never appears on a marking verdict.
 */
export type MascotPose =
  | "idle" | "thinking" | "celebrating" | "curious" | "encouraging" | "sleeping" | "welcoming"
  | "explaining" | "focused" | "confused" | "proud" | "supportive" | "surprised" | "cool";

const files: Record<MascotPose, string> = {
  idle: "lofi-cozy",
  thinking: "thinking",
  celebrating: "celebrating",
  curious: "curious",
  encouraging: "encouraging",
  sleeping: "lofi-sleepy",
  welcoming: "welcoming",
  explaining: "explaining",
  focused: "focused",
  confused: "confused-anim",
  proud: "proud",
  supportive: "sad-but-supportive",
  surprised: "surprised",
  cool: "lofi-cool",
};

/** Poses that also have a moving version. */
const animated = new Set<MascotPose>(["idle", "thinking", "celebrating"]);

export function Mascot({
  pose = "idle", height = 96, animate = false, label,
}: {
  pose?: MascotPose;
  /** CSS pixels. 40, 80, 120 and 160 are whole multiples of the sprite grid. */
  height?: number;
  /** The moving version, where one exists. Reduced motion is the browser's to honour in an <img>; leave off for dense screens. */
  animate?: boolean;
  label?: string;
}) {
  const file = animate && animated.has(pose) ? `${files[pose]}-anim` : files[pose];
  return (
    <img
      className="st-mascot"
      style={{ ["--mh" as string]: `${height}px` }}
      src={`/study/mascot/plumi-${file}.svg`}
      alt={label ?? ""}
      width={height}
      height={height}
      draggable={false}
    />
  );
}
