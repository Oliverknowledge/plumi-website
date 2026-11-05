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

### Drag and full-screen update

- Confirmed right tilt and the running hover-wiggle animation in the browser.
- Native pointer drags moved the miniature and open panel; dropping the
  miniature did not launch the emulator. The panel grip keeps key presses
  independent of dragging. Arrow-key movement was also checked.
- Dragging toward the upper-left stopped at the 24px margin, with the hide
  control still reachable. Shrinking from 390 × 844 to 320 × 568 clamped the
  miniature back inside the smaller viewport.
- Full-screen mode was a native modal covering exactly 390 × 844. The
  calculator body measured 366 × 688; all 50 key centres hit their intended key.
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
- Calculator RAM persists within the mounted bank page, not across refresh or
  navigation. This behaviour is documented rather than treated as saved progress.

The engine licensing clarification already recorded in `CALCULATOR.md` and
`public/calculator/NOTICE.md` remains separate from this functional audit.
