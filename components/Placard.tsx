import { formatSize } from "@/lib/format";
import s from "./gallery.module.css";

/**
 * The wall label — PLAN.md §2's signature element.
 *
 * Three variants:
 *   static — over the foot of the painting, always on. Touch screens.
 *   hover  — the same position, revealed on hover. Mouse only.
 *   plain  — a paper label beside the work on the painting page.
 *
 * A tile renders both `static` and `hover` and lets the media queries pick;
 * which one applies depends on the pointer, which the server cannot know. Each
 * hides the other with display:none, so exactly one is ever in the
 * accessibility tree. `hover` is additionally aria-hidden because the link is
 * already labelled by the image alt text.
 *
 * Neither is a control: a tap anywhere on the tile opens the painting, and the
 * label never intercepts it.
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
  variant = "static",
  large = false,
  showTitle = true,
}: {
  title: string;
  year: number | null;
  medium: string | null;
  widthCm?: number | null;
  heightCm?: number | null;
  variant?: "static" | "hover" | "plain";
  large?: boolean;
  /** Off on the painting page, where the title is already the page heading. */
  showTitle?: boolean;
}) {
  const size = formatSize(widthCm ?? null, heightCm ?? null);
  const meta = [year, medium].filter(Boolean).join(" · ");

  const cls = [
    s.placard,
    variant === "plain" ? s.placardPlain : s.placardOver,
    variant === "static" ? s.placardStatic : "",
    variant === "hover" ? s.placardHover : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} aria-hidden={variant === "hover" ? true : undefined}>
      {showTitle && (
        <div className={s.placardTitle} style={large ? { fontSize: 24 } : undefined} dir="auto">
          {title}
        </div>
      )}
      {(meta || size) && (
        <div
          className={s.placardMeta}
          style={large ? { fontSize: 13, marginTop: showTitle ? 7 : 0 } : undefined}
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
