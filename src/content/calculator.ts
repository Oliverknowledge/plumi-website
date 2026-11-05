/** Copy and model selection for the question-bank calculator. */
export const calculator = {
  label: "Calculator",
  open: "Open ClassWiz calculator",
  hide: "Hide little calculator",
  show: "Show little calculator",
  move: "Move calculator",
  dragHint: "Drag to move. You can also use the arrow keys when focused.",
  fullscreen: "Full screen calculator",
  exitFullscreen: "Exit full screen",
  title: "Casio fx-570/991EX",
  subtitle: "Your calculator, beside your questions.",
  frameTitle: "Casio fx-570/991EX scientific calculator",
  src: "/calculator/index.html?model=CY234&embed=1",
  loading: "Starting your calculator…",
  error: "The calculator couldn’t start. Please try again.",
  retry: "Try again",
  minimise: "Minimise calculator",
  hint: "Tap the keys or click the calculator and use your keyboard. Esc minimises it. Your work stays here while you browse these questions.",
  credits: "Emulator source and credits",
  creditsHref: "/calculator/NOTICE.md",
} as const;

export function offersCalculator(subject: string) {
  // Quantitative revision subjects, including statistics and applied calculations.
  // This is a revision aid, not a statement of each paper's exam-room rules.
  return /^(Maths|Further Maths|Additional Maths|Physics|Chemistry|Biology|Combined Science|Psychology|Economics|Business|Geography|Computer Science|Engineering Manufacture|Physical Education|Food Preparation and Nutrition|Design and Technology|Sociology)( [AB])?$/.test(subject);
}
