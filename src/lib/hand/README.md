# `src/lib/hand` — Plumi's handwriting

This is Plumi's stroke-based handwriting engine, ported from the iOS app so the
website can draw the product's *actual* hand rather than a lookalike font.

## Provenance

Ported from `PlumiKit/Design/PlumiPen`:

| Here | From |
| --- | --- |
| `glyphs.ts` | `PlumiHand.swift` — the glyph table, the aliases, the notdef box |
| `index.ts` | `PlumiHand.swift` (metrics, layout, `write`) and `PenStroke.swift` (`resample`, `PenRandom`) |
| `marks.ts` | `PenMark.swift` (`PlumiMarkGeometry`) and `MarkShapes.swift` (the fixed seed 41 the app's static silhouettes use) |

**The glyph coordinates are the app's own.** They were drawn for Plumi, they are
not derived from any typeface, and they are what makes a note on this site and a
note on a student's page the same handwriting. They were extracted from the Swift
table mechanically rather than retyped: 103 glyphs, 15 aliases, unchanged to the
last decimal. Do not round them, simplify them, or improve them here. If the hand
needs to change it changes in `PlumiHand.swift` first and is re-ported.

`PenRandom` is SplitMix64 over unsigned 64-bit arithmetic and is ported exactly,
which is why it is written in `bigint`: the per-character `dy` and `scale` drift
it produces is the thing that stops the writing reading as a font, and the same
seed has to give the same hand on both platforms.

## What is not ported

The app's pen also carries a velocity model (`PenPhysics`) that modulates ink
width along a stroke and times the animation by arc length. A browser draws a run
as one `<path>` with one width, so only the geometry crossed over. The arc-length
resampling did come with it — `stroke-dasharray` advances by distance, so an
unevenly sampled stroke would draw itself at an uneven speed.

The Swift emits raw polylines because it rasterises them itself as short
segments. `strokePath()` smooths through the resampled points with uniform
Catmull-Rom converted to cubic béziers, because `L` segments read as
machine-drawn at anything above caption size.

`marks.ts` keeps the app's absolute constants (an underline waves by ~2px, a nib
is 2.6px) because they were authored against a page at roughly 16px text. Pass
`strokeWidth` when a mark is blown up for a hero.

## Using it

```tsx
import { write, strokePath, strokeLength, measure } from "@/lib/hand";

const strokes = write("check the sign", { size: 28, box: { x: 0, y: 0, width: 320 } });
const { width, height } = measure("check the sign", 28, 320);

<svg viewBox={`0 0 ${width} ${height}`}>
  {strokes.map((stroke, i) => (
    <path
      key={i}
      d={strokePath(stroke)}
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke.width}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ strokeDasharray: strokeLength(stroke), strokeDashoffset: strokeLength(stroke) }}
    />
  ))}
</svg>
```

Pure TypeScript, no dependencies, no browser globals: a Server Component can
produce the finished `d` strings and a client component can animate the same
strokes. Strokes come back in the order a hand makes them, so animating them in
array order with a small stagger *is* the writing order.

Text is measured and wrapped, and truncated with an ellipsis past `maxLines`
(default 2). That limit is deliberate: Plumi is allowed to write "check the
sign", not a paragraph.
