# Plumi Rebuild — Storyboard (mobile-first)

> Purpose: a buildable, truthful storyboard for `/` (and `/l` variants resolving to the same story).  
> Priority order: **mobile → tablet → desktop**.  
> Rule: **Real Plumi UI must be shown via REAL screenshot crops** (from `/app/Plumi`). No reconstructed UI.  
> Mechanics diagram sequence is **illustrative SVG** (explicitly labelled), not app UI.

---

## Global layout + pacing rules

- **One new understanding per scene.** Each scene answers: *what did the visitor learn that they didn’t know 5 seconds ago?*
- **Copy budget:** 1 headline + (optional) 1 short sentence. No feature bullet walls.
- **Media-first:** every scene is anchored by a visual (real crop or illustrative SVG).
- **Controls:** any looping media must have a visible **Pause** control.
- **Reduced motion:** every scene must have a static resolved state.

### Required nav (floating)
- Links: **Product / How it works / Compare / Community**
- Primary CTA: **Join Discord** → https://discord.com/invite/mPhTczwfpk
- `data-testid`:
  - `data-testid="nav-product-link"`
  - `data-testid="nav-how-it-works-link"`
  - `data-testid="nav-compare-link"`
  - `data-testid="nav-community-link"`
  - `data-testid="header-join-discord-button"`

---

## Scene 1 — HERO: “The notebook tutors you”

### Visitor understanding
Plumi is an iPad notebook where help appears **on the page**, beside your handwriting.

### Visual (REAL screenshots, paced sequence)
Use the calculus sequence as a **looping stepper** (not fake annotations):
- `/app/Plumi/IMG_0684.PNG` (ordinary working + selection)
- `/app/Plumi/IMG_0686.PNG` (tutor asks derivative)
- `/app/Plumi/IMG_0687.PNG` (student writes derivative)
- `/app/Plumi/IMG_0688.PNG` (tutor confirms + factor prompt)
- `/app/Plumi/IMG_0689.PNG` (student writes 1/2 + “Now try this one” + e^(3x))

### Crop specs (buildable)
- **Mobile (390w):**
  - Crop tight to the working area; allow bezel to run off left/right.
  - Ensure at least one beat includes the Tutor panel (0686/0688/0689).
  - Keep the “Now try this one” line readable in the final beat.
- **Tablet (768–1024):**
  - Show more of the iPad chrome + tooltray.
- **Desktop (1440):**
  - Can show full iPad frame with desk shadow; avoid “floating mockup” look.

### Motion + controls
- Default: auto-advance every ~1.2–1.6s with a soft crossfade.
- Controls:
  - Pause/Play: `data-testid="hero-media-pause-button"`
  - Step dots: `data-testid="hero-media-step-1"` … `step-5`
- Reduced motion: show final frame (0689) + manual step buttons only.

### Copy
- Headline: short, calm.
- CTA: **Join Discord** (primary). Secondary: “See how it works”.
- Countdown to launch (25 Sep 2026): `data-testid="launch-countdown"`

---

## Scene 2 — MECHANICS ASSEMBLY (Illustrative SVG): “Plumi builds the problem”

### Visitor understanding
Plumi can construct and reason about **exam-style diagrams**, not just text.

### Visual (ILLUSTRATIVE, not app UI)
A custom editorial SVG on paper:
- Inclined plane
- Block on plane
- Pulley
- Hanging mass
- String connection
- Angle θ
- Force vectors (weight components, tension, normal reaction, friction)

### Required choreography (explicit steps)
Label each step (small caption under the SVG):
1. Plane appears
2. Block snaps onto plane
3. Pulley forms
4. Hanging mass appears
5. String connects
6. θ label
7. Forces appear

### Controls
- Stepper buttons:
  - `data-testid="mechanics-step-prev-button"`
  - `data-testid="mechanics-step-next-button"`
  - `data-testid="mechanics-step-pause-button"`
- Reduced motion: show final assembled diagram + a numbered list of steps.

### Copy
- Headline only. Optional one sentence: “Built like an exam figure: minimal, precise.”

---

## Scene 3 — MISTAKE → EVIDENCE (continue SAME diagram)

### Visitor understanding
Plumi distinguishes *what you got right* from *the misconception*, and turns it into evidence.

### Visual (ILLUSTRATIVE continuation)
Continue the **same SVG diagram** (do not reset):
- Show friction direction/value **correct**.
- Show **wrong normal reaction** (explicitly wrong), then highlight it as the misconception.
- Show a small “evidence” chip/callout (editorial, not app UI).

### Copy
- Headline: “A mistake becomes evidence.”
- One sentence max: “Right friction. Wrong normal reaction. Plumi remembers the difference.”

---

## Scene 4 — TARGETED NEXT PROBLEM (continue SAME diagram)

### Visitor understanding
The next practice problem is targeted and **keeps continuity** with the same concept.

### Visual
- Still the same diagram, now with a new prompt beneath it (editorial typeset).
- Also include a **REAL proof** crop that practice continues from your work:
  - `/app/Plumi/IMG_0689.PNG` close crop on “Now try this one.”

### Crop specs
- Mobile: crop only the “Now try this one” + next integral line.

### Copy
- Headline: “Practice that comes from you.”

---

## Scene 5 — FOCUS (truthful: timer only)

### Visitor understanding
Focus is about protecting time and measuring real work — **not blocking apps**.

### Visual (REAL crop)
- `/app/Plumi/IMG_0709.PNG` crop the top strip showing “FOCUS … / 30 min studied”.

### Composition
- Place the strip as a thin overlay above a paper section (like a status bar).

### Copy
- Headline: “Protect the time.”
- One sentence: “Focus Mode times real work.”

---

## Scene 6 — FREE NOTEBOOK (real library + tools)

### Visitor understanding
Even without Pro, Plumi is a real notebook: folders, PDFs, tools.

### Visual (REAL crops)
- `/app/Plumi/IMG_0713.PNG` library with notebooks
- `/app/Plumi/IMG_0714.PNG` subject folder Notes/Past papers
- `/app/Plumi/IMG_0705.PNG` tooltray + paper

### Copy
- Headline: “Your notebook is still a notebook.”
- One sentence: “Writing and organising your work is free.”

---

## Scene 7 — COMPOUNDING (Home recommendation proof)

### Visitor understanding
Plumi turns past work into a clear next action.

### Visual (REAL crop)
- `/app/Plumi/IMG_0709.PNG` crop to the “Your next move” card.

### Honesty note
If “Aster” branding is visible, either:
- crop tighter to remove it, or
- include a small caption “Development capture”.

### Copy
- Headline: “One thing to do. Then the next.”

---

## Scene 8 — COMPARE (fair, minimal)

### Visitor understanding
Plumi is distinct: notebook + on-page tutor + evidence-driven practice.

### Visual
- Editorial comparison table (no competitor logos, no named attacks).
- Columns: Plumi / AI web tutor / Private tutor / Note-taking app.

### Copy
- Headline only.

---

## Scene 9 — COMMUNITY CTA (close)

### Visitor understanding
The next step is to join the community (not a fake scarcity waitlist).

### Visual
- Mascot: `/app/public/mascot/plumi-celebrating.webp`

### CTA
- Join Discord button: `data-testid="footer-join-discord-button"`

---

## Responsive storyboard summary

### Mobile (primary)
- Stacked scenes, minimal sticky.
- Close crops, readable handwriting.
- Manual stepper controls always visible.

### Tablet (iPad-native)
- More breathing room; device-scale media.
- Optional gentle pinned media for mechanics stepper.

### Desktop
- Allowed: sticky/pinned product theatre for mechanics + hero.
- Not allowed: scroll hijack, heavy 3D, constant looping without pause.
