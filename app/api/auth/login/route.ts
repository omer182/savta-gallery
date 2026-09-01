import type { NextRequest } from "next/server";
import { rateLimit, roleForPassword } from "@/lib/auth";
import { COOKIE_NAME, cookieOptions, createToken } from "@/lib/session";

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  if (!rateLimit(ip)) {
    return Response.json({ error: "יותר מדי ניסיונות. נסו שוב בעוד דקה." }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as { password?: string } | null;
  const password = body?.password ?? "";
  if (!password) {
    return Response.json({ error: "צריך סיסמה." }, { status: 400 });
  }

  const role = await roleForPassword(password);
  if (!role) {
    // Deliberately does not say whether the password was close, or which role
    // it nearly matched.
    return Response.json({ error: "סיסמה שגויה." }, { status: 401 });
  }

  const res = Response.json({ ok: true, role, next: role === "admin" ? "/admin" : "/admin/add" });
  const headers = new Headers(res.headers);
  const opts = cookieOptions(role);
  headers.append(
    "Set-Cookie",
    `${COOKIE_NAME}=${await createToken(role)}; Path=${opts.path}; Max-Age=${opts.maxAge}; SameSite=Lax; HttpOnly${
      opts.secure ? "; Secure" : ""
    }`,
  );

  return new Response(res.body, { status: res.status, headers });
}
