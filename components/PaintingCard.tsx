import type { CardView } from "@/lib/cardView";
import { BlurImage } from "./BlurImage";
import { CardLink } from "./CardLink";
import s from "./gallery.module.css";
import { Placard } from "./Placard";

/**
 * One painting in the mosaic, laid out as the mock's <figure>: the matted
 * frame, then a quiet caption beneath it.
 *
 * The caption carries the title and year and is always on screen. The full
 * placard - title, year, medium - lies over the foot of the painting and waits
 * to be asked for: hover on a mouse, the first tap on a phone.
 *
 * Purely presentational, taking a precomputed CardView so it can also render
 * on the client (search results) without dragging sharp or Buffer along.
 */
export function PaintingCard({ p, priority = false }: { p: CardView; priority?: boolean }) {
  return (
    <>
      <CardLink className={s.frame} href={p.href}>
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
        <Placard title={p.title} year={p.year} medium={p.medium} variant="tap" />
        <Placard title={p.title} year={p.year} medium={p.medium} variant="hover" />
      </CardLink>
      <figcaption className={s.cap} dir="auto">
        <span className={s.capTitle}>{p.title}</span>
        {p.year ? `, ${p.year}` : ""}
      </figcaption>
    </>
  );
}
