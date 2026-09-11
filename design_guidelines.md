{
  "project": {
    "name": "Plumi marketing site rebuild",
    "type": "marketing_site",
    "audience": {
      "primary": "GCSE + A‑Level students",
      "devices": ["mobile first", "iPad/tablet native", "desktop product theatre"],
      "tone": ["warm", "tactile", "intelligent", "calm", "premium", "youthful-not-childish"],
      "copy_policy": {
        "maximalism": "Extremely little marketing copy. One headline + one short sentence per scene.",
        "truth": "Never claim unverified features (no cross-app blocking, no collaboration, no full syllabus coverage).",
        "no_fake_ui": "Use REAL screenshot crops only for product UI. Do not recreate old Plumi UI or mockups.",
        "cta": {
          "primary": "Join Discord",
          "discord_url": "https://discord.com/invite/mPhTczwfpk",
          "secondary": "Product / How it works / Compare / Community"
        },
        "launch": {
          "date": "2026-09-25",
          "countdown": "Show countdown pre-launch; after launch, resolve to 'Launched' state (never negative)."
        }
      }
    },
    "constraints": {
      "stack": "Next.js 16.3.4, React 19, TypeScript, Tailwind v4, Vercel",
      "no_external_api": true,
      "performance": "No heavy animation deps; prefer CSS/SVG + minimal JS; optimize images to WebP; avoid scroll hijack.",
      "accessibility": "Reduced motion supported; keyboard operable; visible focus; semantic HTML.",
      "testing": "All interactive + key informational elements must include data-testid (kebab-case)."
    }
  },

  "visual_personality": {
    "keywords": ["paper-first", "editorial", "iPad-native", "quiet confidence", "mechanism-led"],
    "avoid": [
      "generic SaaS hero/features grid",
      "purple AI aesthetic",
      "glass cards",
      "stock photos",
      "fake testimonials/logos",
      "large gradients",
      "marketing walls of text"
    ],
    "composition_rules": {
      "mobile": "Close crops, one interaction at a time, strong pacing, minimal sticky effects.",
      "tablet": "Feels like an iPad app: generous margins, calm surfaces, device-scale media.",
      "desktop": "Sticky/pinned product theatre allowed, but always performance-safe and optional under reduced motion."
    }
  },

  "design_tokens": {
    "source_of_truth": "/app/src/app/globals.css (already contains Plumi tokens transcribed from app theme)",
    "palette": {
      "paper": "var(--color-paper) #fcfcf9",
      "surface": "var(--color-surface) #f3f4f6",
      "elevated": "var(--color-elevated) #ffffff",
      "ink": "var(--color-ink) #16202e",
      "ink_secondary": "var(--color-ink-secondary) #5a6474",
      "ink_tertiary": "var(--color-ink-tertiary) #666f7d",
      "primary_blue": "var(--color-blue-600) #2158d4",
      "tutor_ink": "var(--color-tutor) #5a4fe0",
      "hairline": "var(--color-hairline) #e3e5e9",
      "dark_sections": {
        "paper_dark": "var(--color-paper-dark) #17191d",
        "surface_dark": "var(--color-surface-dark) #0d0e11",
        "elevated_dark": "var(--color-elevated-dark) #1d2025",
        "ink_inverse": "var(--color-ink-inverse) #f2f4f7"
      },
      "semantics": {
        "correct": "var(--color-correct)",
        "partial": "var(--color-partial)",
        "incorrect": "var(--color-incorrect)",
        "rule": "Semantic colours are never decorative; only used for marking meaning."
      }
    },
    "typography": {
      "fonts": {
        "sans": "Inter via next/font (already wired as --font-sans)",
        "serif_math": "System serif stack via --font-serif (Georgia/Times) for printed maths only",
        "handwriting": "PlumiHand stroke system in /app/src/lib/hand (not a font)"
      },
      "scale": {
        "display": "var(--text-display)",
        "h1": "var(--text-h1)",
        "h2": "var(--text-h2)",
        "h3": "var(--text-h3)",
        "lead": "var(--text-lead)",
        "eyebrow": "var(--text-eyebrow)"
      },
      "rules": [
        "Headlines use ink + ink-secondary (not brand blue) to keep the sentence about the student.",
        "Use serif only for printed maths fragments and marks brackets.",
        "Never use handwriting font; use the existing stroke-based Ink component for handwriting."
      ]
    },
    "radius_shadow_motion": {
      "radii": {
        "chip": "--radius-chip 7px",
        "control": "--radius-control 10px",
        "card": "--radius-card 14px",
        "sheet": "--radius-sheet 20px",
        "device": "--radius-device 38px"
      },
      "shadows": {
        "resting": "--shadow-resting",
        "floating": "--shadow-floating",
        "device": "--shadow-device"
      },
      "easing": {
        "soft_out": "--ease-out-soft",
        "soft_in_out": "--ease-in-out-soft"
      },
      "motion_policy": {
        "rule": "No animation should be required to understand content. Reduced motion resolves to static end states.",
        "implementation": "Use prefers-reduced-motion (already in globals.css)."
      }
    }
  },

  "layout_system": {
    "grid": {
      "container": "Use .container-plumi utility (max 78rem, responsive padding)",
      "reading_measure": "Use .measure (34rem) and .measure-wide (44rem) for copy blocks",
      "section_rhythm": "Use Section component spacing: py-20 sm:py-28 lg:py-36; content mt-12 sm:mt-16"
    },
    "navigation": {
      "style": "Small floating header; transparent over hero; gains paper blur + hairline after scroll.",
      "mobile": "No hamburger; show wordmark + Join Discord only; links move to footer.",
      "links": ["Product", "How it works", "Compare", "Community"],
      "cta": "Join Discord"
    }
  },

  "real_assets_and_crops": {
    "rule": "Use REAL screenshot crops; do not redraw UI. Crops must be specified with intended framing and safe areas.",
    "image_sources": {
      "screenshots_dir": "/app/Plumi",
      "mascot_dir": "/app/public/mascot"
    },
    "image_urls": [
      {
        "category": "hero-tutor-on-page-sequence",
        "description": "Use as a paced sequence (not fake annotation). Start ordinary notebook, then tutor hint, then correction, then 'Now try this one'.",
        "assets": [
          { "path": "/app/Plumi/IMG_0684.PNG", "use": "Hero frame 1: ordinary working + circled selection" },
          { "path": "/app/Plumi/IMG_0686.PNG", "use": "Hero frame 2: tutor asks derivative on page" },
          { "path": "/app/Plumi/IMG_0687.PNG", "use": "Hero frame 3: student writes derivative" },
          { "path": "/app/Plumi/IMG_0688.PNG", "use": "Hero frame 4: tutor confirms + factor prompt" },
          { "path": "/app/Plumi/IMG_0689.PNG", "use": "Hero frame 5: student writes 1/2 + 'Now try this one' + e^(3x)" }
        ],
        "crop_guidance": {
          "mobile": "Crop tight to the working + tutor handwriting; let bezel run off edges. Keep tutor panel visible in at least one beat.",
          "tablet": "Show more of the iPad chrome; keep tooltray readable.",
          "desktop": "Can show full iPad frame with subtle desk shadow; avoid floating mockup look."
        }
      },
      {
        "category": "practice-proof-real",
        "description": "Real populated Practice/Progress screenshots are missing; do not fake. Use these as truthful substitutes.",
        "assets": [
          { "path": "/app/Plumi/IMG_0689.PNG", "use": "Close crop on 'Now try this one' as the 'next problem' proof" },
          { "path": "/app/Plumi/IMG_0708.PNG", "use": "Home recommendation card (old Aster branding may be visible; crop to card area)" }
        ],
        "crop_guidance": {
          "mobile": "Use card-only crops; avoid showing Aster logo if possible.",
          "desktop": "If Aster visible, add a small caption 'Development capture' rather than hiding it with fake UI."
        }
      },
      {
        "category": "focus-truthful",
        "description": "Focus is a study timer only (no cross-app blocking). Use small strip capture only.",
        "assets": [
          { "path": "/app/Plumi/IMG_0709.PNG", "use": "Crop the top Focus strip (7/30 min studied) for Focus scene" }
        ],
        "crop_guidance": {
          "mobile": "Use as a thin overlay strip above paper; pair with calm copy 'Protect the time. Plumi times real work.'"
        }
      },
      {
        "category": "free-notebook-proof",
        "description": "Show library/folders and notebook tools as proof of real notebook product.",
        "assets": [
          { "path": "/app/Plumi/IMG_0713.PNG", "use": "Library with two notebooks" },
          { "path": "/app/Plumi/IMG_0714.PNG", "use": "Physics folder Notes/Past papers" },
          { "path": "/app/Plumi/IMG_0705.PNG", "use": "Notebook tooltray + blank grid paper" }
        ]
      },
      {
        "category": "mascot",
        "description": "Blue origami bird. Use sparingly: hero greeting, one transition guide, final CTA celebration.",
        "assets": [
          { "path": "/app/public/mascot/plumi-welcoming.webp", "use": "Hero corner / nav" },
          { "path": "/app/public/mascot/plumi-explaining.webp", "use": "Mechanics / evidence transition" },
          { "path": "/app/public/mascot/plumi-celebrating.webp", "use": "Final CTA" }
        ]
      }
    ]
  },

  "story_sections_and_components": {
    "component_path": {
      "existing_ui": [
        "/app/src/components/ui/CtaButton.tsx",
        "/app/src/components/ui/Mascot.tsx",
        "/app/src/components/ui/Section.tsx",
        "/app/src/components/scenes/HeroScene.tsx",
        "/app/src/components/scenes/PenDemo.tsx",
        "/app/src/components/sections/Hero.tsx",
        "/app/src/components/sections/UnderAClock.tsx",
        "/app/src/components/sections/WhatNow.tsx",
        "/app/src/app/globals.css"
      ],
      "note": "This repo is NOT shadcn-based; do not introduce shadcn/ui. Keep existing component patterns and Tailwind v4 tokens."
    },
    "required_new_story_mechanics": {
      "scene": "Mechanics assembly + mistake→evidence→targeted next problem continuing SAME diagram",
      "format": "Custom editorial SVG (black minimal exam figure) with step-by-step assembly and then a second beat showing correct friction but wrong normal reaction; then evidence; then next targeted question continuing same diagram.",
      "constraints": [
        "Label as illustrative (not a screen recording).",
        "No fake Plumi UI chrome around it.",
        "Must include incline/block/pulley/hanging mass/string/angle/forces.",
        "Must explicitly show friction correct and normal reaction wrong.",
        "Must show evidence leading to next problem using SAME diagram (not reset)."
      ]
    }
  },

  "interaction_and_motion": {
    "micro_interactions": {
      "buttons": {
        "component": "CtaButton",
        "rules": [
          "No transition: all. Use transition-[transform,opacity,background-color,box-shadow].",
          "Active press scale 0.97; opacity 0.86; no bounce.",
          "Focus-visible outline uses --color-blue-600 (already global)."
        ]
      },
      "media_sequences": {
        "hero": "Loop through real screenshot frames or existing HeroScene SVG; include pause button for loops.",
        "mechanics": "Scroll-driven or timed stepper; must have pause + step controls; reduced motion shows final assembled diagram + static callouts."
      },
      "scroll": {
        "policy": "No scroll hijack. Use IntersectionObserver to trigger state changes; keep content readable without motion.",
        "sticky": "Allowed on desktop only; mobile uses simple stacked beats."
      }
    },
    "controls": {
      "pause_loop": {
        "required": true,
        "data_testid": "media-loop-pause-button",
        "a11y": "aria-pressed reflects paused state"
      }
    }
  },

  "accessibility": {
    "contrast": "Use ink/ink-secondary on paper; avoid low-contrast greys on dark sections (use ink-inverse-secondary).",
    "reduced_motion": "prefers-reduced-motion must disable loops and scroll animations; show resolved states.",
    "keyboard": "PenDemo already supports keyboard via invisible buttons; replicate pattern for new interactive steppers.",
    "aria": "Illustrations can be aria-hidden if prose caption exists; interactive controls must be labelled."
  },

  "data_testid_convention": {
    "format": "kebab-case",
    "apply_to": [
      "nav links",
      "Join Discord CTA",
      "pause buttons",
      "scene step controls",
      "countdown",
      "comparison toggles",
      "any form inputs"
    ],
    "examples": [
      "data-testid=\"header-join-discord-button\"",
      "data-testid=\"nav-product-link\"",
      "data-testid=\"launch-countdown\"",
      "data-testid=\"mechanics-step-next-button\""
    ]
  },

  "instructions_to_main_agent": {
    "do_not_change": [
      "Keep body background opaque cream (var(--color-paper)).",
      "Keep Plumi blue mascot (no green).",
      "Do not add shadcn/ui or external UI kits.",
      "Do not invent Practice/Progress populated screens.",
      "Do not claim Focus blocks apps.",
      "Do not use large gradients; if any gradient exists, keep it decorative and under 20% viewport."
    ],
    "do_next": [
      "Create /app/docs/rebuild/storyboard.md with mobile/tablet/desktop beats and explicit crop specs.",
      "Plan mechanics SVG assembly scene + evidence + next problem continuation as a dedicated section.",
      "Replace any 'drawn not photographed' honesty copy with new requirement: use real screenshot crops where specified."
    ]
  }
}

---

<General UI UX Design Guidelines>  
    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms
    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text
   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json

 **GRADIENT RESTRICTION RULE**
NEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc
NEVER use dark gradients for logo, testimonial, footer etc
NEVER let gradients cover more than 20% of the viewport.
NEVER apply gradients to text-heavy content or reading areas.
NEVER use gradients on small UI elements (<100px width).
NEVER stack multiple gradient layers in the same viewport.

**ENFORCEMENT RULE:**
    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors

**How and where to use:**
   • Section backgrounds (not content backgrounds)
   • Hero section header content. Eg: dark to light to dark color
   • Decorative overlays and accent elements only
   • Hero section with 2-3 mild color
   • Gradients creation can be done for any angle say horizontal, vertical or diagonal

- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**

</Font Guidelines>

- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. 
   
- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.

- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.
   
- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly
    Eg: - if it implies playful/energetic, choose a colorful scheme
           - if it implies monochrome/minimal, choose a black–white/neutral scheme

**Component Reuse:**
	- Prioritize using pre-existing components from src/components/ui when applicable
	- Create new components that match the style and conventions of existing components when needed
	- Examine existing components to understand the project's component patterns before creating new ones

**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component

**Best Practices:**
	- Use Shadcn/UI as the primary component library for consistency and accessibility
	- Import path: ./components/[component-name]

**Export Conventions:**
	- Components MUST use named exports (export const ComponentName = ...)
	- Pages MUST use default exports (export default function PageName() {...})

**Toasts:**
  - Use `sonner` for toasts"
  - Sonner component are located in `/app/src/components/ui/sonner.tsx`

Use 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.
</General UI UX Design Guidelines>
