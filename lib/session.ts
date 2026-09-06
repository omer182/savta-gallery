/**
 * Sessions — PLAN.md §3. No auth library: a signed httpOnly cookie carrying
 * only `{ role, exp }`, verified with HMAC-SHA256.
 *
 * Uses Web Crypto, NOT node:crypto. This module is imported by middleware,
 * which runs on the Edge runtime where node:crypto does not exist — importing
 * it there fails at module evaluation and 500s every gated route. Web Crypto is
 * available in both runtimes, and `crypto.subtle.verify` compares in constant
 * time, so nothing is lost.
 *
 * The artist's cookie rolls for 365 days so she effectively never re-auths; the
 * blast radius that makes this safe is that her role cannot publish or delete.
 */

export type Role = "admin" | "artist";
export type Session = { role: Role; exp: number };

export const COOKIE_NAME = "savta_session";

export const MAX_AGE: Record<Role, number> = {
  artist: 365 * 24 * 60 * 60,
  admin: 30 * 24 * 60 * 60,
};

const enc = new TextEncoder();

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    // Failing loudly beats silently signing every cookie with a default key.
    throw new Error("SESSION_SECRET is missing or too short (need >= 16 chars)");
  }
  return s;
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Returns a Uint8Array backed by a plain ArrayBuffer, which is what
 * crypto.subtle accepts as a BufferSource. */
function b64urlDecode(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function key(usage: "sign" | "verify") {
  return crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, [
    usage,
  ]);
}

export async function createToken(role: Role): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE[role];
  const payload = b64urlEncode(enc.encode(JSON.stringify({ role, exp })));
  const sig = await crypto.subtle.sign("HMAC", await key("sign"), enc.encode(payload));
  return `${payload}.${b64urlEncode(new Uint8Array(sig))}`;
}

export async function verifyToken(token: string | undefined | null): Promise<Session | null> {
  if (!token) return null;
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;

  let ok: boolean;
  try {
    ok = await crypto.subtle.verify("HMAC", await key("verify"), b64urlDecode(mac), enc.encode(payload));
  } catch {
    return null;
  }
  if (!ok) return null;

  try {
    const data = JSON.parse(new TextDecoder().decode(b64urlDecode(payload))) as Session;
    if (data.role !== "admin" && data.role !== "artist") return null;
    if (typeof data.exp !== "number" || data.exp * 1000 < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * `secure` is decided by the ACTUAL connection, not by NODE_ENV.
 *
 * A Secure cookie is silently discarded over plain HTTP. Keying it to
 * NODE_ENV=production meant the deployed app could never be signed into over
 * http — visiting the server directly on the LAN accepted the password, set a
 * cookie the browser threw away, and bounced back to the login page with no
 * error. Behind Cloudflare/nginx the request is https and the flag is still
 * set, which is where it actually matters.
 */
export function cookieOptions(role: Role, isSecure: boolean) {
  return {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE[role],
  };
}

/** True when the browser's connection is HTTPS, proxies accounted for. */
export function requestIsSecure(req: Request): boolean {
  const proto =
    req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  return proto.split(",")[0]!.trim() === "https";
}
