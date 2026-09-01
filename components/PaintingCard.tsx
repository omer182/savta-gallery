import Link from "next/link";
import type { CardView } from "@/lib/cardView";
import { BlurImage } from "./BlurImage";
import s from "./gallery.module.css";
import { Placard } from "./Placard";

/**
 * A grid item. Purely presentational — it takes a precomputed CardView so it can
 * render on the client (search results) without dragging sharp or Buffer along.
 *
 * It is a real <a>, not a click-handled <figure>: keyboard reachable,
 * cmd-clickable, crawlable, with a visible focus ring (PLAN.md §2).
 */
export function PaintingCard({ p, priority = false }: { p: CardView; priority?: boolean }) {
  return (
    <Link className={s.cardInner} href={p.href}>
      <span className={s.frame}>
        <BlurImage
          alt={p.title}
          avif={p.avif}
          webp={p.webp}
          fallback={p.fallback}
          placeholder={p.placeholder}
          width={p.width}
          height={p.height}
          ratio={p.ratio}
          sizes="(min-width: 640px) 33vw, 50vw"
          priority={priority}
        />
        <Placard title={p.title} year={p.year} medium={p.medium} variant="hover" />
      </span>
      <Placard title={p.title} year={p.year} medium={p.medium} variant="static" />
    </Link>
  );
}
