import type { MetadataRoute } from "next";

/**
 * PWA manifest — PLAN.md §8.
 *
 * One manifest, `start_url: "/"`, no separate install scopes. When an artist
 * session hits "/", the app redirects to /admin/add, so her home-screen icon
 * lands on the add screen while a visitor's lands on the gallery.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "בלומה שורצברג קמין",
    short_name: "בלומה",
    description: "ארכיון הציורים של בלומה שורצברג קמין",
    start_url: "/",
    display: "standalone",
    dir: "rtl",
    lang: "he",
    background_color: "#F7F4EE",
    theme_color: "#F7F4EE",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      // iOS masks the corners itself, so the maskable variant must not be
      // transparent or padded.
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
