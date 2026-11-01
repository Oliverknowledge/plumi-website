"use client";

import { useState } from "react";
import { demoDriver } from "@/lib/studyapp/library/demo";
import { LibraryRoom } from "./Library";

/** The real room and panel on a scripted world (dev only: see library/demo/page.tsx). */
export function DemoLibrary() {
  const [driver] = useState(() => demoDriver());
  return <LibraryRoom driver={driver} onLeave={async () => true} />;
}
