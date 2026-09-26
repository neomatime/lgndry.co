import { Cormorant_Garamond, Inter } from "next/font/google";

// Fonts for the account and gallery pages. The ported stylesheets name
// 'Inter' and 'Cormorant Garamond' literally; their font-family rules are
// prefixed with these variables so the self-hosted files are used.
// Inter is a variable font: no `weight` list (a list breaks the Turbopack build).

export const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

/** Weights the legacy account and auth pages loaded (300 and 400 only). */
export const cormorantAccount = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-cormorant",
  display: "swap",
});

/** Weights the legacy gallery page loaded (adds 500 for its brand mark). */
export const cormorantGallery = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-cormorant",
  display: "swap",
});
