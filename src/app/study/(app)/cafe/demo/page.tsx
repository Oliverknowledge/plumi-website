import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DemoCafe } from "@/components/studyapp/library/DemoCafe";
import "../../library.css";
import "../../entry.css";

export const metadata: Metadata = { title: "Study", robots: { index: false, follow: false } };

/** The cafe interior with scripted students in it, for building and screenshots. Not part of the product: a production build answers 404. */
export default function Demo() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DemoCafe />;
}
