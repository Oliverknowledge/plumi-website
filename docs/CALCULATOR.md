# Question-bank calculator

The maths and science question banks expose a Casio fx-570/991EX panel. The real
CY234 calculator model runs in a WebAssembly worker; there is no substitute
expression evaluator. All runtime requests are same-origin under
`public/calculator/`. No Casio login or remote iframe is involved.

The iframe mounts on first open, remains mounted while minimised, and unloads
when the bank page is left. Memory therefore survives filtering, scrolling and
minimising within a page, but is not promised across navigation or refresh.
Digit/operator shortcuts apply only when the iframe has focus. Tab traverses
the labelled keys; Escape minimises the panel and restores focus to its launcher.
The calculator display is a canvas and does not provide spoken mathematical output.

The floating panel follows the custom EX shell's 375:705 proportions, with rounded
silver body edges, a textured black face, stacked branding and a solar-panel detail.
The original CY234 key functions and labels are preserved. There is no surrounding
header, footer or side gutter. The two small
corner controls provide minimise and source credits; keyboard instructions
remain available to screen readers.

`python3 scripts/calculator/build-skin.py` regenerates `face-plumi.svg` from the
preserved original `face.svg`. The LCD, status indicators, key artwork and hit
regions all share the same 70px vertical offset to keep the new header aligned.

`src/content/calculator.ts` owns copy, subject eligibility and the initial model.
`src/components/questionBank/Calculator.tsx` owns the panel and checks both origin
and iframe identity on readiness/error messages. Loading times out after 30s;
retry creates a fresh worker. An iframe load event alone is not treated as ready.

`next.config.ts` permits same-origin framing for `/calculator/*` only; other
non-partner pages retain their existing framing protection. No root service
worker is installed by the calculator.

## Assets and source

See `public/calculator/NOTICE.md`, the preserved upstream README, and LICENSE for
the engine version, modifications and separate model-file provenance. The
upstream engine's AGPL licence and README non-commercial statement conflict;
clarify this with the engine maintainer before public release. The founders
have reported permission from Casio; no correspondence is stored in this repo.

## Verification

See [the recorded audit](CALCULATOR-QA.md) for tested results, fixed runtime
bugs and remaining validation gaps. Run `npm run calculator:test` for key-map,
keyboard, queued-input and real-firmware result checks.

Run `npm run typecheck`. Start `npm run dev`, visit
`/question-bank/edexcel-a-level-maths`, and check:

- No calculator resources are fetched until Calculator is opened.
- The panel reaches ready and the calculator display responds to keys.
- `2 + 3 =` gives 5; `sin(30)` gives 0.5 in degree mode.
- Minimise/reopen preserves the display; filters continue to work.
- Tab can enter and leave the iframe; Escape returns focus to the launcher.
- A narrow phone viewport keeps panel controls within the screen.
- Blocking `core.dat` or the worker produces a retry state, never a false ready.
- `/calculator/index.html` permits same-origin framing; `/question-bank` does not.
