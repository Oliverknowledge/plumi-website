import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DemoLibrary } from "@/components/studyapp/library/DemoLibrary";
import "../../library.css";
import "../../entry.css";

export const metadata: Metadata = { title: "Study", robots: { index: false, follow: false } };

/** A scripted library, for building and screenshots. Not part of the product: a production build answers 404. */
export default function Demo() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DemoLibrary />;
}
