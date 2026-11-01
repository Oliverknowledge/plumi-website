import type { Metadata } from "next";
import { Desk } from "@/components/studyapp/desk/Desk";

export const metadata: Metadata = { title: "Desk" };

export default function DeskPage() {
  return <Desk />;
}
