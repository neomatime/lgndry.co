import Link from "next/link";

/**
 * The lighter footers the shop pages use (the legacy `site-footer`), as
 * opposed to the full brand footer on the content pages.
 */

const EXPLORE = [
  { label: "Home", href: "/" },
  { label: "Practice", href: "/services" },
  { label: "Collections", href: "/collection" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

/** Full-width footer with navigation, contact and social links (showroom). */
export function ShowroomFooter() {
  return (
    <footer className="site-footer">
      <div className="footer__top container">
        <div className="footer__brand">
          <p className="footer__logo">LGNDRY.Co</p>
          <p className="footer__tagline">Visual stories, intentionally made.</p>
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

/** Copyright line only (cart). */
export function CartFooter() {
  return (
    <footer className="site-footer">
      <div className="footer__bottom container">
        <p>&copy; 2026 LGNDRY.Co</p>
        <p>Selected with intention.</p>
      </div>
    </footer>
  );
}
