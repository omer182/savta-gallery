import Link from "next/link";
import type { CardView } from "@/lib/cardView";
import { BlurImage } from "./BlurImage";
import s from "./gallery.module.css";
import { Placard } from "./Placard";

/**
 * One painting in the mosaic. Nothing else - no caption, no frame furniture.
 *
 * The wall is paintings and only paintings. The label belongs to the mouse:
 * hovering a work fades its title, year and medium in over the foot of the
 * canvas. A phone gets no label at all, because there a touch means "open
 * this", and making the first one mean something else puts a step between her
 * and the painting.
 *
 * So on a phone the tile is the painting and nothing more, and everything
 * about the work lives one tap away on its own page.
 *
 * A real <a href>: keyboard reachable, cmd-clickable, crawlable, with a
 * visible focus ring (PLAN.md §2).
 *
 * Purely presentational, taking a precomputed CardView so it can also render
 * on the client (search results) without dragging sharp or Buffer along.
 */
export function PaintingCard({ p, priority = false }: { p: CardView; priority?: boolean }) {
  return (
    <>
      <Link className={s.frame} href={p.href}>
        <BlurImage
          alt={p.title}
          avif={p.avif}
          webp={p.webp}
          fallback={p.fallback}
          placeholder={p.placeholder}
          width={p.width}
          height={p.height}
          ratio={p.ratio}
          sizes="(min-width: 760px) 33vw, 50vw"
          priority={priority}
        />
        <Placard title={p.title} year={p.year} medium={p.medium} variant="hover" />
      </Link>
    </>
  );
}
