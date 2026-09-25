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
    return [{ source: "/index.html", destination: "/", permanent: true }];
  },

  async headers() {
    return [
      {
        // Public pages only: the CSP the legacy pages declared in a <meta> tag.
        source: "/((?!ops|auth|_next).*)",
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
