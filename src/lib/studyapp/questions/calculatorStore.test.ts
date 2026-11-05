import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { offersCalculator } from "@/content/calculator";
import { calculatorState, calculatorStore } from "./calculatorStore";

beforeEach(() => calculatorStore.reset());

test("nothing is started until the first tap, and the first tap opens it", () => {
  assert.deepEqual(calculatorState(), { started: false, open: false });
  calculatorStore.toggle();
  assert.deepEqual(calculatorState(), { started: true, open: true });
});

test("after that a tap minimises and opens, and it stays started", () => {
  calculatorStore.toggle(); calculatorStore.toggle();
  assert.deepEqual(calculatorState(), { started: true, open: false });
  calculatorStore.toggle();
  assert.deepEqual(calculatorState(), { started: true, open: true });
});

test("minimising before it was ever started starts nothing", () => {
  calculatorStore.minimise();
  assert.deepEqual(calculatorState(), { started: false, open: false });
  calculatorStore.setOpen(true);
  assert.equal(calculatorState().started, true);
});

test("the tray offers it to the subjects the calculator is for, and not to the rest", () => {
  for (const s of ["Maths", "Biology A", "Physics", "Combined Science", "Economics"]) assert.equal(offersCalculator(s), true, s);
  for (const s of ["English Literature", "English Language", "History", "Religious Studies", "French"]) assert.equal(offersCalculator(s), false, s);
});
