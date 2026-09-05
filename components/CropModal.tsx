"use client";

import { useState } from "react";
import ReactCrop, { type Crop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import s from "./CropModal.module.css";

export type PctRect = { x: number; y: number; width: number; height: number };

/**
 * The one crop control, shared by the import review sheet and the painting
 * editor. Same interaction as the add flow: the whole photo is visible with a
 * draggable, resizable rectangle over it.
 *
 * The rect is in PERCENT of the image, never display pixels. Percentages
 * survive the image being laid out at whatever size the modal gives it, and
 * the server converts them against the original's real (rotation-corrected)
 * dimensions — so nothing depends on how the browser happened to render it.
 */
export function CropModal({
  src,
  title,
  initial,
  busy = false,
  onSave,
  onCancel,
}: {
  src: string;
  title: string;
  initial: PctRect | null;
  busy?: boolean;
  onSave: (rect: PctRect | null) => void;
  onCancel: () => void;
}) {
  const [crop, setCrop] = useState<Crop>(
    initial
      ? { unit: "%", ...initial }
      : { unit: "%", x: 10, y: 10, width: 80, height: 80 },
  );
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  const px = natural
    ? {
        w: Math.round((crop.width / 100) * natural.w),
        h: Math.round((crop.height / 100) * natural.h),
      }
    : null;

  const valid = crop.width > 0 && crop.height > 0;

  return (
    <div className={s.modal} role="dialog" aria-modal="true">
      <div className={s.inner}>
        <p className={s.title} dir="auto">
          {title}
        </p>

        <div className={s.stage}>
          <ReactCrop
            crop={crop}
            onChange={(_pxCrop, pct) => setCrop(pct)}
            keepSelection
            minWidth={20}
            minHeight={20}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              className={s.photo}
              onLoad={(e) =>
                setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
              }
            />
          </ReactCrop>
        </div>

        {px && (
          <p className={s.readout}>
            {px.w} × {px.h} פיקסלים
          </p>
        )}

        <div className={s.actions}>
          <button
            className={s.primary}
            type="button"
            disabled={busy || !valid}
            onClick={() => onSave(valid ? { x: crop.x, y: crop.y, width: crop.width, height: crop.height } : null)}
          >
            {busy ? "מעבד…" : "שמירת החיתוך"}
          </button>
          <button className={s.quiet} type="button" disabled={busy} onClick={() => onSave(null)}>
            ללא חיתוך
          </button>
          <button className={s.quiet} type="button" disabled={busy} onClick={onCancel}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
