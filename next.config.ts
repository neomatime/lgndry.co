import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Pin the workspace root; otherwise a stray lockfile higher up the tree
  // (e.g. in the user's home folder) can be mistaken for the project root.
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
