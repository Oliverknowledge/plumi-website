import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TownDev } from "@/components/town/TownDev";
import "@/components/town/town.css";
import "../../library.css";
import "../../entry.css";

export const metadata: Metadata = { title: "Town", robots: { index: false, follow: false } };

/**
 * The town, for building and screenshots (docs/study/town.md). Not part of the product: a production build answers 404, as /study/library/demo does,
 * unless it was built with NEXT_PUBLIC_TOWN_DEV=1 (how the town is measured in a production build: `NEXT_PUBLIC_TOWN_DEV=1 npm run build`; never set in deploys).
 */
export default function Page() {
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_TOWN_DEV !== "1") notFound();
  return <TownDev />;
}
