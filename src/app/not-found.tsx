import Image from "next/image";
import Link from "next/link";
import { CosyPage } from "@/components/cosy/Chrome";
import "@/app/pages.css";

/** A missing page, on the same notebook paper as every other page. */
export default function NotFound() {
  return (
    <CosyPage>
      <section className="lp-final lp-missing" aria-labelledby="missing-title">
        <div className="lp-wrap">
          <div className="lp-card">
            <Image src="/landing/plumi-mood-thinking.svg" alt="" width={140} height={140} unoptimized />
            <h1 id="missing-title">This page isn’t in the notebook.</h1>
            <p className="lp-lead">The link may be old, or mistyped.</p>
            <Link href="/" className="lp-btn">Back to the homepage</Link>
          </div>
        </div>
      </section>
    </CosyPage>
  );
}
