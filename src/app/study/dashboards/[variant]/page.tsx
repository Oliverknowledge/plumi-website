import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dashboards, variants, type VariantId } from "@/components/study/dashboards";

export function generateStaticParams(): Array<{ variant: string }> {
  return variants.map((v) => ({ variant: v.id }));
}

/** Anything that is not a known variation is a 404. */
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ variant: string }> }): Promise<Metadata> {
  const { variant } = await params;
  const v = variants.find((x) => x.id === variant);
  return { title: v ? `Dashboard: ${v.title}` : "Dashboard" };
}

export default async function DashboardVariant({ params }: { params: Promise<{ variant: string }> }) {
  const { variant } = await params;
  if (!variants.some((v) => v.id === variant)) notFound();
  return <>{dashboards[variant as VariantId]()}</>;
}
