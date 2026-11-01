import { redirect } from "next/navigation";

/** The variations live at /study/dashboards/<name>; the index is the first of them. */
export default function DashboardsIndex() {
  redirect("/study/dashboards/desk");
}
