import { revalidatePath } from "next/cache";

/**
 * Drops the cached public pages after a change.
 *
 * Deliberately NOT in lib/mutations.ts: that module is also used by the bulk
 * import CLI, and importing next/cache there drags the whole Next runtime into
 * a plain node script. Revalidation is a web concern, so it lives with the
 * route handlers that can actually call it — outside a request it throws.
 */
export function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/about");
  revalidatePath("/painting/[slug]", "page");
}
