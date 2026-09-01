import { verify } from "@node-rs/argon2";
import { cookies } from "next/headers";
import { COOKIE_NAME, type Role, type Session, verifyToken } from "./session";

/**
 * Login is a single password field with no username — the password itself
 * determines the role (PLAN.md §3). One field is one less thing to confuse her.
 */

export async function roleForPassword(password: string): Promise<Role | null> {
  const admin = process.env.ADMIN_PASSWORD_HASH;
  const artist = process.env.ARTIST_PASSWORD_HASH;

  // Both are always checked, so response time does not reveal which matched.
  const isAdmin = admin ? await safeVerify(admin, password) : false;
  const isArtist = artist ? await safeVerify(artist, password) : false;

  if (isAdmin) return "admin";
  if (isArtist) return "artist";
  return null;
}

async function safeVerify(hash: string, password: string) {
  try {
    return await verify(hash, password);
  } catch {
    return false; // malformed hash in env must not 500 the login route
  }
}

/** Current session from the request cookie, or null. */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return verifyToken(jar.get(COOKIE_NAME)?.value);
}

export async function requireRole(...allowed: Role[]): Promise<Session> {
  const session = await getSession();
  if (!session || !allowed.includes(session.role)) {
    throw new Response("Unauthorized", { status: 401 });
  }
  return session;
}

/**
 * Login rate limit — ~5 attempts/min per IP (PLAN.md §3). In-memory is
 * sufficient: one container, and Cloudflare absorbs anything larger.
 */
const attempts = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const LIMIT = 5;

export function rateLimit(ip: string): boolean {
  const now = Date.now();
  const hits = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  attempts.set(ip, hits);

  if (attempts.size > 5000) attempts.clear(); // crude unbounded-growth guard
  return hits.length <= LIMIT;
}
