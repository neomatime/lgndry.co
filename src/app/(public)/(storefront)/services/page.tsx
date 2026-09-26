import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/site/reveal";
import { SiteFooter } from "@/components/site/site-footer";
import {
  BRAND_PARTNERSHIPS,
  PHOTOGRAPHY,
  VISUAL_COMMUNICATION,
  type ServiceArea,
} from "@/content/practice";
import { mailto } from "@/content/site";
import { BookingTrigger, PartnershipTrigger } from "@/features/lead-capture/components/lead-modals";

export const metadata: Metadata = {
  title: { absolute: "Practice — LGNDRY.Co" },
  description:
    "The LGNDRY.Co practice — photography, visual communication, and brand partnerships. We capture moments that matter and turn them into timeless visual stories.",
  alternates: { canonical: "/services" },
};

/** The label-plus-arrow inside every call-to-action link on this page. */
function CtaContent({ label }: { label: string }) {
  return (
    <>
      <span className="practice-cta__label">{label}</span>
      <span className="practice-cta__arrow" aria-hidden="true">
        <svg
          width="40"
          height="8"
          viewBox="0 0 40 8"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M0 4H38M38 4L34 1M38 4L34 7" stroke="currentColor" strokeWidth="1" />
        </svg>
      </span>
    </>
  );
}

/** The inside of a service card: number, name, description, offerings, call to action. */
function ServiceContent({ area, cta }: { area: ServiceArea; cta: React.ReactNode }) {
  return (
    <>
      <span className="practice-service__num">{area.number}</span>
      <h2 className="practice-service__name">{area.name}</h2>
      <p className="practice-service__tag">{area.tag}</p>
      <p className="practice-service__desc">{area.description}</p>
      <ul className="practice-service__list">
        {area.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {cta}
    </>
  );
}

export default function ServicesPage() {
  return (
    <>
      <main className="practice-page" id="main-content">
        <section className="practice-hero">
          <Reveal className="practice-hero__intro">
            <p className="practice-eyebrow">Practice</p>
            <h1 className="practice-title">What We Do</h1>
            <p className="practice-lede">
              We capture moments that matter and turn them into timeless visual stories.
            </p>
            <Link className="practice-cta" href="/collection">
              <CtaContent label="View our work" />
            </Link>
          </Reveal>

          <Reveal as="figure" className="practice-hero__media">
            <Image
              src="/assests/images/optimized/services-hero.webp"
              alt="An editorial studio portrait in a floor-length black dress"
              width={1800}
              height={1800}
              priority
            />
          </Reveal>

          <Reveal as="article" className="practice-service practice-hero__service">
            <ServiceContent
              area={PHOTOGRAPHY}
              cta={
                <BookingTrigger
                  className="practice-cta"
                  href={mailto("Photography%20enquiry%20%E2%80%94%20LGNDRY.Co")}
                >
                  <CtaContent label="Book a session" />
                </BookingTrigger>
              }
            />
          </Reveal>
        </section>

        <Reveal as="section" className="practice-row practice-row--media-left">
          <figure className="practice-row__media">
            <Image
              src="/assests/images/commercial/comrades marathon/visual-communication-runner.jpg"
              alt="A runner preparing on an open road beneath a clear blue sky"
              width={1600}
              height={1041}
              loading="lazy"
            />
          </figure>
          <article className="practice-service">
            <ServiceContent
              area={VISUAL_COMMUNICATION}
              cta={
                <a
                  className="practice-cta"
                  href={mailto("Visual%20communication%20enquiry%20%E2%80%94%20LGNDRY.Co")}
                >
                  <CtaContent label="Enquire now" />
                </a>
              }
            />
          </article>
        </Reveal>

        <Reveal as="section" className="practice-row practice-row--media-right">
          <article className="practice-service">
            <ServiceContent
              area={BRAND_PARTNERSHIPS}
              cta={
                <PartnershipTrigger
                  className="practice-cta"
                  href={mailto("Brand%20partnership%20enquiry%20%E2%80%94%20LGNDRY.Co")}
                >
                  <CtaContent label="Apply to partner" />
                </PartnershipTrigger>
              }
            />
          </article>
          <figure className="practice-row__media">
            <Image
              src="/assests/images/commercial/vw/InShot_20260216_131702605.jpg"
              alt="Close detail of a red Volkswagen GTI"
              width={4096}
              height={2731}
              loading="lazy"
            />
          </figure>
        </Reveal>
      </main>

      <SiteFooter />
    </>
  );
}
