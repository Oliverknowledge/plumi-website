"use client";

import Image from "next/image";
import { useEffect } from "react";
import { qa } from "@/lib/studyapp/questions/store";

/**
 * If the Questions tab ever throws while drawing (a file from the bank that is not what it should be, a set it cannot read),
 * the student gets this and a way back, never the framework's page. "Try again" puts the picker back on a fresh subject
 * choice and closes any open set (it stays in Your sets, with its answers); nothing is deleted.
 */
export default function QuestionsError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="qs-page" id="qs-main">
      <div className="wrap">
        <div className="qs-col">
          <div className="qs-fail" role="alert">
            <Image src="/study/mascot/plumi-curious.svg" alt="" width={64} height={64} unoptimized />
            <b>Questions did not open</b>
            <span>Your sets and answers are safe on this device.</span>
            <div className="qs-fail-acts">
              <button type="button" className="btn gold" onClick={() => { qa.pick(null, []); qa.open(null); retry(); }}>Try again</button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
