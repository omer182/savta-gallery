"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CropModal, type PctRect } from "@/components/CropModal";
import a from "../../admin.module.css";
import s from "./editor.module.css";

/**
 * The painting's main image, click-to-crop.
 *
 * Re-cropping always works from the stored ORIGINAL, never from the current
 * derivative, so a crop is never applied on top of a previous one — every pass
 * starts from the full frame and the result is reproducible.
 */
export function PaintingImage({
  paintingId,
  imageId,
  title,
  originalSrc,
  displaySrc,
  needsCrop,
}: {
  paintingId: number;
  imageId: number;
  title: string;
  originalSrc: string;
  /** The derivative when one exists; otherwise the original. */
  displaySrc: string;
  needsCrop: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function apply(rect: PctRect | null) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/import/crop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ imageId, paintingId, rectPct: rect }] }),
      });
      if (!res.ok) throw new Error();
      setOpen(false);
      router.refresh();
    } catch {
      setErr("החיתוך נכשל. נסו שוב.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {err && <div className={`${a.note} ${a.error}`}>{err}</div>}

      <button type="button" className={s.imageButton} onClick={() => setOpen(true)}>
        <span className={a.preview} style={{ display: "block" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={displaySrc} alt="" style={{ display: "block", width: "100%" }} />
        </span>
        <span className={s.imageHint}>{needsCrop ? "לחצו לחיתוך התמונה" : "לחצו לחיתוך מחדש"}</span>
      </button>

      {open && (
        <CropModal
          src={originalSrc}
          title={title}
          initial={null}
          busy={busy}
          onSave={apply}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  );
}
