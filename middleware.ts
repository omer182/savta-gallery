import { type NextRequest, NextResponse } from "next/server";
import { authLog, describeRequest, describeToken } from "@/lib/authLog";
import { COOKIE_NAME, verifyToken } from "@/lib/session";

/**
 * Gates /admin (PLAN.md §6). Route handlers re-check the session themselves —
 * middleware is a first line, never the only one.
 *
 * Runs on the Edge runtime, so it may only import lib/session.ts, which is
 * built on Web Crypto for exactly this reason — node:crypto does not exist on
 * Edge and fails at module evaluation. Pulling in anything that touches
 * better-sqlite3 or sharp here would break the build too.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const raw = req.cookies.get(COOKIE_NAME)?.value;
  const session = await verifyToken(raw);
  authLog("middleware", {
    path: pathname,
    ...describeRequest(req),
    token: describeToken(raw),
    verified: session ? session.role : "NO",
  });

  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  // The artist has no dashboard: her only admin surface is the add flow, so
  // everything else under /admin is admin-only (§1).
  const artistAllowed = pathname === "/admin/add" || pathname.startsWith("/admin/add/");
  if (session.role === "artist" && !artistAllowed) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/add";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
