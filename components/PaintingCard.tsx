import Link from "next/link";
import type { CardView } from "@/lib/cardView";
import { BlurImage } from "./BlurImage";
import s from "./gallery.module.css";
import { Placard } from "./Placard";

/**
 * One painting in the mosaic: the canvas, with its wall label on it. Nothing
 * sits underneath - no caption, no frame furniture.
 *
 * The label is the same on both surfaces, and only its timing differs. A mouse
 * fades it in on hover, so a wide wall stays clean until a work is approached.
 * A phone has no hover, so it is simply always there - and a tap anywhere on
 * the tile opens the painting, label included. The obvious gesture does the
 * obvious thing.
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
        <Placard title={p.title} year={p.year} medium={p.medium} variant="static" />
        <Placard title={p.title} year={p.year} medium={p.medium} variant="hover" />
      </Link>
    </>
  );
}
