import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // PGlite (demo mode and tests) loads its WebAssembly from node_modules at run time.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Meridian ships as plain ES modules and CSS from GitHub.
  transpilePackages: ["@pedrobritx/meridian"],
};

export default nextConfig;
