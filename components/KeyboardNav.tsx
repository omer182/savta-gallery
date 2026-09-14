"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Walking the wall with the keyboard.
 *
 * Left and right step between paintings, Escape returns to the gallery. In a
 * room you move between works without going back to the entrance each time,
 * and on a desktop the arrow keys are how that reads.
 *
 * Under dir="rtl" the arrows follow the WALL, not the key caps: the next
 * painting sits to the left, so ArrowLeft goes forward. Mapping them the other
 * way round would be correct in English and wrong in front of the actual
 * layout.
 *
 * Ignored while focus is in a field or anything editable, so typing a search
 * term never navigates away mid-word.
 */
export function KeyboardNav({ prev, next }: { prev?: string; next?: string }) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;

      const el = document.activeElement as HTMLElement | null;
      if (el) {
        const tag = el.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable) {
          return;
        }
      }

      if (e.key === "ArrowLeft" && next) {
        e.preventDefault();
        router.push(next);
      } else if (e.key === "ArrowRight" && prev) {
        e.preventDefault();
        router.push(prev);
      } else if (e.key === "Escape") {
        e.preventDefault();
        router.push("/");
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, prev, next]);

  return null;
}
