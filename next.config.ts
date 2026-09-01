import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces .next/standalone for the Docker image (PLAN.md §7, build step 9).
  output: "standalone",

  // better-sqlite3 is a native module; it must stay external rather than being
  // bundled into the server build.
  serverExternalPackages: ["better-sqlite3"],

  // Without this, output file tracing follows the build-time database read and
  // copies ./data into .next/standalone — baking a stale dev DB into the image,
  // where it can shadow the /data bind mount. All persistent state must come
  // from the mount at runtime, never from the image.
  outputFileTracingExcludes: {
    "*": ["./data/**"],
  },
};

export default nextConfig;
