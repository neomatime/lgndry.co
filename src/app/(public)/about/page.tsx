import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/site/reveal";
import { SiteFooter } from "@/components/site/site-footer";
import { mailto } from "@/content/site";
import { BookingTrigger, PartnershipTrigger } from "@/features/lead-capture/components/lead-modals";

export const metadata: Metadata = {
  title: { absolute: "About - LGNDRY.Co" },
  description:
    "About LGNDRY.Co, a visual storytelling studio finding beauty in ordinary moments through photography, film, and visual communication.",
  alternates: { canonical: "/about" },
};

function Arrow() {
  return (
    <svg
      width="40"
      height="8"
      viewBox="0 0 40 8"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M0 4H38M38 4L34 1M38 4L34 7" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

// Logos scroll in a loop; the second set repeats the first and is hidden from
// assistive tech so each client is announced once.
const LOGOS = [
  { src: "/assests/images/client logos/vw.png", alt: "Volkswagen", width: 447, height: 447 },
  {
    src: "/assests/images/client logos/capricorn-fm.b6efb469.jpg",
    alt: "Capricorn FM",
    width: 512,
    height: 512,
  },
  { src: "/assests/images/client logos/kitso-logo.png", alt: "Kitso", width: 1755, height: 557 },
] as const;

export default function AboutPage() {
  return (
    <>
      <main className="about-page">
        <section className="about-hero" aria-labelledby="about-title">
          <Reveal className="about-hero__copy">
            <p className="about-eyebrow">About LGNDRY.Co</p>
            {/* The live site replaced this headline with unbroken text from the
                CMS, so it wraps naturally rather than at fixed line breaks. */}
            <h1 id="about-title" className="about-title">
              There is beauty in everything. Even the ordinary.
            </h1>
            <p className="about-copy">
              LGNDRY.Co is a visual storytelling studio creating photography, cinematic film and
              original visual works. We work with brands, organisations and individuals to
              communicate identity through visual narratives, while creating original artistic
              projects rooted in observation, presence and the beauty found in everyday life.
            </p>
            <a className="about-link" href="#philosophy">
              <span>Our philosophy</span>
              <Arrow />
            </a>
          </Reveal>
          <Reveal as="figure" className="about-hero__media">
            <Image
              src="/assests/images/optimized/about-hero.webp"
              alt="A quiet fine art photograph with dramatic studio light"
              width={2200}
              height={1468}
              priority
            />
          </Reveal>
        </section>

        <section className="about-founder" aria-labelledby="founder-title">
          <Reveal as="figure" className="about-founder__portrait">
            <Image
              src="/assests/images/founder-2.jpeg"
              alt="Portrait of the LGNDRY.Co founder"
              width={4096}
              height={2727}
              loading="lazy"
            />
          </Reveal>
          <Reveal className="about-founder__copy">
            <p className="about-eyebrow">Founder</p>
            <h2 id="founder-title" className="about-section-title">
              Intentional by nature.
              <br />
              Obsessed with craft.
            </h2>
            <span className="about-rule" aria-hidden="true"></span>
            <p>
              I am drawn to what others overlook - the quiet, the overlooked, the in-between moments
              that tell the real story.
            </p>
            <p>
              Photography, for me, is more than capturing what is seen. It is about revealing what
              is felt.
            </p>
            <p className="about-signature" aria-label="Signed by Dan Mokgwadi">
              Dan Mokgwadi
            </p>
            <p className="about-founder__role">Founder &amp; Creative Director</p>
          </Reveal>
        </section>

        <section className="about-principles" id="philosophy" aria-label="LGNDRY.Co philosophy">
          <div className="about-principles__grid">
            <Reveal as="article" className="about-card">
              <span className="about-card__number">01</span>
              <h2>Our Values</h2>
              <span className="about-rule" aria-hidden="true"></span>
              <ul>
                <li>Intentionality</li>
                <li>Authenticity</li>
                <li>Excellence</li>
                <li>Timelessness</li>
                <li>Respect</li>
              </ul>
              <a className="about-link" href="#manifesto">
                <span>What drives us</span>
                <Arrow />
              </a>
            </Reveal>

            <Reveal as="article" className="about-card">
              <span className="about-card__number">02</span>
              <h2>Our Style</h2>
              <span className="about-rule" aria-hidden="true"></span>
              <p>Cinematic. Minimal. Honest.</p>
              <p>
                We let light, composition, and story lead. Nothing is forced. Nothing is left to
                chance.
              </p>
              <Link className="about-link" href="/collection">
                <span>View the work</span>
                <Arrow />
              </Link>
            </Reveal>

            <Reveal as="article" className="about-card">
              <span className="about-card__number">03</span>
              <h2>Our Process</h2>
              <span className="about-rule" aria-hidden="true"></span>
              <p>We listen. We observe. We understand.</p>
              <p>
                Then we create with clarity and purpose - from concept to final delivery and beyond.
              </p>
              <Link className="about-link" href="/services">
                <span>How we work</span>
                <Arrow />
              </Link>
            </Reveal>

            <Reveal as="figure" className="about-principles__image">
              <Image
                src="/assests/images/art/outdoor/InShot_20260211_201611759.jpg"
                alt="A quiet outdoor scene photographed by LGNDRY.Co"
                width={2731}
                height={4096}
                loading="lazy"
              />
            </Reveal>
          </div>
        </section>

        <Reveal as="section" className="about-collabs" aria-labelledby="collabs-title">
          <p id="collabs-title" className="about-eyebrow">
            Selected Collaborations
          </p>
          <div className="about-collabs__logos" aria-label="Selected client logos">
            <div className="about-collabs__track">
              {LOGOS.map((logo) => (
                <Image
                  key={logo.src}
                  src={logo.src}
                  alt={logo.alt}
                  width={logo.width}
                  height={logo.height}
                  loading="lazy"
                />
              ))}
              {LOGOS.map((logo) => (
                <Image
                  key={`${logo.src}-repeat`}
                  src={logo.src}
                  alt=""
                  aria-hidden="true"
                  width={logo.width}
                  height={logo.height}
                  loading="lazy"
                />
              ))}
            </div>
          </div>
        </Reveal>

        <section className="about-manifesto" id="manifesto" aria-labelledby="manifesto-title">
          <Reveal className="about-manifesto__copy">
            <p className="about-eyebrow">Our Manifesto</p>
            <h2 id="manifesto-title" className="about-section-title">
              We believe in slowing down
              <br />
              to see what truly matters.
            </h2>
            <span className="about-rule" aria-hidden="true"></span>
            <p>
              In a world that moves too fast, we choose to look closer. To notice the details. To
              honor the quiet. To create work that outlives trends and speaks across time.
            </p>
            <Link className="about-link" href="/collection">
              <span>View the collection</span>
              <Arrow />
            </Link>
          </Reveal>
          <Reveal as="figure" className="about-manifesto__media">
            <Image
              src="/assests/images/optimized/home-hero.webp"
              alt="A solitary figure moving through a wide Limpopo landscape"
              width={2400}
              height={1350}
              loading="lazy"
            />
          </Reveal>
        </section>

        <section className="about-final" aria-label="Start a project">
          <h2>
            Let us create
            <br />
            something meaningful.
          </h2>
          <div className="about-final__links">
            <BookingTrigger
              className="about-link"
              href={mailto("Booking%20a%20session%20with%20LGNDRY.Co")}
            >
              <span>Book a session</span>
              <Arrow />
            </BookingTrigger>
            <PartnershipTrigger
              className="about-link"
              href={mailto("Brand%20partnership%20with%20LGNDRY.Co")}
            >
              <span>Apply for a brand partnership</span>
              <Arrow />
            </PartnershipTrigger>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
