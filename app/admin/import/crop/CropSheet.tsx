"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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

/** Full-screen correction for the ones the detector got wrong. */
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
  const [box, setBox] = useState<CropRect>(
    initial ?? {
      x: Math.round(item.fullWidth * 0.1),
      y: Math.round(item.fullHeight * 0.1),
      width: Math.round(item.fullWidth * 0.8),
      height: Math.round(item.fullHeight * 0.8),
    },
  );

  const clamp = (b: CropRect): CropRect => ({
    x: Math.max(0, Math.min(b.x, item.fullWidth - 1)),
    y: Math.max(0, Math.min(b.y, item.fullHeight - 1)),
    width: Math.max(1, Math.min(b.width, item.fullWidth - b.x)),
    height: Math.max(1, Math.min(b.height, item.fullHeight - b.y)),
  });

  return (
    <div className={s.modal} role="dialog" aria-modal="true">
      <div className={s.modalInner}>
        <p className={s.modalTitle} dir="auto">
          {item.title}
        </p>

        <div className={s.modalStage}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.src} alt="" className={s.modalPhoto} />
          <span className={s.rect} style={pct(box, item)} />
        </div>

        <div className={s.numbers}>
          {(
            [
              ["x", "מימין"],
              ["y", "מלמעלה"],
              ["width", "רוחב"],
              ["height", "גובה"],
            ] as const
          ).map(([k, label]) => (
            <label key={k}>
              <span>{label}</span>
              <input
                className={a.input}
                type="number"
                value={Math.round(box[k])}
                onChange={(e) => setBox(clamp({ ...box, [k]: Number(e.target.value) }))}
              />
            </label>
          ))}
        </div>

        <div className={s.modalActions}>
          <button className={a.btn} type="button" onClick={() => onSave(box)}>
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
