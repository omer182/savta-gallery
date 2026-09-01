import { formatSize } from "@/lib/format";
import s from "./gallery.module.css";

/**
 * The wall label — PLAN.md §2's signature element.
 *
 * Source order stays logical (`1998 · שמן על בד`); under dir="rtl" bidi renders
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
}: {
  title: string;
  year: number | null;
  medium: string | null;
  widthCm?: number | null;
  heightCm?: number | null;
  variant?: "static" | "hover" | "plain";
  large?: boolean;
}) {
  const size = formatSize(widthCm ?? null, heightCm ?? null);
  const meta = [year, medium].filter(Boolean).join(" · ");

  const cls = [
    s.placard,
    variant === "static" ? s.placardStatic : "",
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
