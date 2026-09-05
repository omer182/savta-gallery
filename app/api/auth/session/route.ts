import { getSession } from "@/lib/auth";

/**
 * Reports whether the request carried a valid session.
 *
 * The login page calls this immediately after signing in: if the cookie did
 * not stick, navigating would bounce off middleware straight back to /login
 * and look like the form silently did nothing. Confirming first turns that
 * into a message that says what actually happened.
 */
export async function GET() {
  const session = await getSession();
  return Response.json(
    { role: session?.role ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
