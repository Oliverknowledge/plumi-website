"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { activeCta, primaryCtaHref } from "@/config/site";
export function CtaButton({ placement, variant = "primary", size = "default", label, className = "", children }: { placement: string; variant?: "primary" | "secondary" | "ghost"; size?: "default" | "large" | "compact"; label?: string; className?: string; children?: ReactNode }) {
  return <a href={primaryCtaHref()} target="_blank" rel="noopener noreferrer" data-testid={`${placement}-join-discord-button`} className={`story-button ${variant} ${size} ${className}`}>
    {children ?? label ?? activeCta.primary}<svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
  </a>;
}
export function SecondaryCta({ label, href = "/#how-it-works", placement }: { label: string; href?: string; placement: string }) {
  return <Link href={href} className="story-text-link" data-testid={`${placement}-secondary-link`}>{label}<span aria-hidden="true">↗</span></Link>;
}
