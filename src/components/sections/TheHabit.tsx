import { Mascot, type MascotPose } from "@/components/ui/Mascot";
import { Section } from "@/components/ui/Section";
import { habit, sections } from "@/content/copy";

/**
 * A band, not a chapter.
 *
 * This is the section most at risk of turning Plumi into Duolingo, so it gets
 * one screen and no more. The emotional design is a layer on a serious product;
 * the moment it becomes the argument, a sixth-former stops taking the rest of
 * the page seriously.
 *
 * Two things are deliberately missing, and both are absences of fact rather
 * than of taste:
 *   · No streak count. The streak engine exists but it could not be confirmed
 *     that marking a paper or sitting an exam turns the day, so the site does
 *     not claim it.
 *   · No app blocking. Focus Mode's shield is written but the Screen Time
 *     entitlement has not been granted, so today it is a study timer, and that
 *     is what this says.
 *
 * The mascot's three states are the app's three, and the worst of them is
 * asleep. Nothing anywhere in Plumi is disappointed in you.
 */
export function TheHabit() {
  return (
    <Section copy={sections.theHabit} tone="surface">
      <ol className="grid gap-8 sm:grid-cols-3 sm:gap-6">
        {habit.poses.map((state, index) => (
          <li key={state.pose} className="flex items-center gap-5 sm:block">
            <Mascot pose={state.pose as MascotPose} size={124} className="sm:mb-5" />

            <div className="min-w-0">
              {/* The daily goal, filling. A bar rather than a ring: a ring is
                  the visual language of every habit app on the store. */}
              <div
                className="h-1.5 w-full max-w-[11rem] overflow-hidden rounded-full bg-[var(--color-fill-strong)]"
                aria-hidden="true"
              >
                <span
                  className="block h-full rounded-full bg-[var(--color-blue-600)]"
                  style={{ width: `${[0, 60, 100][index]}%` }}
                />
              </div>

              <p className="mt-3 text-[1.0625rem] font-medium">{state.caption}</p>
              <p className="mt-1 text-[0.9375rem] text-[var(--color-ink-secondary)]">{state.detail}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-12 measure-wide border-t border-[var(--color-hairline)] pt-10 text-[0.9375rem] leading-relaxed text-[var(--color-ink-secondary)]">
        {habit.focusLine} <span className="text-[var(--color-ink)]">{habit.reassurance}</span>
      </p>
    </Section>
  );
}
