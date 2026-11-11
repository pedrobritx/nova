import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // PGlite (demo mode and tests) loads its WebAssembly from node_modules at run time.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Meridian ships as plain ES modules and CSS from GitHub.
  transpilePackages: ["@pedrobritx/meridian"],
  experimental: {
    serverActions: {
      // OPML imports go through a Server Action and may be up to 2 MB (src/lib/limits.ts).
      // The default 1 MB limit would reject them before Nova could answer. 3 MB leaves room
      // for the multipart wrapping and stays under Vercel's 4.5 MB request limit.
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
