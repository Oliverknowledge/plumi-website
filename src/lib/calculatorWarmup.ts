/** One shared import, used by intent signals and question-bank idle loading. */
let panel: ReturnType<typeof importPanel> | undefined;
const importPanel = () => import("@/components/questionBank/Calculator");

export function saveCalculatorData() {
  return typeof navigator !== "undefined" && Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
}

export function loadCalculatorPanel() {
  return panel ??= importPanel().catch(error => { panel = undefined; throw error; });
}

export function warmCalculator() {
  if (saveCalculatorData()) return;
  void loadCalculatorPanel().then(module => module.preloadCalculatorAssets()).catch(() => { /* Opening can retry after a failed speculative load. */ });
}
