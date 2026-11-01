/**
 * THE STUDY APP'S DESIGN TOKENS: the single source of truth.
 *
 * study.tryplumi.app is the iPad app's notebook in a browser, so its look is the app's
 * "lofi" look, not the marketing site's. The values here are transcribed from the app
 * (Sources/PlumiKit/Design/PlumiTheme.swift, PlumiColor / Lofi / LofiFonts, and the
 * lofi style spec in .context/handoffs/lofi/style-spec.md) and then checked, not trusted:
 * `npm run study:tokens` regenerates src/app/study/tokens.css from this file and
 * `npm run study:contrast` fails the build if a pair a student has to read, or a line a
 * student has to see, falls under WCAG.
 *
 * Two looks, two modes, four palettes:
 *
 *   blue  (the app's main look: a pale-blue desk, navy line)
 *   lime  (the app's option: a lime desk, cocoa line; kin to the marketing site)
 *
 *   light / dark of each.
 *
 * What a screen is allowed to do with these is in docs/study/design-system.md. The short
 * version: one line colour draws every border, hard shadow and selected fill; shadows are
 * hard and never blurred; pixel type is for voice, Nunito is for reading; green, amber and
 * red mean marking and nothing else.
 *
 * Do not add a hex to a component. Add a token here, and say what it is for.
 */

export const looks = ["blue", "lime"] as const;
export const modes = ["light", "dark"] as const;
export type Look = (typeof looks)[number];
export type Mode = (typeof modes)[number];

/** The app's own names for these, shown to a student. */
export const lookTitle: Record<Look, string> = { blue: "Blue", lime: "Lime" };

/** Every colour that changes with the look or the mode. CSS: `--st-<name>`. */
export const semanticNames = [
  // Surfaces
  "ground", "ground-deep", "card", "card-2", "inset", "inset-2", "tab-off",
  // Writing paper (chrome never recolours the page; see `paperStocks`)
  "paper", "rule",
  // Text
  "ink", "ink-2", "ink-3", "on-pastel",
  // The one line, and the quiet ones
  "line", "shadow", "hairline", "hairline-strong",
  // A chosen chip, tab or nav pill
  "sel-bg", "sel-fg",
  // Interaction
  "accent", "accent-strong", "accent-tint", "focus",
  // Marking: rationed, never decoration. `-ink` is the text-safe shade.
  "correct", "correct-ink", "correct-bg",
  "partial", "partial-ink", "partial-bg",
  "incorrect", "incorrect-ink", "incorrect-bg",
  // Plumi's own pen on the page
  "tutor", "tutor-bg",
  // What a topic square means
  "m-attention", "m-rusty", "m-developing", "m-strong",
] as const;
export type SemanticName = (typeof semanticNames)[number];
export type Palette = Record<SemanticName, string>;

/**
 * Marking colours are the app's (PlumiColor.correct and friends) with a text-safe shade added.
 * `tutor-bg` is lighter than the app's #E0F3F4: tutor ink on that measured 4.31:1, under AA.
 */
const markingLight = {
  correct: "#0F9D6B", "correct-ink": "#0A6B49", "correct-bg": "#E6F7F0",
  partial: "#C8791A", "partial-ink": "#8A5210", "partial-bg": "#FDF3E4",
  incorrect: "#D8453A", "incorrect-ink": "#A8321F", "incorrect-bg": "#FDECEA",
  tutor: "#0E7C86", "tutor-bg": "#EAF7F8",
} as const;
const markingDark = {
  correct: "#2FC08A", "correct-ink": "#4FD6A2", "correct-bg": "#0E2A20",
  partial: "#E9A94A", "partial-ink": "#F0BE6E", "partial-bg": "#2C2013",
  incorrect: "#F2695D", "incorrect-ink": "#F58A81", "incorrect-bg": "#2E1614",
  tutor: "#5CC8D0", "tutor-bg": "#102F31",
} as const;

export const palettes: Record<Look, Record<Mode, Palette>> = {
  blue: {
    light: {
      ground: "#C6DAF0", "ground-deep": "#B4CBE8", card: "#F5F9FF", "card-2": "#FDFDFF",
      inset: "#EEF4FC", "inset-2": "#DBE7F6", "tab-off": "#E3EEFA",
      paper: "#FDFDFF", rule: "#D6E3EF",
      ink: "#1F2A44", "ink-2": "#34425F", "ink-3": "#4A5A7A", "on-pastel": "#1F2A44",
      line: "#2B3A5C", shadow: "#2B3A5C", hairline: "#D6E3EF", "hairline-strong": "#B4CBE8",
      "sel-bg": "#2B3A5C", "sel-fg": "#F5F9FF",
      accent: "#2A5699", "accent-strong": "#1F4682", "accent-tint": "#DBE7F6", focus: "#2A5699",
      ...markingLight,
      "m-attention": "#C8553D", "m-rusty": "#E39B2D", "m-developing": "#8FC3E8", "m-strong": "#3F6FB0",
    },
    dark: {
      ground: "#111419", "ground-deep": "#0B0D10", card: "#1D2025", "card-2": "#25292F",
      inset: "#24272D", "inset-2": "#2E323A", "tab-off": "#181B20",
      paper: "#16181C", rule: "#2A2E35",
      ink: "#F2F4F7", "ink-2": "#A3ABB8", "ink-3": "#939CAA", "on-pastel": "#1F2A44",
      line: "#7C8596", shadow: "#000000", hairline: "#2C3037", "hairline-strong": "#3A3F48",
      "sel-bg": "#F2F4F7", "sel-fg": "#111419",
      accent: "#5A8CE8", "accent-strong": "#7BA5F0", "accent-tint": "#152341", focus: "#7BA5F0",
      ...markingDark,
      "m-attention": "#D66A52", "m-rusty": "#E39B2D", "m-developing": "#8FC3E8", "m-strong": "#5A8CE8",
    },
  },
  lime: {
    light: {
      ground: "#DCE597", "ground-deep": "#CBD580", card: "#FFFDF7", "card-2": "#FFFEFA",
      inset: "#FBF7EE", "inset-2": "#F0EBDF", "tab-off": "#EEF3C8",
      paper: "#FFFEFA", rule: "#D6E3EF",
      ink: "#3F322E", "ink-2": "#4D3F39", "ink-3": "#6B5A52", "on-pastel": "#3F322E",
      line: "#5B4741", shadow: "#5B4741", hairline: "#E5DED0", "hairline-strong": "#D6CBB8",
      "sel-bg": "#5B4741", "sel-fg": "#FBF7EE",
      accent: "#2F5A96", "accent-strong": "#234575", "accent-tint": "#DBE7F3", focus: "#2F5A96",
      ...markingLight,
      "m-attention": "#C8553D", "m-rusty": "#E39B2D", "m-developing": "#8FC3E8", "m-strong": "#3F6FB0",
    },
    dark: {
      ground: "#1F1A18", "ground-deep": "#171312", card: "#2C2522", "card-2": "#3A302B",
      inset: "#342B25", "inset-2": "#3A302B", "tab-off": "#26201D",
      paper: "#1F1A18", rule: "#2A2321",
      ink: "#F3E9D9", "ink-2": "#BCAB9B", "ink-3": "#A8978A", "on-pastel": "#3F322E",
      line: "#8A7365", shadow: "#0C0A09", hairline: "#4A3F39", "hairline-strong": "#5A4D45",
      "sel-bg": "#F3E9D9", "sel-fg": "#1F1A18",
      accent: "#8FB8E8", "accent-strong": "#B1D0F2", "accent-tint": "#36506B", focus: "#B1D0F2",
      ...markingDark,
      "m-attention": "#D66A52", "m-rusty": "#E39B2D", "m-developing": "#8FC3E8", "m-strong": "#7AA5F0",
    },
  },
};

/**
 * Colours that do not change with the look or the mode: the stationery set. A pastel face
 * is pastel in light and dark (PlumiColor.onPastel), and the ink on it is `on-pastel`.
 * CSS: `--st-<name>`.
 */
export const stationery = {
  "key-blue": "#6A9BD0", "key-blue-ink": "#1F2A3D", "blue-tint": "#DBE7F3",
  "key-green": "#A9C46C", "key-green-ink": "#233016",
  mint: "#B2E0DC", yellow: "#F2C96B", teal: "#7CC6C2", pink: "#F4A9B4", flame: "#E0605A",
  "lime-tint": "#EEF3C8",
  // A subject's cover, and its spine (the cover darkened 15 to 20 percent).
  "subj-maths": "#F2C96B", "subj-maths-spine": "#D9A94A",
  "subj-physics": "#6A9BD0", "subj-physics-spine": "#4F7FB5",
  "subj-chemistry": "#7CC6C2", "subj-chemistry-spine": "#5EAAA8",
  "subj-biology": "#A9C46C", "subj-biology-spine": "#87A64E",
  "subj-other": "#F4A9B4", "subj-other-spine": "#D98A97",
} as const;

/** Subjects Plumi teaches, in the order the app lists them. `id` is the `data-subject` value. */
export const subjects = [
  { id: "maths", title: "Maths" },
  { id: "physics", title: "Physics" },
  { id: "chemistry", title: "Chemistry" },
  { id: "biology", title: "Biology" },
  { id: "other", title: "Other" },
] as const;
export type SubjectId = (typeof subjects)[number]["id"];

/** Shape, spacing and type: the same in every look and mode. CSS: `--st-<name>`. */
export const metrics = {
  // The line: 3px on anything 36px or taller, 2px below that.
  bw: "3px", "bw-sm": "2px",
  // Hard, unblurred, y-only drop in the line colour: 3 header chips, 4 keys and tiles, 5 cards.
  "sh-sm": "3px", "sh-md": "4px", "sh-lg": "5px",
  "r-card": "18px", "r-lg": "14px", "r-md": "12px", "r-sm": "10px", "r-xs": "8px",
  // Space (Space.* in PlumiTheme.swift)
  "s-xxs": "2px", "s-xs": "4px", "s-s": "8px", "s-m": "12px", "s-l": "16px",
  "s-xl": "20px", "s-xxl": "24px", "s-h1": "32px", "s-h2": "40px", "s-h3": "56px", "s-h4": "72px",
  // Layout
  "reading": "1000px", "page": "1240px", "touch": "44px", "gutter": "clamp(16px, 4vw, 32px)",
  // Motion: step-based, never eased (the artifact has none; the press is the whole story)
  "t-press": "80ms",
} as const;

/**
 * Pen colours and highlighters, mirrored from InkPalette. This is the page's ink: it is
 * the student's, it is never recoloured by a look, and it has no white pen (a white pen
 * strands on a paper that flips to dark).
 */
export const inkPalette = {
  pens: [
    { id: "ink", name: "Ink", hex: "#16202E" },
    { id: "blue", name: "Blue", hex: "#1F4FBF" },
    { id: "red", name: "Red", hex: "#C0392B" },
    { id: "green", name: "Green", hex: "#117A54" },
    { id: "violet", name: "Violet", hex: "#6B3FA0" },
    { id: "orange", name: "Orange", hex: "#CC6A16" },
    { id: "teal", name: "Teal", hex: "#0E7490" },
    { id: "graphite", name: "Graphite", hex: "#5A6474" },
  ],
  highlighters: [
    { id: "yellow", name: "Yellow", hex: "#FFD500" },
    { id: "green", name: "Green", hex: "#2FD566" },
    { id: "blue", name: "Blue", hex: "#00A8F0" },
    { id: "pink", name: "Pink", hex: "#FF4D8D" },
    { id: "violet", name: "Violet", hex: "#9B5DE5" },
  ],
  /** Low enough that the writing underneath stays legible; fainter still on dark paper. */
  highlighterAlpha: 0.45,
  highlighterAlphaDark: 0.36,
} as const;

/**
 * The paper a page is drawn on (PaperTone). Independent of the chrome around it: a page keeps
 * its own stock in every look and mode, which is why the chrome can never recolour it by
 * accident. `ink` is the default pen as displayed on that stock (lightened on dark paper); `tutor`
 * and `wrong` are Plumi's pen and the wavy underline on a wrong line, which have to follow the
 * stock, not the mode: a dark page in a light app still needs the light teal.
 */
export const paperStocks = [
  { id: "cream", title: "Cream", page: "#FCFCF9", rule: "#DEDCD9", ink: "#16202E", tutor: "#0E7C86", wrong: "#D8453A", dark: false },
  { id: "white", title: "White", page: "#FFFFFF", rule: "#E4E6EA", ink: "#16202E", tutor: "#0E7C86", wrong: "#D8453A", dark: false },
  { id: "dark", title: "Dark", page: "#16181C", rule: "#2A2E35", ink: "#E8EBF0", tutor: "#5CC8D0", wrong: "#F2695D", dark: true },
] as const;
export type PaperStockId = (typeof paperStocks)[number]["id"];

/** CSS custom-property block for one palette, as `--st-name: value;` lines. */
export function paletteCss(p: Palette, mode: Mode): string {
  const lines = semanticNames.map((n) => `  --st-${n}: ${p[n]};`);
  return [`  color-scheme: ${mode};`, ...lines].join("\n");
}

/** Mode-independent tokens: stationery and metrics. */
export function constantsCss(): string {
  const lines = [
    ...Object.entries(stationery).map(([k, v]) => `  --st-${k}: ${v};`),
    ...Object.entries(metrics).map(([k, v]) => `  --st-${k}: ${v};`),
  ];
  return lines.join("\n");
}
