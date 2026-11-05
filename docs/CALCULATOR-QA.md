# Calculator audit — 5 November 2026

## Conclusion

Representative workflows in all 12 main modes passed in the current in-app
desktop browser. The real shipped ROM/WASM also passed 56 automated display
checks in one continuous session, including five immediate OFF/ON cycles.
This is not exhaustive validation, Casio certification, or a claim of exact
equivalence with a physical calculator. The reference-inspired faceplate is a
custom skin; its solar panel is decorative. Original EX key labels and firmware
key mappings are retained, rather than copying the different key arrangement
in the supplied photograph.

Reference: [Casio fx-570EX/fx-991EX User's Guide](https://www.casio.com/content/dam/casio/global/support/manuals/calculators/pdf/004-en/f/fx-570_991EX_EN.pdf).

## Issues found and fixed

1. **Typing after clicking a key was ignored.** The upstream keyboard handler
   had been excluded for all accessible key-button targets. It now accepts
   calculator shortcuts from those buttons and leaves button activation focus
   when typing begins, so a following Enter evaluates. Enter/Space activation
   of a button reached with Tab is still handled by the accessibility bridge.
2. **ON did not reliably wake powered-off firmware.** ON was queued as a normal
   scanned key, but powered-off firmware does not consume that queue. The
   worker now dispatches ON directly to its existing hardware reset/wake path.
3. **Input immediately after ON could be lost.** A key scan left awaiting input
   before reset could consume keys while the firmware was booting. The queue
   now holds input until the LCD returns. Five repeated cycles submit AC and
   `8 × 7 =` immediately after ON, with no boot delay, and each displays 56.
4. **Busy polling discarded ordinary queued input.** The upstream AC-cancel
   poll removed the next queued key even when it was not AC, then cleared all
   input on cancellation. It now preserves ordinary typing and keeps keys
   queued after AC for the next calculation. Source-method regressions cover
   both behaviours; this is not an exhaustive long-calculation timing audit.

The keyboard and wake issues were reproduced before the fixes and checked in
the browser after the fixes. The final integrated panel was checked for immediate
wake input, Escape focus return, retained results after reopening, and browser
errors (none observed). Regression coverage is in `scripts/calculator/`.

## Observed browser results

These are manually observed LCD results, not automated numerical assertions.

| Workflow | Expected and observed |
| --- | --- |
| Keyboard after clicking AC: `1 + 2 Enter` | 3 |
| Multiplication: `9 × 6` | 54 |
| Precedence: `2 + 3 × 4` | 14 |
| Fractions: `1 ÷ 3 + 1 ÷ 6` | 1/2 |
| S⇔D on 1/2 | 0.5 |
| Square root of 9 | 3 |
| 2 to the power 10 | 1024 |
| sin(30), degree mode | 1/2 |
| SHIFT sin (inverse sine) of 0.5 | 30 degrees |
| sin(π/2), radian mode | 1 |
| `6.02 × 10^23 × 2` | 1.204 × 10^24 |
| Division by zero | Math ERROR |
| AC after Math ERROR, then `7 + 8` | 15 |
| Complex mode: square root of −1 | i |
| Equation/Func: x² − 3x + 2 = 0 | x₁ = 2, x₂ = 1 |
| One-variable statistics for 1, 2, 3 | mean 2, sum 6, sum of squares 14; population variance 0.6666666667 |
| Normal CD: lower −1, upper 1, σ = 1, μ = 0 | 0.6826894921 |
| Matrix determinant for [[1,2],[3,4]] | −2 |
| Base-N: decimal 10 converted to binary | 1010 |
| Table: x² for x = 1, 2, 3 | 1, 4, 9 |
| Inequality: x² − 3x + 2 > 0 | x < 1 or 2 < x |
| Ratio: 2:3 = x:9 | 6 |
| Vector: [3,4] + [3,4] | [6,8] |
| Spreadsheet: A1 = 2, A2 = 3, A3 = A1+A2 | 5 |
| Numerical integral: x² from 0 to 1 | 1/3 |
| Numerical derivative: x² at x = 3 | 6 |
| SOLVE: x² − 4, initial guess 1 | x = 2, residual 0 |
| SHIFT AC (OFF), ON, then `8 × 7` | 56 after wake |
| Integrated Escape and reopen | launcher focus restored; result retained |

## Key mapping and layout

### Lower casing and notice update

- Extended only the skin’s lower casing by 24px, from 375 × 705 to 375 × 729.
  Key artwork, LCD and hit-region coordinates are unchanged. Updated iframe
  sizing and floating/full-screen aspect ratios together.
- All 50 rendered key centres still hit their intended controls; `8 × 7 = 56`
  was checked again in the updated panel.
- Removed the floating info button and moved its public notice file into the
  repository’s documentation, preserving the source/licence records.

### Drag and full-screen update

- Confirmed right tilt and the running hover-wiggle animation in the browser.
- Native pointer drags moved the miniature and open panel; dropping the
  miniature did not launch the emulator. The panel grip keeps key presses
  independent of dragging. Arrow-key movement was also checked.
- Dragging toward the upper-left stopped at the 24px margin, with the hide
  control still reachable. Shrinking from 390 × 844 to 320 × 568 clamped the
  miniature back inside the smaller viewport.
- Full-screen mode was a native modal covering exactly 390 × 844. The
  calculator body measured 366 × 688 before the lower-casing extension; all 50 key centres hit their intended key.
  Full-screen mode also fitted 320 × 568.
- `8 × 7 = 56` remained displayed through dragging, entering/exiting full screen,
  repeated mode switches, minimising and reopening. Closing returned launcher
  focus and restored the body's original scroll setting.
- These are in-app browser checks at phone dimensions, not physical-device tests.

### Miniature launcher update

- Replaced the gold launcher with a tilted, illustrated miniature ClassWiz.
- Checked hide → edge tab → restore, opening the emulator, `8 × 7 = 56`,
  Escape focus return, and mobile hide/restore in the in-app browser.
- At 390 × 844, the 74 × 129 launcher and its separate 36 × 36 hide target
  were within the viewport, and each target centre hit the intended button.
- Motion uses CSS transforms, pauses on hover/focus and is disabled by the
  reduced-motion media rule. No firmware or mathematical behaviour changed.
- Eligibility covers 96 current banks. Every bank with a calculation-tagged
  sample is included; additional quantitative subjects are included explicitly
  because their newest samples need not contain a calculation.
- TypeScript, targeted ESLint and the existing runtime regression checks passed.

- All **50** key regions have unique firmware mappings; no mapping is missing.
- All **50** rendered key centres hit their intended key element in the
  integrated panel, with no overlapping element intercepting those centres.
- The earlier layout check at 390 × 844 showed the full 340 × 639.2 shell inside
  the viewport. This is a simulated phone layout, not a physical-phone test.

## Automated checks

Final results: **56 firmware checks passed, 0 failed**; source-method/key-map
regressions passed; TypeScript, targeted ESLint, JavaScript syntax and diff
checks passed. The production build completed successfully and generated all
7,654 pages. Its Node process emitted a nonfatal `--localstorage-file` warning.
The restricted build stalled at compilation; the completed run used normal
local permissions.

Run from the repository root:

```sh
npm run calculator:test
npm run typecheck
npm run build
npx eslint src/components/questionBank/Calculator.tsx src/content/calculator.ts src/components/questionBank/QuestionBank.tsx next.config.ts
node --check public/calculator/lib/simwrapper.js
node --check public/calculator/plumi-bridge.js
git diff --check
```

The runtime checks cover the shipped key map, post-click typing, Enter, normal
Tab/Space behaviour, browser shortcuts, ON wake buffering and busy-input
cancellation. These focused source-method checks stub hardware calls.

The firmware checks run the actual shipped worker, WASM CPU engine and CY234
ROM in a Node VM. Only browser transport and asset loading are shimmed. Each
expression's result pixels are compared with the firmware's rendering of an
independently calculated expected literal, with a nonblank-result assertion.
All 56 passed: 24 generated integer sums/products; precedence, parentheses,
negative/decimal/fraction arithmetic; roots/powers; degree and radian trig;
inverse trig; ln/exp; factorial, permutations and combinations; editing, Ans,
variable storage, complex arithmetic; and five immediate OFF/ON cycles. This
checks selected results, not every pixel/state or equivalence to physical hardware.

## Remaining validation

- No exhaustive test of every primary/SHIFT/ALPHA function or numerical edge case.
- The mode checks use one representative workflow each; additional operations,
  spreadsheet limits, every distribution, and error conditions remain untested.
- No comparison against a physical Casio or an independently supplied official
  model package for the entire test set.
- No Safari, Firefox, real iPhone/Android, long-session, or performance audit.
- The LCD remains a canvas without spoken mathematical output.
- Calculator RAM persists across client-side navigation through the shared root
  layout, but not across refreshes or full-page navigation.

The engine licensing clarification already recorded in `CALCULATOR.md` and
`docs/CALCULATOR-NOTICE.md` remains separate from this functional audit.

## Site-wide launcher update

- Moved the existing edge-tab calculator into the root layout and its styles
  into a dedicated global stylesheet. Removed the bank-only instance and
  subject eligibility restriction.
- Browser checks covered the homepage, question-bank index, AQA GCSE Maths
  bank and past-paper index. Each page had one launcher; `8 × 7 = 56` survived
  client-side navigation and minimising/reopening.
- At 390 × 844, the past-paper launcher and open calculator fitted the viewport.
- Lint, TypeScript, calculator runtime/56 firmware checks and bank consistency
  checks passed. Browser checks used webpack because the local Turbopack dev
  server failed to resolve its internal Google font loader.

## PR #189 loading and embed follow-up — 5 November 2026

The shared layout now renders a small launcher inside `SiteOnly`. Clicking it
imports the panel, its drag hook and its stylesheet. Only then is the calculator
iframe created, which loads its emulator scripts, worker, ROM and WebAssembly.
The 219,895-byte WASM file is never referenced by the initial route bundles.
The mounted panel still retains its state across normal site navigation.
Partner `/embed/` routes, shared decks and study app routes follow the existing
`SiteOnly` exclusions and do not mount the launcher or panel.

### Homepage first-load JavaScript

| Revision | Raw bytes | Sum of gzip bytes |
| --- | ---: | ---: |
| Before PR, `b108f6e` | 790,965 | 233,522 |
| Original PR, `4a92f2a` | 797,081 | 235,606 |
| With on-demand panel | 792,710 | 234,285 |

The final addition over the baseline is **1,745 raw bytes / 763 gzip bytes**
(0.33% compressed). This is the launcher, copy and async chunk-loading glue;
adding a working launcher has a small nonzero initial cost. The panel code is
in a separate 5,785-byte / 2,123-byte gzip chunk, absent from the initial script
list. Its CSS is also absent until first open. Initial homepage CSS increased
from 100,415 raw / 22,783 gzip bytes to 100,951 raw / 22,899 gzip bytes: the
launcher and always-available print exclusion cost **116 gzip bytes**.

Method: production webpack builds with `next build --webpack
--experimental-build-mode compile`, served with `next start`. Summed each
unique external `/_next/` script in the homepage HTML, excluding the `nomodule`
polyfill; measured raw file lengths and `node:zlib.gzipSync` separately per file.
These are local route-bundle sizes, not a CDN transfer or timing measurement;
unchanged third-party analytics and inline RSC/bootstrap data are outside this
comparison. Baseline and final builds were repeated with clean webpack caches.
All builds used the same local font-fixture configuration because the normal
Google font URLs failed the local Next font loader; no font or build-config
changes are committed. Fixtures affect font/CSS output, not calculator code.

### Browser and print checks

- Production homepage: no calculator iframe before opening; after clicking,
  the dialog and working emulator appear and the separate panel stylesheet is
  added. Minimise/reopen and keyboard activation work.
- Visited `/embed/question-bank/aqa-gcse-maths/ordering-numbers?ref=examnoob`
  after using the calculator: correct question content, **zero launchers,
  zero panels and zero iframes**. Checked the embed route directly; partner
  framing permissions and CSP were not changed.
- Inspected the loaded stylesheet: `@media print` hides both `.qb-calculator`
  and `.qb-calculator-restore` with `display: none !important`, even before the
  lazy panel styles load. No physical-printer check was performed.
- Downloaded question 1 from AQA GCSE Maths while the calculator was open.
  The PDF was **102,741 bytes, two A4 pages, no embedded JavaScript**. Rendered
  and visually checked both the question and mark-scheme pages: neither
  contains calculator controls or artwork. The PDF builder is unchanged and
  constructs pages from question crops and data, independently of page DOM.
- Full lint, typecheck, 16 PDF tests, calculator runtime checks, all 56 firmware
  checks, and `bank:status -- --check` (137 banks, zero problems) passed.
