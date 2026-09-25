import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { NavPanel } from "@/components/site/nav-panel";
import { NavProvider } from "@/components/site/nav-context";
import { SiteHeader } from "@/components/site/site-header";

// Order matters: this is the same cascade order the legacy pages linked them in.
import "@/styles/public/style.css";
import "@/styles/public/premium.css";
import "@/styles/public/editorial-sharp.css";
import "@/styles/public/overrides.css";

// The ported CSS names these families literally ('Inter', 'Cormorant Garamond');
// its font-family rules have been prefixed with these variables so the
// self-hosted next/font files are used, with the literal names as fallback.
// Inter is a variable font: no `weight` list, so the one file covers 300/400.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-cormorant",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.lgndry-co.co.za"),
  icons: {
    icon: { url: "/assests/logos/LGNDRY.CO%20Final.png", type: "image/png" },
    apple: "/assests/logos/LGNDRY.CO%20Final%20white.png",
  },
  referrer: "strict-origin-when-cross-origin",
};

// Runs before first paint: returning visitors in this session skip the intro
// loader (see components/site/loader.tsx), so it must never flash.
const SKIP_LOADER_SCRIPT = `try{if(sessionStorage.getItem('lgndry_loaded'))document.documentElement.setAttribute('data-skip-loader','')}catch(e){}`;

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SKIP_LOADER_SCRIPT }} />
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <NavProvider>
          <SiteHeader />
          <NavPanel />
          {children}
        </NavProvider>
      </body>
    </html>
  );
}
