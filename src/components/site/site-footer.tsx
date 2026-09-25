import Image from "next/image";
import Link from "next/link";

const EXPLORE = [
  { label: "Home", href: "/" },
  { label: "Practice", href: "/services" },
  { label: "Collections", href: "/collection" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="footer__top container">
        <div className="footer__brand">
          <Image
            className="footer__logo"
            src="/assests/logos/LGNDRY.CO Final white.png"
            alt="LGNDRY.Co"
            width={6400}
            height={6400}
            loading="lazy"
          />
          <p className="footer__tagline">
            Visual storytelling studio.
            <br />
            Limpopo, South Africa.
          </p>
        </div>

        <nav className="footer__nav" aria-label="Footer">
          <p className="footer__heading">Explore</p>
          {EXPLORE.map(({ label, href }) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </nav>

        <div className="footer__col">
          <p className="footer__heading">Contact</p>
          <a href="mailto:neomokgwadi@lgndry-co.co.za">neomokgwadi@lgndry-co.co.za</a>
          <a href="tel:+27764862725">076 486 2725</a>
        </div>

        <div className="footer__col">
          <p className="footer__heading">Follow</p>
          <a
            className="footer__social-link"
            href="https://www.instagram.com/lgndry_content/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Instagram
          </a>
          <a
            className="footer__social-link"
            href="https://www.tiktok.com/@lgndry_content"
            target="_blank"
            rel="noopener noreferrer"
          >
            TikTok
          </a>
        </div>
      </div>

      <div className="footer__bottom container">
        <p>&copy; 2026 LGNDRY.Co</p>
        <p>All rights reserved.</p>
      </div>
    </footer>
  );
}
