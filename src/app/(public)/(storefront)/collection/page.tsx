import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/site/reveal";
import { SiteFooter } from "@/components/site/site-footer";
import { mailto } from "@/content/site";
import { fetchCollection } from "@/features/shop/catalogue/data";
import { CatalogueBrowser } from "@/features/shop/components/catalogue-browser";

export const metadata: Metadata = {
  title: { absolute: "The Collection — LGNDRY.Co" },
  description:
    "The LGNDRY.Co collection — limited edition fine art prints from Limpopo, South Africa. Created to be collected. Made to last.",
  alternates: { canonical: "/collection" },
};

// Prices, stock and new works are edited in the admin, so the page is rebuilt
// from the database at most once a minute rather than on every request.
export const revalidate = 60;

function Arrow() {
  return (
    <span className="practice-cta__arrow" aria-hidden="true">
      <svg width="40" height="8" viewBox="0 0 40 8" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M0 4H38M38 4L34 1M38 4L34 7" stroke="currentColor" strokeWidth="1" />
      </svg>
    </span>
  );
}

const FEATURES = [
  {
    title: "Limited Editions",
    text: "Each print is part of a strictly limited release.",
    icon: (
      <>
        <rect x="4" y="4" width="16" height="16" stroke="currentColor" strokeWidth="1" />
        <path d="M8 24H24V8" stroke="currentColor" strokeWidth="1" />
      </>
    ),
  },
  {
    title: "Archival Quality",
    text: "Museum-grade materials designed to last a lifetime.",
    icon: (
      <>
        <path d="M7 3H17L22 8V25H7V3Z" stroke="currentColor" strokeWidth="1" />
        <path d="M10 12H19M10 16H19M10 20H15" stroke="currentColor" strokeWidth="1" />
      </>
    ),
  },
  {
    title: "Signed & Numbered",
    text: "Every print is hand-signed and individually numbered.",
    icon: (
      <>
        <path d="M5 21L18 8L21 11L8 24L4 25L5 21Z" stroke="currentColor" strokeWidth="1" />
        <path d="M5 25H24" stroke="currentColor" strokeWidth="1" />
      </>
    ),
  },
  {
    title: "Worldwide Delivery",
    text: "Secure, insured delivery to your door.",
    icon: (
      <>
        <circle cx="14" cy="14" r="10" stroke="currentColor" strokeWidth="1" />
        <path
          d="M4 14H24M14 4C10 9 10 19 14 24C18 19 18 9 14 4Z"
          stroke="currentColor"
          strokeWidth="1"
        />
      </>
    ),
  },
];

export default async function CollectionPage() {
  const products = await fetchCollection();

  return (
    <>
      <main className="collection-page" id="main-content">
        <section className="collection-hero">
          <Reveal className="collection-hero__intro">
            <h1 className="collection-title">The Collection</h1>
            <p className="collection-lede">
              Limited edition fine art prints.
              <br />
              Created to be collected. Made to last.
            </p>
            <a className="practice-cta" href="#collection-features">
              <span className="practice-cta__label">About the collection</span>
              <Arrow />
            </a>
          </Reveal>
          <Reveal as="figure" className="collection-hero__media">
            <Image
              src="/assests/images/art/studio art/STUDIO ART (FB)/DINEO 1.jpeg"
              alt="A ballerina stands en pointe on a stone plinth in a dark studio"
              width={1280}
              height={883}
              loading="eager"
              fetchPriority="high"
            />
          </Reveal>
        </section>

        <CatalogueBrowser products={products ?? []} unavailable={products === null} />

        <Reveal as="section" className="collection-features" id="collection-features">
          {FEATURES.map((feature) => (
            <div className="feature" key={feature.title}>
              <span className="feature__icon" aria-hidden="true">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 28 28"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {feature.icon}
                </svg>
              </span>
              <div>
                <h3 className="feature__title">{feature.title}</h3>
                <p className="feature__text">{feature.text}</p>
              </div>
            </div>
          ))}
        </Reveal>

        <Reveal as="section" className="collection-close">
          <h2 className="collection-close__title">
            Collect art that
            <br />
            speaks to you.
          </h2>
          <div className="collection-close__links">
            <Link
              className="practice-cta"
              href={mailto("Framing%20options%20%E2%80%94%20LGNDRY.Co%20Collection")}
            >
              <span className="practice-cta__label">View framing options</span>
              <Arrow />
            </Link>
            <Link
              className="practice-cta"
              href={mailto("Question%20about%20a%20print%20%E2%80%94%20LGNDRY.Co%20Collection")}
            >
              <span className="practice-cta__label">Questions about a print?</span>
              <Arrow />
            </Link>
          </div>
        </Reveal>
      </main>
      <SiteFooter />
    </>
  );
}
