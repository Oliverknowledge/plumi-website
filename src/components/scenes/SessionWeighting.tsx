"use client";

import { useRef } from "react";

import { useInViewOnce } from "@/lib/useInViewOnce";
import { useMotionReady } from "@/lib/useMotionReady";

import { bandColours, type Band } from "@/content/course";
import { whatNow } from "@/content/copy";

/**
 * Choose three topics evenly; Plumi weights them by what your work says.
 *
 * The bars start at the even split the student actually picked and move to the
 * weighting Plumi builds, so the adaptation is something the visitor watches
 * happen rather than something a caption asserts. This is the one place on the
 * page where the movement itself is the argument, which is why it is worth a
 * client component and a scroll trigger.
 *
 * A diagram, not a screen. The weighting is real: the session brief steers
 * toward the topics your marked work says you are weakest at, and the engine
 * keeps adjusting as you go. The app does not draw you a bar chart of it, so
 * this is presented as an explanation of the behaviour and never as a surface
 * you would find in the product.
 *
 * There are no percentages, for the same reason there are none anywhere else in
 * Plumi: the product publishes no confidence numbers, and a figure like "62%"
 * claims a precision nobody has earned. Relative width is the whole point and
 * it says everything a number would.
 *
 * It runs once, on approach, and never replays. A section that re-animates
 * every time it scrolls past is a section that is showing off. With reduced
 * motion the bars render resolved; only the transition is lost.
 */
export function SessionWeighting() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInViewOnce(ref, { amount: 0.5 });

  // False on the server and through hydration, so the first paint always shows
  // the even split the student picked. With motion off it resolves to the
  // weighted state immediately; with motion on it waits for the section to be
  // approached, which is when the movement is the argument.
  const animate = useMotionReady();
  const { picker, composition } = whatNow;
  const settled = animate ? inView : true;

  return (
    <div
      ref={ref}
      className="mt-4 rounded-[var(--radius-sheet)] border border-[var(--color-hairline)] bg-[var(--color-elevated)] p-6 shadow-[var(--shadow-resting)] sm:p-7"
    >
      {/* The picker, as the student left it. */}
      <p className="text-[1.0625rem] font-semibold">{picker.subject}</p>

      <ul className="mt-4 space-y-2.5">
        {picker.topics.map((topic) => (
          <li key={topic.name} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-[18px] shrink-0 place-items-center rounded-[5px] bg-[var(--color-blue-600)]"
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2.5 6.3 4.8 8.6 9.5 3.4"
                  stroke="white"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="min-w-0 flex-1 truncate text-[0.9375rem]">{topic.name}</span>
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: bandColours[topic.band as Band] }}
            />
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {[picker.duration, picker.mode].map((chip) => (
          <span
            key={chip}
            className="rounded-full bg-[var(--color-fill)] px-3 py-1 text-[0.8125rem] font-medium text-[var(--color-ink-secondary)]"
          >
            {chip}
          </span>
        ))}
        {/* A label, not a button — see the note in WhatNow. Nothing on this
            card can be started, so nothing on it is painted as startable. */}
        <span aria-hidden="true" className="ml-auto text-[0.875rem] font-medium text-[var(--color-blue-600)]">
          {picker.start} →
        </span>
      </div>

      {/* What Plumi did with those three topics. */}
      <div className="mt-7 border-t border-[var(--color-hairline)] pt-6">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-tertiary)]">
          {composition.label}
        </p>

        <ul className="mt-4 space-y-3.5">
          {composition.after.map((topic, index) => {
            const from = composition.before[index].share;
            const to = topic.share;

            return (
              <li key={topic.name}>
                {/* No percentage. Plumi publishes no confidence numbers
                    anywhere, and a figure like "62%" is a precision nobody has
                    earned. The bar carries the relative weight, which is the
                    only thing being claimed. */}
                <p className="truncate text-[0.875rem] text-[var(--color-ink-secondary)]">
                  {topic.name}
                </p>

                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--color-fill-strong)]">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${settled ? to : from}%`,
                      backgroundColor:
                        index === 0 ? "var(--color-mastery-weak)" : "var(--color-blue-300)",
                      // The app's "expressive" register, as a curve rather than
                      // a spring: high-damped, felt rather than seen. Nothing
                      // in Plumi bounces, so a curve loses nothing here.
                      transition: animate
                        ? `width 620ms var(--ease-out-soft) ${150 + index * 80}ms`
                        : "none",
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>

        <p className="mt-5 text-[0.8125rem] leading-snug text-[var(--color-ink-tertiary)]">
          {composition.note}
        </p>
      </div>
    </div>
  );
}
