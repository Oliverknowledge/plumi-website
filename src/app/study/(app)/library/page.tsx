import type { Metadata } from "next";
import { LibraryPage } from "@/components/studyapp/library/LibraryPage";
import "../library.css";

export const metadata: Metadata = { title: "Study" };

/** Study is the Grand Library: the room with real students in it, on the same server as the iPad's. See docs/study/library.md. */
export default function StudyPage() {
  return <LibraryPage />;
}
