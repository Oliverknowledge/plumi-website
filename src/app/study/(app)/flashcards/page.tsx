import type { Metadata } from "next";
import { FlashcardsPage } from "@/components/studyapp/flashcards/FlashcardsPage";
import "../flashcards.css";

export const metadata: Metadata = { title: "Flashcards" };

export default function Flashcards() {
  return <FlashcardsPage />;
}
