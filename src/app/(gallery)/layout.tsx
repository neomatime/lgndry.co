import type { Metadata } from "next";
import { cormorantGallery, inter } from "@/lib/fonts";

// The gallery page loaded only its own inline rules (now gallery.css) and the
// premium and editorial stylesheets; it never used style.css.
import "@/styles/public/gallery-bundle.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.lgndry-co.co.za"),
  icons: {
    icon: { url: "/assests/logos/LGNDRY.CO%20Final.png", type: "image/png" },
  },
  referrer: "strict-origin-when-cross-origin",
  robots: { index: false, follow: false },
};

export default function GalleryRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorantGallery.variable}`}>
      <body>
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
