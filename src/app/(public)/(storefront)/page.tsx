import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { HeroScroll } from "@/components/site/hero-scroll";
import { IntroSlideshow, type Slide } from "@/components/site/intro-slideshow";
import { Loader } from "@/components/site/loader";
import { Reveal } from "@/components/site/reveal";
import {
  ScrollGallery,
  type GalleryCopy,
  type GalleryImage,
} from "@/components/site/scroll-gallery";
import { SiteFooter } from "@/components/site/site-footer";
import { mailto } from "@/content/site";
import { BookingTrigger } from "@/features/lead-capture/components/lead-modals";

export const metadata: Metadata = {
  title: { absolute: "LGNDRY.Co — Visual Storytelling Studio" },
  description:
    "LGNDRY.Co is a visual storytelling studio creating photography, cinematic films, and original visual works.",
  alternates: { canonical: "/" },
};

const IMG = "/assests/images/optimized";

const INTRO_SLIDES: Slide[] = [
  {
    src: `${IMG}/home-intro-1.webp`,
    alt: "Initiates carrying tall sticks against a bright Limpopo sky",
    width: 1200,
    height: 1800,
  },
  { src: `${IMG}/home-intro-2.webp`, alt: "", width: 1433, height: 1800 },
  { src: `${IMG}/home-intro-3.webp`, alt: "", width: 1800, height: 1137 },
  { src: `${IMG}/home-intro-4.webp`, alt: "", width: 1800, height: 1131 },
];

const GALLERY_COPY: GalleryCopy[] = [
  {
    position: "upper",
    title: "Found Beauty in the Mundane.",
    text: "The extraordinary has always existed. We simply choose to notice it.",
  },
  {
    position: "right",
    title: "Every Frame is an Invitation.",
    text: "To slow down. To look closer. To let the quiet details carry the story.",
  },
  {
    position: "lower",
    title: "Ordinary Moments. Timeless Stories.",
    text: "LGNDRY.Co begins with what is already here: light, texture, memory, movement.",
  },
  {
    position: "left",
    title: "Nothing is Too Small to Hold Meaning.",
    text: "A field. A road. A face between seconds. The work is learning how to see.",
  },
  {
    position: "final",
    title: "Before Service, There is Attention.",
    text: "The photography and film follow from that first act of noticing.",
  },
];

const GALLERY_IMAGES: GalleryImage[] = [
  { src: `${IMG}/home-intro-3.webp`, width: 1800, height: 1137 },
  { src: `${IMG}/home-gallery-2.webp`, width: 1800, height: 1070 },
  { src: `${IMG}/home-gallery-3.webp`, width: 1800, height: 1012 },
  { src: `${IMG}/home-intro-4.webp`, width: 1800, height: 1131 },
  { src: `${IMG}/home-gallery-5.webp`, width: 1800, height: 1198 },
];

export default function HomePage() {
  return (
    <>
      <Loader />

      {/* Hero: pinned inside a scroll runway that drives the cinematic exit */}
      <HeroScroll />

      {/* Page flow: slides up over the pinned hero as the scroll sequence completes */}
      <div className="page-flow">
        <main id="main-content">
          {/* Introduction */}
          <section className="section intro-band" id="intro">
            <div className="intro-band__grid container">
              <Reveal className="intro-band__text">
                <p className="eyebrow">Visual Storytelling Studio — Limpopo, South Africa</p>
                <h2 className="intro-band__title">Beauty, hidden inside ordinary moments.</h2>
                <p className="intro-band__lede">
                  LGNDRY.Co documents people, places, textures, stillness and motion — finding
                  meaning in the scenes most people pass by, and shaping them into photography and
                  film that lasts.
                </p>
              </Reveal>
              <IntroSlideshow slides={INTRO_SLIDES} />
            </div>
          </section>

          {/* Booking CTA */}
          <section className="booking-cta" aria-labelledby="booking-cta-title">
            <Reveal className="booking-cta__inner container">
              <figure className="booking-cta__media">
                <Image
                  src={`${IMG}/home-booking.webp`}
                  alt="LGNDRY.Co service photography detail"
                  width={1800}
                  height={1148}
                  loading="lazy"
                />
              </figure>
              <div className="booking-cta__message">
                <h2 id="booking-cta-title">Tell us what you want to remember.</h2>
                <p>
                  Book photography, film, event coverage or campaign work shaped around the place,
                  date and feeling you want the story to hold.
                </p>
              </div>
              <div className="booking-cta__actions">
                <BookingTrigger
                  className="booking-cta__button"
                  href={mailto("Booking%20a%20service%20with%20LGNDRY.Co")}
                >
                  Book a service
                </BookingTrigger>
                <a className="booking-cta__phone" href="tel:+27764862725">
                  076 486 2725
                </a>
              </div>
            </Reveal>
          </section>

          {/* Philosophy gallery */}
          <ScrollGallery
            label="LGNDRY.Co philosophy gallery"
            copies={GALLERY_COPY}
            images={GALLERY_IMAGES}
          />

          {/* Selected collaborations */}
          <section className="section companies">
            <Reveal className="companies__inner container">
              <p className="eyebrow">Selected Collaborations</p>
              <div className="companies__row">
                <Image
                  className="companies__logo"
                  src="/assests/images/client logos/vw.png"
                  alt="Volkswagen"
                  width={447}
                  height={447}
                  loading="lazy"
                />
                <Image
                  className="companies__logo"
                  src="/assests/images/client logos/kitso-logo.png"
                  alt="Kitsotlhale Trading"
                  width={1755}
                  height={557}
                  loading="lazy"
                />
                <Image
                  className="companies__logo"
                  src="/assests/images/client logos/capricorn-fm.b6efb469.jpg"
                  alt="Capricorn FM"
                  width={512}
                  height={512}
                  loading="lazy"
                />
              </div>
            </Reveal>
          </section>

          {/* Closing */}
          <section className="closing">
            <Image
              className="closing__image"
              src={`${IMG}/home-hero.webp`}
              alt="A figure standing in a golden field beneath a hazy Limpopo sky"
              width={2400}
              height={1350}
              loading="lazy"
            />
            <Reveal className="closing__overlay">
              <p className="eyebrow eyebrow--light">LGNDRY.Co</p>
              <h2 className="closing__text">
                Not everything beautiful asks for attention. Some things simply wait to be noticed.
              </h2>
              <Link className="closing__cta" href="/contact">
                Start a project
              </Link>
            </Reveal>
          </section>
        </main>

        <SiteFooter />
      </div>
    </>
  );
}
