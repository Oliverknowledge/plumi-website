"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { activeCta, launchMode, primaryCtaHref } from "@/config/site";
import { track, type PlumiEvent } from "@/lib/analytics";

/**
 * The button. Every call to action on the site is this component, so flipping
 * `launchMode` in src/config/site.ts changes the label, the destination and the
 * analytics event everywhere at once.
 *
 * Shape and press behaviour are the app's: a filled capsule, 44pt tall, that
 * scales to 0.97 and dims to 0.86 under a finger. Nothing in Plumi bounces.
 */

type Variant = "primary" | "secondary" | "ghost";
type Size = "default" | "large" | "compact";

interface CtaButtonProps {
  /** Where this button sits, sent as a property so we can tell hero from footer. */
  placement: string;
  variant?: Variant;
  size?: Size;
  /** Overrides the label from `activeCta`. Use sparingly — the launch switch
   *  should normally decide what buttons say. */
  label?: string;
  className?: string;
  children?: ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium " +
  "transition-[transform,opacity,background-color,box-shadow] duration-150 ease-[var(--ease-out-soft)] " +
  "active:scale-[0.97] motion-reduce:active:scale-100 " +
  "focus-visible:outline-2 focus-visible:outline-offset-3";

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--color-blue-600)] text-white shadow-[var(--shadow-resting)] " +
    "hover:bg-[var(--color-blue-700)] active:opacity-[0.86]",
  secondary:
    "border border-[var(--color-hairline-strong)] bg-[var(--color-elevated)] text-[var(--color-ink)] " +
    "hover:border-[var(--color-ink-tertiary)] active:opacity-70",
  ghost: "text-[var(--color-ink-secondary)] hover:text-[var(--color-ink)] active:opacity-70",
};

const sizes: Record<Size, string> = {
  compact: "h-10 px-4 text-[0.9375rem]",
  default: "h-11 px-5 text-base",
  large: "h-14 px-7 text-lg",
};

export function CtaButton({
  placement,
  variant = "primary",
  size = "default",
  label,
  className = "",
  children,
}: CtaButtonProps) {
  const text = children ?? label ?? activeCta.primary;
  const href = primaryCtaHref();

  function handleClick() {
    const event: PlumiEvent = launchMode === "appStore" ? "app_store_clicked" : "hero_waitlist_clicked";
    track(event, { placement });
  }

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      // An external App Store link should open where the student expects; an
      // in-page anchor must not.
      {...(launchMode === "appStore" ? { target: "_blank", rel: "noopener" } : {})}
    >
      {text}
    </Link>
  );
}

/**
 * The secondary action. Scrolls to the first proof section rather than making a
 * second promise — "see how it works" should show, not tell.
 */
export function SecondaryCta({
  label,
  href = "#the-page",
  placement,
}: {
  label: string;
  href?: string;
  placement: string;
}) {
  return (
    <Link
      href={href}
      onClick={() => track("product_demo_interacted", { placement, action: "secondary_cta" })}
      className={`${base} ${variants.ghost} ${sizes.default} -mx-1`}
    >
      {label}
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
        className="translate-y-px"
      >
        <path
          d="M8 3.5v9M4.5 9l3.5 3.5L11.5 9"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}
