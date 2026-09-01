"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import a from "../admin.module.css";
import s from "./add.module.css";

/**
 * "Add a painting" — the core product (PLAN.md §1).
 *
 * Four screens, one job each. Two things matter more than anything else here:
 * she must never lose typed text, and saving must feel instant.
 *
 * - Autosave to localStorage on every keystroke, restored on reload.
 * - The upload starts the moment she confirms the crop and runs in the
 *   background while she types, so "save" is usually already done.
 */

const DRAFT_KEY = "savta:add-draft:v1";
const MAX_EDGE = 3000;

type Step = "photo" | "crop" | "details" | "done";

type Draft = {
  title: string;
  year: string;
  medium: string;
  widthCm: string;
  heightCm: string;
  story: string;
  tags: string[];
};

const EMPTY: Draft = { title: "", year: "", medium: "", widthCm: "", heightCm: "", story: "", tags: [] };

const MEDIA = ["שמן על בד", "שמן על לוח", "אקוורל", "רישום"];

export function AddFlow({ knownTags, canCreateTags }: { knownTags: string[]; canCreateTags: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("photo");
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [restored, setRestored] = useState(false);

  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const fileRef = useRef<File | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);

  const [imageId, setImageId] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploadState, setUploadState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTag, setNewTag] = useState("");

  /* ---------- autosave: she must never lose typed text (§9) ---------- */
  // Reading localStorage must happen after mount, not in a lazy useState
  // initializer: this component server-renders too, and seeding state from
  // storage during render would hydration-mismatch. Restoring on the next tick
  // keeps the set out of the effect's synchronous path.
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Draft;
        if (parsed.title || parsed.story) {
          setDraft({ ...EMPTY, ...parsed });
          setRestored(true);
        }
      } catch {
        /* private mode / cleared storage — start fresh, never crash */
      }
    }, 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (draft === EMPTY) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* storage full or blocked; typing must still work */
    }
  }, [draft]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  /* ---------- photo ---------- */
  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);

    let file = f;
    // HEIC cannot be decoded by sharp, so it is converted here, in the browser,
    // before anything is uploaded (§3, §4).
    if (/\.hei[cf]$/i.test(f.name) || f.type === "image/heic" || f.type === "image/heif") {
      try {
        const { default: heic2any } = await import("heic2any");
        const out = (await heic2any({ blob: f, toType: "image/jpeg", quality: 0.92 })) as Blob;
        file = new File([out], f.name.replace(/\.hei[cf]$/i, ".jpg"), { type: "image/jpeg" });
      } catch {
        setError("לא הצלחנו לפתוח את התמונה הזו. נסו לצלם שוב.");
        return;
      }
    }

    fileRef.current = file;
    setFileUrl(URL.createObjectURL(file));
    setStep("crop");
  }

  /* ---------- crop → background upload ---------- */
  const onCropComplete = useCallback((_: Area, px: Area) => setAreaPixels(px), []);

  async function confirmCrop() {
    if (!fileRef.current || !areaPixels) return;
    setStep("details");

    // Fire and forget: she types while this runs, so saving feels instant.
    void uploadCropped(fileRef.current, areaPixels);
  }

  async function uploadCropped(file: File, area: Area) {
    setUploadState("busy");
    setProgress(0);
    try {
      const blob = await renderCrop(file, area);
      const form = new FormData();
      form.append("file", blob, "painting.jpg");

      // XHR rather than fetch: only XHR reports upload progress, and a real
      // progress bar is the difference between "working" and "broken" on a
      // slow phone connection.
      const id = await new Promise<number>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/upload");
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve((JSON.parse(xhr.responseText) as { imageId: number }).imageId);
          } else reject(new Error(xhr.responseText || "upload failed"));
        };
        xhr.onerror = () => reject(new Error("network"));
        xhr.send(form);
      });

      setImageId(id);
      setUploadState("done");
    } catch {
      setUploadState("error");
    }
  }

  /* ---------- save ---------- */
  async function save() {
    if (!draft.title.trim()) {
      setError("צריך שם לציור.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/paintings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          year: draft.year ? Number(draft.year) : null,
          medium: draft.medium || null,
          widthCm: draft.widthCm ? Number(draft.widthCm) : null,
          heightCm: draft.heightCm ? Number(draft.heightCm) : null,
          story: draft.story || null,
          tags: draft.tags,
          imageIds: imageId ? [imageId] : [],
        }),
      });
      if (!res.ok) throw new Error();

      // Only clear the saved draft once the server has it.
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
      setStep("done");
      router.refresh();
    } catch {
      setError("השמירה לא עברה. הטקסט נשמר במכשיר — נסו שוב.");
    } finally {
      setSaving(false);
    }
  }

  function startAnother() {
    setDraft(EMPTY);
    setFileUrl(null);
    fileRef.current = null;
    setImageId(null);
    setUploadState("idle");
    setProgress(0);
    setStep("photo");
  }

  const stepIndex = { photo: 0, crop: 1, details: 2, done: 3 }[step];

  return (
    <div>
      <div className={a.steps} aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className={`${a.step} ${i <= stepIndex ? a.stepOn : ""}`} />
        ))}
      </div>

      {error && <div className={`${a.note} ${a.error}`}>{error}</div>}

      {step === "photo" && (
        <>
          <h1 className={a.h1}>הוספת ציור</h1>
          <p className={a.lede}>נתחיל בתמונה של הציור.</p>
          {restored && (
            <div className={a.note}>
              יש טיוטה שמורה מפעם קודמת — הטקסט שכתבת מחכה לך במסך הבא.
            </div>
          )}
          <label className={s.picker}>
            <input type="file" accept="image/*" onChange={onPick} hidden />
            <span className={s.pickerIcon}>+</span>
            <span>בחרי תמונה</span>
          </label>
        </>
      )}

      {step === "crop" && fileUrl && (
        <>
          <h1 className={a.h1}>חיתוך</h1>
          <p className={a.lede}>גררי את הפינות כדי להשאיר רק את הציור.</p>
          <div className={s.cropStage}>
            <Cropper
              image={fileUrl}
              crop={crop}
              zoom={zoom}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              objectFit="contain"
              restrictPosition={false}
              /* Paintings are never uniform, so the crop is free-form (§2). */
              aspect={undefined}
            />
          </div>
          <button className={a.btn} onClick={confirmCrop} type="button">
            המשך
          </button>
          <button
            className={`${a.btn} ${a.btnQuiet}`}
            style={{ marginTop: 10 }}
            onClick={() => setStep("photo")}
            type="button"
          >
            בחירת תמונה אחרת
          </button>
        </>
      )}

      {step === "details" && (
        <>
          <h1 className={a.h1}>פרטי הציור</h1>

          {fileUrl && (
            <div className={a.preview}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fileUrl} alt="" style={{ display: "block", width: "100%" }} />
            </div>
          )}

          <div className={s.uploadState}>
            {uploadState === "busy" && (
              <>
                <span>מעלה את התמונה… {progress}%</span>
                <div className={a.progress}>
                  <div className={a.progressBar} style={{ width: `${progress}%` }} />
                </div>
              </>
            )}
            {uploadState === "done" && <span>התמונה נשמרה ✓</span>}
            {uploadState === "error" && (
              <span>
                התמונה לא עלתה.{" "}
                <button
                  type="button"
                  className={s.retry}
                  onClick={() => {
                    if (fileRef.current && areaPixels) void uploadCropped(fileRef.current, areaPixels);
                  }}
                >
                  נסי שוב
                </button>
              </span>
            )}
          </div>

          <div className={a.field}>
            <label className={a.label} htmlFor="title">
              שם הציור
            </label>
            <input
              id="title"
              className={a.input}
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
              dir="auto"
            />
          </div>

          <div className={a.field}>
            <label className={a.label}>שנה ומידות</label>
            <div className={a.row}>
              <input
                className={a.input}
                inputMode="numeric"
                placeholder="שנה"
                value={draft.year}
                onChange={(e) => set("year", e.target.value)}
              />
              <input
                className={a.input}
                inputMode="decimal"
                placeholder="רוחב ס״מ"
                value={draft.widthCm}
                onChange={(e) => set("widthCm", e.target.value)}
              />
              <input
                className={a.input}
                inputMode="decimal"
                placeholder="גובה ס״מ"
                value={draft.heightCm}
                onChange={(e) => set("heightCm", e.target.value)}
              />
            </div>
          </div>

          <div className={a.field}>
            <label className={a.label}>טכניקה</label>
            <div className={a.chips}>
              {MEDIA.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`${a.chip} ${draft.medium === m ? a.chipOn : ""}`}
                  onClick={() => set("medium", draft.medium === m ? "" : m)}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className={a.field}>
            <label className={a.label} htmlFor="story">
              ספרי על הציור הזה
            </label>
            <textarea
              id="story"
              className={a.textarea}
              value={draft.story}
              onChange={(e) => set("story", e.target.value)}
              dir="auto"
            />
            <div className={a.hint}>מה שנכתב כאן נשמר במכשיר תוך כדי הכתיבה.</div>
          </div>

          <div className={a.field}>
            <label className={a.label}>תגיות</label>
            <div className={a.chips}>
              {Array.from(new Set([...knownTags, ...draft.tags])).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`${a.chip} ${draft.tags.includes(t) ? a.chipOn : ""}`}
                  onClick={() =>
                    set(
                      "tags",
                      draft.tags.includes(t) ? draft.tags.filter((x) => x !== t) : [...draft.tags, t],
                    )
                  }
                >
                  {t}
                </button>
              ))}
            </div>
            {canCreateTags && (
              <div className={a.row} style={{ marginTop: 12 }}>
                <input
                  className={a.input}
                  placeholder="תגית חדשה"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  dir="auto"
                />
                <button
                  type="button"
                  className={`${a.btn} ${a.btnQuiet}`}
                  style={{ flex: "0 0 auto", width: "auto", padding: "0 20px" }}
                  onClick={() => {
                    const t = newTag.trim();
                    if (t && !draft.tags.includes(t)) set("tags", [...draft.tags, t]);
                    setNewTag("");
                  }}
                >
                  הוספה
                </button>
              </div>
            )}
          </div>

          <button className={a.btn} onClick={save} disabled={saving} type="button">
            {saving ? "שומר…" : "שמירה"}
          </button>
        </>
      )}

      {step === "done" && (
        <>
          <h1 className={a.h1}>נשמר</h1>
          <p className={a.lede}>הציור נשמר. עומר יעלה אותו לאתר.</p>
          <button className={a.btn} onClick={startAnother} type="button">
            הוספת ציור נוסף
          </button>
        </>
      )}
    </div>
  );
}

/**
 * Applies the crop and downscales to MAX_EDGE before upload, so a 40MB photo
 * becomes a couple of MB on a phone connection (§4).
 */
async function renderCrop(file: File, area: Area): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  let w = Math.round(area.width);
  let h = Math.round(area.height);
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  w = Math.round(w * scale);
  h = Math.round(h * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");

  ctx.drawImage(bitmap, area.x, area.y, area.width, area.height, 0, 0, w, h);
  bitmap.close?.();

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/jpeg", 0.9),
  );
}
