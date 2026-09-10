import { CtaButton, SecondaryCta } from "@/components/ui/CtaButton";
import { IPad } from "@/components/product/IPad";
import { HeroScene } from "@/components/scenes/HeroScene";
import { activeCta } from "@/config/site";
import { heroFor, type HeroCopy } from "@/content/copy";

/**
 * Five seconds to establish three things: it is a notebook, it is on an iPad,
 * and it knows something. Everything else on the page is downstream of that.
 *
 * The layout is deliberately not a centred stack over a screenshot. The
 * headline holds the left column and the iPad runs off the right edge of the
 * viewport, because a device with its edge cropped reads as a real object
 * sitting on a desk, and a device floating centred with air all round it reads
 * as a stock mockup.
 */

export function Hero({ variant }: { variant?: string }) {
  const copy: HeroCopy = heroFor(variant);

  return (
    <section className="relative overflow-hidden pt-[calc(var(--header-height)+2rem)] pb-16 sm:pb-24 lg:pt-[calc(var(--header-height)+4.5rem)] lg:pb-32">
      <div className="container-plumi">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,33rem)_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[minmax(0,37rem)_minmax(0,1fr)]">
          <div className="relative z-10 max-w-[34rem] lg:max-w-none">
            <h1 className="text-display font-medium text-balance">
              <span className="block">{copy.headlineLines[0]}</span>
              {/* The second line carries the idea. It is set in the ink colour
                  rather than a brand colour: the sentence is about the student,
                  not about us. */}
              <span className="block text-[var(--color-ink-secondary)]">{copy.headlineLines[1]}</span>
            </h1>

            <p className="mt-6 measure text-lead text-[var(--color-ink-secondary)] text-pretty">
              {copy.subhead}
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-x-2 gap-y-3">
              <CtaButton placement="hero" size="large" />
              <SecondaryCta label={copy.secondaryCta} placement="hero" />
            </div>

            <p className="mt-6 text-sm text-[var(--color-ink-tertiary)]">{copy.supporting}</p>
          </div>

          {/*
            The device.

            On a laptop it is pushed right and slightly oversized so it bleeds
            past the container — a device with its edge cropped reads as a real
            object on a desk, where one floating centred with air all round it
            reads as a stock mockup.

            On a phone the whole iPad is not shown at all. A 1194pt screen
            scaled into 350pt of viewport renders the handwriting at about
            eleven points, and the entire argument of this hero is that you can
            read what the student wrote and what Plumi wrote back. So the
            device is scaled up and cropped to the working: the bezel runs off
            both edges, which is what an iPad looks like when you lean over it.

            One DOM either way. Rendering a second, smaller scene for phones
            would mean shipping sixty kilobytes of duplicate path data to the
            device least able to afford it.
          */}
          <div className="relative lg:-mr-[12vw] xl:-mr-[8vw]">
            <div className="overflow-hidden [aspect-ratio:4/3] sm:aspect-auto sm:overflow-visible">
              <div className="w-[158%] max-w-none -translate-x-[12.2%] -translate-y-[7.4%] sm:w-full sm:translate-x-0 sm:translate-y-0">
                <IPad className="w-full lg:w-[118%] xl:w-[112%]">
                  <HeroScene />
                </IPad>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/*
        The scene above is `aria-hidden` — it is a drawing, and describing a
        drawing stroke by stroke helps nobody. This is what it means, in prose,
        for a screen reader and for anyone the animation never reaches.
      */}
      <p className="sr-only">
        A page of A-Level maths working on an iPad. The student integrates x·eˣ by parts and makes a
        sign error on the final line. They circle that line with the Apple Pencil; Plumi underlines it
        and writes “check the sign” in the margin in its own handwriting. A card then appears showing
        that the topic “Integration by parts” now reads “Needs work”, on three pieces of evidence.
      </p>

      <p className="sr-only">{activeCta.supporting}</p>
    </section>
  );
}
