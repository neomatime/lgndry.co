import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/site/reveal";
import { SiteFooter } from "@/components/site/site-footer";
import { CONTACT_EMAIL, mailto } from "@/content/site";
import { ContactForm } from "@/features/lead-capture/components/contact-form";
import { BookingTrigger, PartnershipTrigger } from "@/features/lead-capture/components/lead-modals";

export const metadata: Metadata = {
  title: { absolute: "Contact - LGNDRY.Co" },
  description:
    "Contact LGNDRY.Co to book a photography session, start a creative project, or enquire about a brand partnership.",
  alternates: { canonical: "/contact" },
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

/** One row in the "Start a Conversation" card. */
function Method({
  href,
  external,
  label,
  icon,
  children,
}: {
  href: string;
  external?: boolean;
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <a
      className="contact-method"
      href={href}
      {...(external ? { target: "_blank", rel: "noopener" } : {})}
    >
      <span className="contact-method__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="contact-method__body">
        <span>{label}</span>
        <strong>{children}</strong>
      </span>
      <span className="contact-method__arrow" aria-hidden="true">
        &rarr;
      </span>
    </a>
  );
}

export default function ContactPage() {
  return (
    <>
      <main className="contact-page" id="main-content">
        <section className="contact-hero" aria-labelledby="contact-title">
          <Reveal className="contact-hero__copy">
            <h1 id="contact-title" className="contact-title">
              Let&apos;s create
              <br />
              something
              <br />
              worth
              <br />
              remembering.
            </h1>
            <span className="contact-rule" aria-hidden="true"></span>
            <p>
              Whether you are planning a project, exploring a partnership, or simply want to say
              hello - we would love to hear from you.
            </p>
          </Reveal>
          <Reveal as="figure" className="contact-hero__media">
            <Image
              src="/assests/images/art/studio art/STUDIO ART (FB)/DINEO 1.jpeg"
              alt="Dineo posed en pointe in a dramatic fine art studio portrait"
              width={1280}
              height={883}
              priority
            />
          </Reveal>
        </section>

        <section className="contact-grid" aria-label="Contact options and message form">
          <Reveal
            as="aside"
            className="contact-card contact-card--dark"
            aria-labelledby="conversation-title"
          >
            <h2 id="conversation-title">Start a Conversation</h2>
            <span className="contact-rule contact-rule--light" aria-hidden="true"></span>

            <Method
              href={`mailto:${CONTACT_EMAIL}`}
              label="Email"
              icon={
                <svg
                  width="30"
                  height="30"
                  viewBox="0 0 30 30"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M5 8.5H25V22H5V8.5Z" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M5 9L15 16.5L25 9" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              }
            >
              {CONTACT_EMAIL}
            </Method>

            <Method
              href="https://wa.me/27713420404"
              external
              label="WhatsApp"
              icon={
                <svg
                  width="30"
                  height="30"
                  viewBox="0 0 30 30"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M15 25.5C20.799 25.5 25.5 20.799 25.5 15C25.5 9.201 20.799 4.5 15 4.5C9.201 4.5 4.5 9.201 4.5 15C4.5 16.86 4.985 18.607 5.836 20.124L4.5 25.5L10.05 24.2C11.53 25.03 13.21 25.5 15 25.5Z"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M11 12.8C11 12.2 11.5 11.2 12.6 11.2C13.1 11.2 13.5 11.4 13.7 11.9C14 12.6 14.4 13.6 14.5 13.8C14.7 14.1 14.5 14.5 14.3 14.7C14 15 13.8 15.2 14 15.6C14.5 16.6 15.9 18 17.4 18.4C17.8 18.5 18 18.3 18.3 18C18.5 17.8 18.9 17.6 19.2 17.8C19.5 17.9 20.4 18.4 20.8 18.6C21.2 18.8 21.4 18.9 21.4 19.3C21.4 19.7 21.1 20.6 20.4 21C19.7 21.4 18.9 21.6 17.9 21.3C16.4 20.9 13.9 19.7 12.1 17.4C10.7 15.6 11 13.4 11 12.8Z"
                    stroke="currentColor"
                    strokeWidth="1.1"
                    strokeLinejoin="round"
                  />
                </svg>
              }
            >
              071 342 0404
            </Method>

            <Method
              href="https://www.google.com/maps/search/?api=1&query=Limpopo%2C%20South%20Africa"
              external
              label="Studio"
              icon={
                <svg
                  width="30"
                  height="30"
                  viewBox="0 0 30 30"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M15 25C15 25 23 18.2 23 11.8C23 7.4 19.4 4.5 15 4.5C10.6 4.5 7 7.4 7 11.8C7 18.2 15 25 15 25Z"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                  <path
                    d="M15 14.6C16.7 14.6 18 13.3 18 11.6C18 9.9 16.7 8.6 15 8.6C13.3 8.6 12 9.9 12 11.6C12 13.3 13.3 14.6 15 14.6Z"
                    stroke="currentColor"
                    strokeWidth="1.2"
                  />
                </svg>
              }
            >
              Gauteng, South Africa
              <br />
              By Appointment Only
            </Method>
          </Reveal>

          <Reveal
            as="section"
            className="contact-card contact-card--form"
            aria-labelledby="message-title"
          >
            <h2 id="message-title">Send a Message</h2>
            <span className="contact-rule" aria-hidden="true"></span>
            <ContactForm />
          </Reveal>
        </section>

        <Reveal as="section" className="contact-paths" aria-labelledby="paths-title">
          <div className="contact-paths__intro">
            <p className="contact-eyebrow">Choose your path</p>
            <span className="contact-rule" aria-hidden="true"></span>
            <h2 id="paths-title">
              Two ways to work
              <br />
              together.
            </h2>
            <p>Every project is unique. Choose the path that best fits what you need.</p>
            <Link className="contact-link" href="/services">
              <span>Compare our approach</span>
              <Arrow />
            </Link>
          </div>
          <article className="contact-path">
            <span className="contact-path__number">01</span>
            <h3>Book a Session</h3>
            <span className="contact-rule" aria-hidden="true"></span>
            <p>For one-off projects, campaigns, or specific photography needs.</p>
            <BookingTrigger
              className="contact-link"
              href={mailto("Booking%20a%20session%20with%20LGNDRY.Co")}
            >
              <span>Book a session</span>
              <Arrow />
            </BookingTrigger>
          </article>
          <article className="contact-path">
            <span className="contact-path__number">02</span>
            <h3>Apply for a Partnership</h3>
            <span className="contact-rule" aria-hidden="true"></span>
            <p>
              For brands seeking ongoing creative collaboration and consistent visual storytelling.
            </p>
            <PartnershipTrigger
              className="contact-link"
              href={mailto("Brand%20partnership%20with%20LGNDRY.Co")}
            >
              <span>Apply for a partnership</span>
              <Arrow />
            </PartnershipTrigger>
          </article>
        </Reveal>

        <section className="contact-studio" aria-labelledby="studio-title">
          <Reveal className="contact-studio__note">
            <p id="studio-title" className="contact-eyebrow">
              The Studio
            </p>
            <span className="contact-rule" aria-hidden="true"></span>
            <p>
              We work with a select number of clients to ensure every project receives the attention
              it deserves.
            </p>
            <p>Thank you for understanding.</p>
            <p className="contact-signature" aria-label="Signed by Dan Mokgwadi">
              Dan Mokgwadi
            </p>
            <p className="contact-role">Founder &amp; Creative Director</p>
          </Reveal>
          <Reveal as="figure" className="contact-studio__media">
            <Image
              src="/assests/images/optimized/home-hero.webp"
              alt="A wide Limpopo landscape photographed by LGNDRY.Co"
              width={2400}
              height={1350}
              loading="lazy"
            />
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
