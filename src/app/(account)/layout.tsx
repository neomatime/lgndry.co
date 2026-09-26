import type { Metadata } from "next";
import { cormorantAccount, inter } from "@/lib/fonts";

// Same cascade order the legacy auth and account pages linked them in. These
// pages never loaded style.css, so this is a root layout of its own rather than
// part of the storefront's.
import "@/styles/public/account-bundle.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.lgndry-co.co.za"),
  icons: {
    icon: { url: "/assests/logos/LGNDRY.CO%20Final.png", type: "image/png" },
    apple: "/assests/logos/LGNDRY.CO%20Final%20white.png",
  },
  referrer: "strict-origin-when-cross-origin",
};

export default function AccountRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorantAccount.variable}`}>
      <body className="account-body">
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
