"use client";

import { useEffect, useRef, useState } from "react";
import s from "./BlurImage.module.css";

/**
 * Blur-up loading (PLAN.md §2). The thumbhash placeholder is decoded to a data
 * URL on the server and passed in, so no decoding library ships to the client.
 *
 * `derivedHash` null means the painting has no processed image yet — a seeded
 * row, or an upload still in the queue. The card keeps its proportions rather
 * than collapsing.
 */
export function BlurImage({
  avif,
  webp,
  fallback,
  placeholder,
  width,
  height,
  ratio,
  alt,
  sizes,
  priority = false,
}: {
  avif?: string | null;
  webp?: string | null;
  fallback?: string | null;
  placeholder?: string | null;
  width?: number | null;
  height?: number | null;
  /** height / width, used when there is no image to measure. */
  ratio?: number;
  alt: string;
  sizes?: string;
  priority?: boolean;
}) {
  const [ready, setReady] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // A cached image can finish before hydration attaches onLoad, which would
  // leave it permanently invisible behind the placeholder.
  useEffect(() => {
    if (imgRef.current?.complete) setReady(true);
  }, []);

  const aspect = width && height ? height / width : (ratio ?? 1);

  if (!fallback) {
    return (
      <span className={s.shot} style={{ aspectRatio: `1 / ${aspect}` }}>
        <span className={s.none} style={{ aspectRatio: `1 / ${aspect}` }} />
        <span className={s.noneLabel}>ממתין לעיבוד</span>
      </span>
    );
  }

  return (
    <span className={`${s.shot} ${ready ? s.ready : ""}`} style={{ aspectRatio: `1 / ${aspect}` }}>
      {placeholder ? (
        <img className={s.ph} src={placeholder} alt="" aria-hidden="true" />
      ) : (
        <span className={s.none} style={{ aspectRatio: `1 / ${aspect}` }} />
      )}
      <picture>
        {avif && <source type="image/avif" srcSet={avif} sizes={sizes} />}
        {webp && <source type="image/webp" srcSet={webp} sizes={sizes} />}
        <img
          ref={imgRef}
          className={s.real}
          src={fallback}
          alt={alt}
          width={width ?? undefined}
          height={height ?? undefined}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : undefined}
          onLoad={() => setReady(true)}
          onError={() => setReady(true)}
        />
      </picture>
    </span>
  );
}
