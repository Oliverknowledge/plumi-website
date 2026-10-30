import { AndroidWaitlist } from "@/components/AndroidWaitlist";
import { AndroidIcon } from "@/components/home/AndroidLink";
import { CosyPage, SectionHead } from "@/components/cosy/Chrome";
import { PageStructuredData } from "@/components/StructuredData";
import { intentFor } from "@/config/routes";
import { metadataFor } from "@/lib/metadata";
import "@/app/pages.css";

export const metadata = metadataFor("/android");

/**
 * Plumi is iPad only today. This is where an Android student leaves an email, so they are told
 * when it comes to them: a title, one line, one field. The list is the iPad waitlist's table with
 * `source = 'android'` (src/lib/waitlist/store.ts), so "how many want Android" is one query.
 */
export default function Page() {
  const intent = intentFor("/android");
  return (
    <CosyPage>
      <PageStructuredData
        path="/android"
        name={intent.title}
        description={intent.description}
        breadcrumb={[{ name: "Android", path: "/android" }]}
      />
      <section className="lp-wrap lp-aw">
        <div className="lp-aw-hero">
          {/* The Android logo on the left of the title, drawn as an Android app icon: the robot on a green squircle. */}
          <div className="lp-aw-appicon" aria-hidden="true">
            <AndroidIcon size={88} />
          </div>
          <SectionHead
            as="h1"
            eyebrow="Android"
            title={intent.h1}
            lead="Plumi is on iPad now. Leave your email and we'll tell you the day it comes to Android."
          />
        </div>
        <AndroidWaitlist />
      </section>
    </CosyPage>
  );
}
