import { formatSize } from "@/lib/format";
import s from "./gallery.module.css";

/**
 * The wall label — PLAN.md §2's signature element.
 *
 * Three variants:
 *   tap    — over the foot of the painting, revealed by the first tap. Touch.
 *   hover  — the same position, revealed on hover. Mouse only.
 *   plain  — a paper label beside the work on the painting page.
 *
 * A tile renders both `tap` and `hover` and lets the media queries pick; which
 * one applies depends on the pointer, which is not knowable on the server.
 * `hover` is marked aria-hidden so the pair never reads twice — the link is
 * already labelled by the image alt text.
 *
 * Source order stays logical (`1998 · שמן על בד`); under dir="rtl" bidi puts
 * the year at the inline-start edge, which is what a Hebrew placard wants.
 */
export function Placard({
  title,
  year,
  medium,
  widthCm,
  heightCm,
  variant = "tap",
  large = false,
}: {
  title: string;
  year: number | null;
  medium: string | null;
  widthCm?: number | null;
  heightCm?: number | null;
  variant?: "tap" | "hover" | "plain";
  large?: boolean;
}) {
  const size = formatSize(widthCm ?? null, heightCm ?? null);
  const meta = [year, medium].filter(Boolean).join(" · ");

  const cls = [
    s.placard,
    variant === "plain" ? s.placardPlain : s.placardOver,
    variant === "tap" ? s.placardTap : "",
    variant === "hover" ? s.placardHover : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} aria-hidden={variant === "hover" ? true : undefined}>
      <div className={s.placardTitle} style={large ? { fontSize: 24 } : undefined} dir="auto">
        {title}
      </div>
      {(meta || size) && (
        <div
          className={s.placardMeta}
          style={large ? { fontSize: 13, marginTop: 7 } : undefined}
          dir="auto"
        >
          {meta}
          {large && size && (
            <>
              <br />
              {size}
            </>
          )}
        </div>
      )}
    </div>
  );
}
