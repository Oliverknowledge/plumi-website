"use client";

import { useEffect, useState, type ComponentType } from "react";
import type { CalculatorControl } from "@/components/questionBank/Calculator";
import { loadCalculatorPanel } from "@/lib/calculatorWarmup";
import { calculatorStore, useCalculatorState } from "@/lib/studyapp/questions/calculatorStore";

/** The pen tray's Calculator button: where focus goes when the calculator is minimised with Escape or its own button. */
const focusTrayButton = () => [...document.querySelectorAll<HTMLElement>("[data-calculator-button]")].find((b) => !b.closest("[inert]"))?.focus({ preventScroll: true });

/**
 * The calculator of the Questions tab. Nothing is loaded until the student taps the pen tray's Calculator button (calculatorStore): then the panel's code is fetched, and the emulator and its
 * worker start inside it. After that it stays mounted while it is minimised, so the number on its display is still there when it is opened again, through scrolling, filters and the move
 * from the feed to a sheet. Closed it takes no room on the page: it is a floating panel, so no list, no card and no pen stroke is moved by it.
 */
export function StudyCalculator() {
  const { started, open } = useCalculatorState();
  const [Panel, setPanel] = useState<ComponentType<{ control?: CalculatorControl }> | null>(null);
  useEffect(() => {
    if (!started || Panel) return;
    let live = true;
    loadCalculatorPanel().then((m) => { if (live) setPanel(() => m.Calculator); }).catch(() => { if (live) calculatorStore.reset(); });
    return () => { live = false; };
  }, [started, Panel]);
  useEffect(() => () => calculatorStore.reset(), []);
  if (!started || !Panel) return null;
  return <Panel control={{ open, onOpenChange: calculatorStore.setOpen, restoreFocus: focusTrayButton }} />;
}
