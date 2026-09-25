import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// The legacy static site (HTML/JS/CSS under assests/, api/, root *.js and the
// old edge functions) is not part of the TypeScript application; it is
// deleted in the "remove legacy" phase once the Next.js app reaches parity.
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "coverage/**",
    "next-env.d.ts",
    "assests/**",
    "api/**",
    "supabase/functions/**",
    "docs/**",
    "*.js",
  ]),
]);
