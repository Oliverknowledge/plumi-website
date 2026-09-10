import { Section } from "@/components/ui/Section";
import { PenDemo } from "@/components/scenes/PenDemo";
import { sections } from "@/content/copy";

/**
 * The anti-chatbot argument, made physically rather than stated.
 *
 * It sits directly under the hero because it is the only thing on this site a
 * visitor can actually use, and using it is what turns "join a waitlist for a
 * product that doesn't exist" into "keep the thing I just did". ChatGPT is
 * eliminated as an alternative here without ever being named.
 */
export function ThePage() {
  return (
    <Section copy={sections.thePage} tone="surface">
      <PenDemo />

      {/* Stated in prose for anyone the interaction never reaches — a screen
          reader, a visitor with a broken pointer, someone who simply scrolls
          past. The argument must not live only inside the demo. */}
      <p className="sr-only">
        A page of handwritten working is shown. Circling any line with a finger or an Apple Pencil
        selects it, and Plumi reads the line together with the printed question above it. It then
        offers to explain, hint, check or answer a question about what was circled. Asking again gives
        a different kind of help rather than the same explanation reworded: a nudge first, then the
        principle behind it.
      </p>
    </Section>
  );
}
