"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import a from "../admin.module.css";
import s from "./about.module.css";

const MAX_EDGE = 2000;

export function AboutEditor({
  title,
  body,
  portraitSrc,
}: {
  title: string;
  body: string;
  portraitSrc: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [t, setT] = useState(title);
  const [b, setB] = useState(body);
  const [preview, setPreview] = useState<string | null>(portraitSrc);
  const [portraitId, setPortraitId] = useState<number | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function pickPortrait(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // so re-picking the same file fires change again
    if (!file) return;

    setUploading(true);
    setMsg(null);
    try {
      const blob = await downscale(file);
      const form = new FormData();
      form.append("file", blob, "portrait.jpg");
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error();
      const { imageId } = (await res.json()) as { imageId: number };

      setPortraitId(imageId);
      setPreview(URL.createObjectURL(blob));
      setMsg("התמונה הועלתה. לחצו שמירה כדי לשמור אותה.");
    } catch {
      setMsg("העלאת התמונה נכשלה.");
    } finally {
      setUploading(false);
    }
  }

  function removePortrait() {
    setPortraitId(null);
    setPreview(null);
    setMsg("הדיוקן יוסר בשמירה.");
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/pages/about", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t,
          body: b,
          // Omitted entirely unless it changed, so saving text alone never
          // disturbs the portrait.
          ...(portraitId === undefined ? {} : { portraitImageId: portraitId }),
        }),
      });
      setMsg(res.ok ? "נשמר." : "השמירה נכשלה.");
      if (res.ok) setPortraitId(undefined);
      router.refresh();
    } catch {
      setMsg("השמירה נכשלה.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {msg && <div className={a.note}>{msg}</div>}

      <div className={a.field}>
        <label className={a.label}>הדיוקן שלה</label>
        <div className={s.portraitRow}>
          <div className={s.portraitFrame}>
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className={s.portraitImg} />
            ) : (
              <div className={s.portraitEmpty}>
                <span className={s.portraitMark}>ב</span>
              </div>
            )}
          </div>
          <div className={s.portraitActions}>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={pickPortrait}
              hidden
              id="portrait-input"
            />
            <button
              type="button"
              className={s.portraitBtn}
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? "מעלה…" : preview ? "החלפת תמונה" : "בחירת תמונה"}
            </button>
            {preview && (
              <button type="button" className={s.portraitBtn} onClick={removePortrait}>
                הסרה
              </button>
            )}
            <p className={a.hint}>תמונה לרוחב או לאורך — היא תוצג במסגרת לבנה לצד הטקסט.</p>
          </div>
        </div>
      </div>

      <div className={a.field}>
        <label className={a.label}>כותרת</label>
        <input className={a.input} value={t} onChange={(e) => setT(e.target.value)} dir="auto" />
      </div>

      <div className={a.field}>
        <label className={a.label}>תוכן</label>
        <textarea
          className={a.textarea}
          style={{ minHeight: 340 }}
          value={b}
          onChange={(e) => setB(e.target.value)}
          dir="auto"
        />
      </div>

      <button className={a.btn} onClick={save} disabled={busy || uploading} type="button">
        {busy ? "שומר…" : "שמירה"}
      </button>
    </>
  );
}

/**
 * Downscales before upload for the same reason the add flow does: a 40MB photo
 * off a phone becomes a couple of MB. No crop step — a portrait is usually
 * already framed, and the admin can re-pick if not.
 */
async function downscale(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  return new Promise((resolve, reject) =>
    canvas.toBlob((x) => (x ? resolve(x) : reject(new Error("toBlob failed"))), "image/jpeg", 0.9),
  );
}
