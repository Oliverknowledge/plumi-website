# tools/movement: does it move like the reference?

Scores the real Grand Library engine (`src/components/landing/cafeScene.ts`, library mode) against numbers measured from a
reference screen recording. Reference analysis and the ranked change list: `docs/study/art/movement-reference.md`,
`docs/study/art/movement-gap.md`. No model calls. No Supabase (it drives the dev-only demo page).

## Run it

```bash
# 1. a dev server on any free port (one `next dev` per project directory; production builds 404 the demo page)
setsid npx next dev -p 3960 > /tmp/mv-dev.log 2>&1 & echo $! > /tmp/mv-dev.pid     # stop it later with: kill -- -$(cat /tmp/mv-dev.pid)

# 2. the harness (9 to 20 s once the page has compiled; the first request compiles for about 10 s)
node tools/movement/measure.mjs --base http://localhost:3960
node tools/movement/measure.mjs --me fox                 # you are the fox (any animal id of people/animals.ts)
node tools/movement/measure.mjs --zoo                    # all nine animals walk an open run: pose rate and speed each
node tools/movement/measure.mjs --dpr 2                  # a retina window (art scale k = 8)
node tools/movement/measure.mjs --json out.json --series series.json   # the numbers, and every recorded display frame
node tools/movement/measure.mjs --selftest               # no browser: the analysis must pass a synthetic reference-like walker
```

Needs Playwright (`npm i -D playwright`, or a global one on `NODE_PATH`; `/opt/node-tools` is found automatically) and a
Chromium. Options: `--width 1512 --height 949 --dpr 1`, `--target path/to/target.json`, `--no-fail` (always exit 0; otherwise
a scored FAIL exits 1). The demo URL is `<base>/study/library/demo` (`?me=<animal>`, `?zoo=1`).

## What it does

* Replaces `requestAnimationFrame` and `performance.now` with a **virtual clock** before the app boots (`inpage.mjs`
  `installClock`): exactly 60 display frames a second, nothing depends on machine speed, two runs print the same numbers.
  The engine's own 30 Hz gate and dt handling run unchanged on it.
* Drives the engine with synthetic key events on the canvas (and one click): each of four directions and four diagonals
  held 1.5 s then released; a turn through a diagonal; a push into a wall; a 100 ms tap; a click walk; 3 s of standing.
  A walker, or all nine animals, is made to walk an open run by setting its path (what a remote walker does).
* Each display frame it records what the engine would draw: `spriteAt()` (position), `frame()` (pose index), `camX/camY`,
  the person's `x, y, dir, moving, path`. It also renders the room with and without the player to look for a ground
  shadow, and reads the sheet pixels for bob and sprite height.
* Computes the same numbers as `ref_analysis.py` did from the video and prints them with a PASS/FAIL table against
  `target.json` (`info` rows are shown, never fail).

## If you change how the engine draws

The harness reads engine internals that exist at runtime in a dev build: `Cafe.spriteAt()`, `Cafe.frame()`,
`camX/camY/k/offX/offY/dpr`, `you.x/y/dir/moving/path`, `W.fits`, `grid`. If sprite placement becomes sub-art-pixel, keep
`spriteAt()` returning the **drawn** top left in art pixels (a float is fine; the harness finds the placement grid from
the values) and `frame()` the drawn frame index, or update `rec()` in `inpage.mjs`. If the camera is locked in a way
`follow()` no longer describes, `camTarget()` (used only to choose unclamped test positions) needs the same change.

## Files

| | |
|---|---|
| `measure.mjs` | the harness, analysis and table |
| `inpage.mjs` | the virtual clock and the in-page helpers (injected as source) |
| `target.json` | the reference numbers, tolerances, where in the clip each comes from, which are `info` |
| `ref_analysis.py` | the video analysis that produced the numbers (needs `opencv-python-headless`, `numpy`; about 3 minutes; writes a 3 GB scratch file you delete after) |
