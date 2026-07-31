import path from "path";
import type { NextConfig } from "next";

/**
 * PRAD Marketing Website — Next.js configuration.
 *
 * This is a purely static marketing site. It has no API rewrites —
 * all CTAs link directly to the PRAD app (configured in src/lib/site.config.ts).
 *
 * output: "standalone" is required for the Docker build (Render deployment).
 *
 * outputFileTracingRoot: forces the standalone output to be rooted at THIS
 * app directory, not the monorepo root. Without this, Next.js traces up to
 * the workspace root and nests server.js under apps/prad-website/server.js
 * instead of server.js — breaking the Dockerfile's CMD ["node", "server.js"].
 */
const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
