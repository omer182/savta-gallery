import { COOKIE_NAME } from "@/lib/session";

export async function POST() {
  return new Response(null, {
    status: 204,
    headers: {
      "Set-Cookie": `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly`,
    },
  });
}
