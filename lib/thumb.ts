import { thumbHashToDataURL } from "thumbhash";

/**
 * Decodes a stored thumbhash to a data URL on the server, so the gallery ships
 * blur placeholders without sending a decoding library to the browser.
 */
export function thumbhashDataUrl(base64: string | null | undefined): string | null {
  if (!base64) return null;
  try {
    return thumbHashToDataURL(Buffer.from(base64, "base64"));
  } catch {
    return null;
  }
}
