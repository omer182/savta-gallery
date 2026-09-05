"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ReactCrop, { type Crop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import type { CropRect } from "@/lib/images";
import a from "../../admin.module.css";
import s from "./crop.module.css";

export type CropItem = {
  paintingId: number;
  imageId: number;
  title: string;
  src: string;
  rect: CropRect | null;
  confidence: number;
  fullWidth: number;
  fullHeight: number;
};

/**
 * Contact sheet for the crop pass (PLAN.md §11).
 *
 * Most proposals are correct, so the job is scanning rather than deciding: fix
 * the doubtful ones (which sort first), then approve the page in one action.
 * ~500 decisions collapse to ~30.
 */
export function CropSheet({ items }: { items: CropItem[] }) {
  const router = useRouter();
  const [rects, setRects] = useState<Record<number, CropRect | null>>(
    Object.fromEntries(items.map((i) => [i.imageId, i.rect])),
  );
  const [editing, setEditing] = useState<CropItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function approveAll() {
    setBusy(true);
    setNote("מייצר גרסאות תמונה… זה לוקח רגע.");
    try {
      const res = await fetch("/api/import/crop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            imageId: i.imageId,
            paintingId: i.paintingId,
            rect: rects[i.imageId] ?? null,
          })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { failures?: number[] };
      setNote(
        data.failures?.length
          ? `${data.failures.length} תמונות נכשלו בעיבוד.`
          : "אושר. טוען את הקבוצה הבאה…",
      );
      router.refresh();
    } catch {
      setNote("האישור נכשל. נסו שוב.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {note && <div className={a.note}>{note}</div>}

      <div className={s.sheet}>
        {items.map((it) => {
          const r = rects[it.imageId];
          return (
            <button
              key={it.imageId}
              type="button"
              className={s.cell}
              onClick={() => setEditing(it)}
            >
              <span className={s.stage}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.src} alt="" className={s.photo} loading="lazy" />
                {r && <span className={s.rect} style={pct(r, it)} />}
              </span>
              <span className={s.meta}>
                <span className={s.metaTitle} dir="auto">
                  {it.title}
                </span>
                <span className={it.confidence < 0.5 ? s.confLow : s.conf}>
                  {r ? `${Math.round(it.confidence * 100)}%` : "לא זוהה"}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <button className={a.btn} onClick={approveAll} disabled={busy} type="button">
        {busy ? "מעבד…" : `אישור ${items.length} ציורים`}
      </button>

      {editing && (
        <ManualCrop
          item={editing}
          initial={rects[editing.imageId] ?? null}
          onCancel={() => setEditing(null)}
          onSave={(rect) => {
            setRects((x) => ({ ...x, [editing.imageId]: rect }));
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

/** Rect drawn as percentages of the original, so it scales with any thumbnail. */
function pct(r: CropRect, it: CropItem): React.CSSProperties {
  return {
    insetInlineStart: `${(r.x / it.fullWidth) * 100}%`,
    top: `${(r.y / it.fullHeight) * 100}%`,
    width: `${(r.width / it.fullWidth) * 100}%`,
    height: `${(r.height / it.fullHeight) * 100}%`,
  };
}

/**
 * Correction for the ones the detector got wrong.
 *
 * Same interaction as the add flow: the whole photo is visible and the crop is
 * a draggable, resizable rectangle. Number fields were precise but nobody wants
 * to type four coordinates to nudge a box.
 */
function ManualCrop({
  item,
  initial,
  onCancel,
  onSave,
}: {
  item: CropItem;
  initial: CropRect | null;
  onCancel: () => void;
  onSave: (r: CropRect | null) => void;
}) {
  // Held in percent, not display pixels: percentages survive the image being
  // laid out at whatever size the modal gives it, so converting back to the
  // original's coordinates never depends on the rendered size.
  const [crop, setCrop] = useState<Crop>(
    initial
      ? {
          unit: "%",
          x: (initial.x / item.fullWidth) * 100,
          y: (initial.y / item.fullHeight) * 100,
          width: (initial.width / item.fullWidth) * 100,
          height: (initial.height / item.fullHeight) * 100,
        }
      : { unit: "%", x: 10, y: 10, width: 80, height: 80 },
  );

  const rect: CropRect = {
    x: Math.round((crop.x / 100) * item.fullWidth),
    y: Math.round((crop.y / 100) * item.fullHeight),
    width: Math.round((crop.width / 100) * item.fullWidth),
    height: Math.round((crop.height / 100) * item.fullHeight),
  };

  return (
    <div className={s.modal} role="dialog" aria-modal="true">
      <div className={s.modalInner}>
        <p className={s.modalTitle} dir="auto">
          {item.title}
        </p>

        <div className={s.modalStage}>
          <ReactCrop
            crop={crop}
            onChange={(_px, pct) => setCrop(pct)}
            keepSelection
            minWidth={20}
            minHeight={20}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.src} alt="" className={s.modalPhoto} />
          </ReactCrop>
        </div>

        <p className={s.readout}>
          {rect.width} × {rect.height} פיקסלים
        </p>

        <div className={s.modalActions}>
          <button
            className={a.btn}
            type="button"
            onClick={() => onSave(rect.width > 0 && rect.height > 0 ? rect : null)}
          >
            שמירה
          </button>
          <button className={`${a.btn} ${a.btnQuiet}`} type="button" onClick={() => onSave(null)}>
            ללא חיתוך
          </button>
          <button className={`${a.btn} ${a.btnQuiet}`} type="button" onClick={onCancel}>
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
