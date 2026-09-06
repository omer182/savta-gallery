import type { NextRequest } from "next/server";
import { authLog } from "@/lib/authLog";

/**
 * Receives client-side JavaScript errors so they land in the server log.
 *
 * Exists because a phone's console is not reachable from here: when hydration
 * silently fails on a device, this is the only way to see why. Gated on
 * AUTH_DEBUG and a no-op otherwise.
 */
export async function POST(req: NextRequest) {
  if (process.env.AUTH_DEBUG !== "1") return new Response(null, { status: 204 });

  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  authLog("client-error", {
    msg: String(b?.message ?? "?").slice(0, 300),
    at: `${b?.source ?? "?"}:${b?.line ?? "?"}:${b?.col ?? "?"}`,
    ua: String(b?.ua ?? "?").slice(0, 120),
  });
  if (b?.stack) authLog("client-error:stack", { stack: String(b.stack).slice(0, 600) });

  return new Response(null, { status: 204 });
}
