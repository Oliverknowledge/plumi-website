import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { StickyCta } from "@/components/StickyCta";

import { Hero } from "@/components/sections/Hero";
import { ThePage } from "@/components/sections/ThePage";
import { WhatCounts } from "@/components/sections/WhatCounts";
import { UnderAClock } from "@/components/sections/UnderAClock";
import { WhatNow } from "@/components/sections/WhatNow";
import { YourCourse } from "@/components/sections/YourCourse";
import { FreeAndPro } from "@/components/sections/FreeAndPro";
import { TheHabit } from "@/components/sections/TheHabit";
import { Faq } from "@/components/sections/Faq";
import { Waitlist } from "@/components/sections/Waitlist";

/**
 * The story, in order. Every section shows something the one before it could
 * not, and the order is an argument rather than a list of features:
 *
 *   1  Hero          — it is a notebook, it is on an iPad, and it knows something
 *   2  The page      — the anti-chatbot claim, made with your own finger
 *   3  What counts   — the rule that makes "it knows" believable
 *   4  Under a clock — the trust beat: it switches itself off
 *   5  What now      — the loop pays off, and you can overrule it
 *   6  Your course   — it is YOUR specification, with your board named
 *   7  Free & Pro    — what costs money, and how it compares
 *   8  Day to day    — there is a personality, in one band, not a chapter
 *   9  FAQ           — the real objections
 *  10  Waitlist      — the ask, having earned it
 *
 * Free & Pro sits at seven deliberately. A pricing-shaped section on a product
 * nobody can use yet reads as presumptuous until the product is believed.
 */
export default function Page() {
  return (
    <>
      <SiteHeader />

      <main id="main">
        <Hero />
        <ThePage />
        <WhatCounts />
        <UnderAClock />
        <WhatNow />
        <YourCourse />
        <FreeAndPro />
        <TheHabit />
        <Faq />
        <Waitlist />
      </main>

      <SiteFooter />
      <StickyCta />
    </>
  );
}
