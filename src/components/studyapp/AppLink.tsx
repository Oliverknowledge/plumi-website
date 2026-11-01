"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useAppHref } from "@/lib/studyapp/host";

/** A link to one of the app's own pages, written as the canonical `/study/...` and shown as the host's own address (lib/studyapp/host). */
export function AppLink({ href, ...rest }: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const to = useAppHref();
  return <Link href={to(href)} {...rest} />;
}
