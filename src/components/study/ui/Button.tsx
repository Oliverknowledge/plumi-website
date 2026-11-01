import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { PixelIcon, type PixelIconName } from "./PixelIcon";

/**
 * The key. One `primary` per screen: it is the thing the screen wants the student to do next.
 *
 *   primary   the main action (blue)            "Start session", "Pick it up"
 *   go        continue or resume (green)         green means on, never "correct"
 *   friendly  a kind secondary (mint)            "Join the room", "Find your level"
 *   default   everything else (card)
 *   flat      inside a card, quieter (no shadow)
 *   ghost     a dashed ghost of a card           "Add a subject"
 */
export type ButtonVariant = "default" | "primary" | "go" | "friendly" | "flat" | "ghost";

type Shared = {
  variant?: ButtonVariant;
  small?: boolean;
  block?: boolean;
  /** A pixel icon before the label. */
  icon?: PixelIconName;
  children?: ReactNode;
  className?: string;
};

function classes({ variant = "default", small, block, className, iconOnly }: Shared & { iconOnly?: boolean }) {
  return [
    "st-btn",
    variant !== "default" && `st-btn--${variant}`,
    small && "st-btn--small",
    block && "st-btn--block",
    iconOnly && "st-btn--icon",
    className,
  ].filter(Boolean).join(" ");
}

export function Button({
  variant, small, block, icon, className, children, type = "button", ...rest
}: Shared & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={classes({ variant, small, block, className, iconOnly: !children })} {...rest}>
      {icon && <PixelIcon name={icon} size={16} />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant, small, block, icon, className, children, href, ...rest
}: Shared & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string }) {
  return (
    <Link href={href} className={classes({ variant, small, block, className })} {...rest}>
      {icon && <PixelIcon name={icon} size={16} />}
      {children}
    </Link>
  );
}
