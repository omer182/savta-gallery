"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CropModal, type PctRect } from "@/components/CropModal";
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
  // Percentages, not pixels: the server converts them against the original's
  // real dimensions, so nothing depends on how a browser rendered the image.
  const [rects, setRects] = useState<Record<number, PctRect | null>>(
    Object.fromEntries(items.map((i) => [i.imageId, toPct(i.rect, i)])),
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
            rectPct: rects[i.imageId] ?? null,
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
                {r && <span className={s.rect} style={pctStyle(r)} />}
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
        <CropModal
          src={editing.src}
          title={editing.title}
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

/** The detector reports pixels; everything downstream works in percentages. */
function toPct(r: CropRect | null, it: CropItem): PctRect | null {
  if (!r || !it.fullWidth || !it.fullHeight) return null;
  return {
    x: (r.x / it.fullWidth) * 100,
    y: (r.y / it.fullHeight) * 100,
    width: (r.width / it.fullWidth) * 100,
    height: (r.height / it.fullHeight) * 100,
  };
}

/** Overlay drawn straight from the percentages, so it scales with the thumb. */
function pctStyle(r: PctRect): React.CSSProperties {
  return {
    insetInlineStart: `${r.x}%`,
    top: `${r.y}%`,
    width: `${r.width}%`,
    height: `${r.height}%`,
  };
}
