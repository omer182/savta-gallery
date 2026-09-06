import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces .next/standalone for the Docker image (PLAN.md §7, build step 9).
  output: "standalone",

  /*
   * DEV ONLY. `next dev` refuses cross-origin requests to /_next/* by default,
   * so a phone browsing the LAN address gets the HTML but is denied the dev
   * chunks — the page renders and then never hydrates, with no error anywhere
   * on the client. Testing on a real device is the whole point of the admin
   * flow, so the private ranges are allowed here.
   *
   * This has no effect on the production build: the container serves prebuilt
   * assets and this guard does not exist there.
   */
  // Hostnames and wildcard patterns — CIDR ranges are not supported here.
  allowedDevOrigins: ["192.168.0.178", "192.168.0.*", "192.168.1.*", "10.0.0.*", "*.local"],

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
