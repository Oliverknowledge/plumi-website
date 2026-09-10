"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { trackOnceWhenVisible, type PlumiEvent } from "@/lib/analytics";

/**
 * Fires one impression event the first time its children are meaningfully on
 * screen, then stops observing.
 *
 * It exists so a static block of markup does not have to become a client
 * component just to be counted. The wrapper is the only client code; everything
 * inside it stays server-rendered.
 */
export function Impression({
  event,
  children,
  className,
}: {
  event: PlumiEvent;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => trackOnceWhenVisible(ref.current, event), [event]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
