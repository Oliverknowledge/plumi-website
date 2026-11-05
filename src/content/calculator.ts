/** Copy and model selection for the question-bank calculator. */
export const calculator = {
  label: "Calculator",
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
  return /^(Maths|Further Maths|Additional Maths|Physics|Chemistry|Biology|Combined Science)( [AB])?$/.test(subject);
}
