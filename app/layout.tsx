import type { Metadata } from "next";
import { Assistant, Frank_Ruhl_Libre } from "next/font/google";
import "./globals.css";

/*
 * next/font self-hosts these at build time, so there is no runtime request to
 * Google (PLAN.md §2, §9). Both need the `hebrew` subset — the site is Hebrew
 * throughout, chrome included.
 */
const frank = Frank_Ruhl_Libre({
  variable: "--font-frank",
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const assistant = Assistant({
  variable: "--font-assistant",
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "בלומה שוורצברג קמין",
  description: "ארכיון הציורים של בלומה שוורצברג קמין — חמישים שנות עבודה, והסיפורים שמאחוריהם.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="he" dir="rtl" className={`${frank.variable} ${assistant.variable}`}>
      <body>{children}</body>
    </html>
  );
}
