import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Pin the workspace root; otherwise a stray lockfile higher up the tree
  // (e.g. in the user's home folder) can be mistaken for the project root.
  turbopack: { root: path.resolve(__dirname) },

  images: {
    // The site's photographs are already resized/optimised WebP, and their
    // /assests/... URLs are referenced from sent emails and external links,
    // so they're served as-is rather than rewritten to /_next/image URLs.
    unoptimized: true,
  },

  async redirects() {
    // Legacy .html URLs → clean URLs, permanently, so existing search
    // rankings and inbound links carry over. Add each page here as it migrates.
    return [
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/about.html", destination: "/about", permanent: true },
      { source: "/services.html", destination: "/services", permanent: true },
      { source: "/contact.html", destination: "/contact", permanent: true },
      { source: "/collection.html", destination: "/collection", permanent: true },
      { source: "/cart.html", destination: "/cart", permanent: true },
      { source: "/checkout.html", destination: "/checkout", permanent: true },
      { source: "/auth.html", destination: "/auth", permanent: true },
      // Emailed verification and reset links (and Google sign-in) come back here,
      // with the sign-in code in the query or fragment: both are carried across.
      { source: "/auth-callback.html", destination: "/auth-callback", permanent: true },
      { source: "/account.html", destination: "/account", permanent: true },
      { source: "/gallery.html", destination: "/gallery", permanent: true },
      {
        source: "/order-confirmation.html",
        destination: "/order-confirmation",
        permanent: true,
      },
      // The old showroom took the artwork as ?id=…; it's now part of the path.
      {
        source: "/showroom.html",
        has: [{ type: "query", key: "id", value: "(?<id>[^/&]+)" }],
        destination: "/showroom/:id",
        permanent: true,
      },
      { source: "/showroom.html", destination: "/collection", permanent: true },
    ];
  },

  async headers() {
    return [
      {
        // Public pages only: the CSP the legacy pages declared in a <meta> tag.
        source: "/((?!ops|auth/|_next).*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "base-uri 'self'; form-action 'self' https://www.lgndry-co.co.za https://lgndry-co.co.za",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
