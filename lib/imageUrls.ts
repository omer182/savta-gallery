/**
 * Pure URL helpers, deliberately kept in their own module.
 *
 * `lib/images.ts` imports sharp, which must never reach a client bundle — the
 * search page renders cards on the client, so anything a card touches has to be
 * free of node-only dependencies.
 */

export const DERIVATIVE_WIDTHS = [400, 800, 1600, 2400] as const;
export const JPEG_FALLBACK_WIDTH = 1600;

const shardOf = (hash: string) => hash.slice(0, 2);

/** Content-hashed, therefore immutable and safe to cache forever (§4, §7). */
export function derivativeUrl(derivedHash: string, width: number, fmt: "avif" | "webp" | "jpg") {
  return `/images/derived/${shardOf(derivedHash)}/${derivedHash}-${width}.${fmt}`;
}

export function srcSet(derivedHash: string, intrinsicWidth: number, fmt: "avif" | "webp") {
  const ws = DERIVATIVE_WIDTHS.filter((w) => w <= intrinsicWidth);
  if (ws.length === 0) return `${derivativeUrl(derivedHash, DERIVATIVE_WIDTHS[0], fmt)} ${DERIVATIVE_WIDTHS[0]}w`;
  return ws.map((w) => `${derivativeUrl(derivedHash, w, fmt)} ${w}w`).join(", ");
}

export function fallbackUrl(derivedHash: string) {
  return derivativeUrl(derivedHash, JPEG_FALLBACK_WIDTH, "jpg");
}
