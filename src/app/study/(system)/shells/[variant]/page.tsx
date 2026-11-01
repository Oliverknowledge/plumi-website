import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShellBar, shells, shellViews, type ShellId } from "@/components/study/shells";

export function generateStaticParams(): Array<{ variant: string }> {
  return shells.map((s) => ({ variant: s.id }));
}

/** Anything that is not a known shell is a 404. */
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ variant: string }> }): Promise<Metadata> {
  const { variant } = await params;
  const s = shells.find((x) => x.id === variant);
  return { title: s ? `Dashboard shell: ${s.title}` : "Dashboard shell" };
}

export default async function ShellPage({ params }: { params: Promise<{ variant: string }> }) {
  const { variant } = await params;
  if (!shells.some((s) => s.id === variant)) notFound();
  return (
    <>
      <ShellBar id={variant as ShellId} />
      {shellViews[variant as ShellId]()}
    </>
  );
}
