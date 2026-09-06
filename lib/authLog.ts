/**
 * Opt-in tracing for the sign-in exchange, enabled with AUTH_DEBUG=1.
 *
 * Off by default and Edge-safe (no node APIs), because middleware imports it.
 *
 * NEVER logs a password or a session token: a token in a log file is a
 * usable credential. Only presence, length and a short prefix, which is
 * enough to tell "no cookie arrived" from "a different cookie arrived" from
 * "the right cookie arrived but failed to verify".
 */
const ON = process.env.AUTH_DEBUG === "1";

export function authLog(event: string, data: Record<string, unknown> = {}) {
  if (!ON) return;
  const parts = Object.entries(data).map(([k, v]) => `${k}=${v}`);
  console.log(`[auth] ${event}${parts.length ? "  " + parts.join("  ") : ""}`);
}

/** A token is a credential — describe it, never print it. */
export function describeToken(token: string | undefined | null) {
  if (!token) return "absent";
  return `present(len=${token.length},head=${token.slice(0, 8)}…)`;
}

/** Request context that actually explains cookie behaviour. */
export function describeRequest(req: Request) {
  const h = req.headers;
  return {
    host: h.get("host") ?? "-",
    proto: h.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", ""),
    origin: h.get("origin") ?? "-",
    hasCookieHeader: h.get("cookie") ? "yes" : "NO",
    ua: (h.get("user-agent") ?? "-").slice(0, 48),
  };
}
