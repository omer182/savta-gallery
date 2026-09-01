"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import a from "../../admin.module.css";

type P = {
  id: number;
  title: string;
  year: number | null;
  medium: string | null;
  widthCm: number | null;
  heightCm: number | null;
  story: string | null;
};

/**
 * One painting: her recording, the Whisper transcript to correct, and the
 * metadata to confirm.
 *
 * The transcript is hers. Fix Whisper's errors and cut false starts — do not
 * smooth her phrasing, which is the whole premise of the site (PLAN.md §11).
 */
export function StoryReview({
  painting,
  imageSrc,
  audioSrc,
  skip,
}: {
  painting: P;
  imageSrc: string | null;
  audioSrc: string | null;
  skip: number[];
}) {
  const router = useRouter();
  const [f, setF] = useState({
    title: painting.title,
    year: painting.year?.toString() ?? "",
    medium: painting.medium ?? "",
    widthCm: painting.widthCm?.toString() ?? "",
    heightCm: painting.heightCm?.toString() ?? "",
    story: painting.story ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = <K extends keyof typeof f>(k: K, v: string) => setF((x) => ({ ...x, [k]: v }));

  async function next(markDone: boolean) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/import/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: painting.id,
          title: f.title,
          year: f.year ? Number(f.year) : null,
          medium: f.medium || null,
          widthCm: f.widthCm ? Number(f.widthCm) : null,
          heightCm: f.heightCm ? Number(f.heightCm) : null,
          story: f.story || null,
          done: markDone,
        }),
      });
      if (!res.ok) throw new Error();

      // Deferred paintings stay pending, so carry them in the URL or the queue
      // would serve the same one again.
      const nextSkip = markDone ? skip : [...skip, painting.id];
      router.replace(nextSkip.length ? `/admin/import/stories?skip=${nextSkip.join(",")}` : "/admin/import/stories");
      router.refresh();
    } catch {
      setErr("השמירה נכשלה. הטקסט עדיין כאן — נסו שוב.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {err && <div className={`${a.note} ${a.error}`}>{err}</div>}

      {imageSrc && (
        <div className={a.preview}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageSrc} alt="" style={{ display: "block", width: "100%" }} />
        </div>
      )}

      {audioSrc ? (
        <div className={a.field}>
          <label className={a.label}>ההקלטה שלה</label>
          <audio controls src={audioSrc} style={{ width: "100%" }} />
        </div>
      ) : (
        <div className={a.note}>אין הקלטה לציור הזה.</div>
      )}

      <div className={a.field}>
        <label className={a.label}>שם הציור</label>
        <input className={a.input} value={f.title} onChange={(e) => set("title", e.target.value)} dir="auto" />
      </div>

      <div className={a.field}>
        <label className={a.label}>שנה ומידות</label>
        <div className={a.row}>
          <input className={a.input} inputMode="numeric" placeholder="שנה" value={f.year} onChange={(e) => set("year", e.target.value)} />
          <input className={a.input} inputMode="decimal" placeholder="רוחב" value={f.widthCm} onChange={(e) => set("widthCm", e.target.value)} />
          <input className={a.input} inputMode="decimal" placeholder="גובה" value={f.heightCm} onChange={(e) => set("heightCm", e.target.value)} />
        </div>
      </div>

      <div className={a.field}>
        <label className={a.label}>הסיפור</label>
        <textarea
          className={a.textarea}
          style={{ minHeight: 300 }}
          value={f.story}
          onChange={(e) => set("story", e.target.value)}
          dir="auto"
        />
        <div className={a.hint}>
          תקנו שגיאות תמלול וחתכו התחלות שווא — אבל השאירו את הניסוח שלה.
        </div>
      </div>

      <button className={a.btn} onClick={() => next(true)} disabled={busy} type="button">
        {busy ? "שומר…" : "שמירה והבא"}
      </button>
      <button
        className={`${a.btn} ${a.btnQuiet}`}
        style={{ marginTop: 10 }}
        onClick={() => next(false)}
        disabled={busy}
        type="button"
      >
        שמירה, נחזור לזה אחר כך
      </button>
    </>
  );
}
