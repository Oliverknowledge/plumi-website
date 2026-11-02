import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TownDev } from "@/components/town/TownDev";

export const metadata: Metadata = { title: "Town", robots: { index: false, follow: false } };

/** The town, for building and screenshots (docs/study/town.md). Not part of the product: a production build answers 404, as /study/library/demo does. */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <TownDev />;
}
