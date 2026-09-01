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
  status: "draft" | "published" | "hidden";
  provenance: "artist" | "sold" | "gifted" | "unknown";
};

const PROVENANCE = [
  ["artist", "אצל האמנית"],
  ["sold", "נמכר"],
  ["gifted", "ניתן במתנה"],
  ["unknown", "לא ידוע"],
] as const;

export function PaintingEditor({
  painting,
  tagNames,
  allTags,
}: {
  painting: P;
  tagNames: string[];
  allTags: string[];
}) {
  const router = useRouter();
  const [f, setF] = useState({
    title: painting.title,
    year: painting.year?.toString() ?? "",
    medium: painting.medium ?? "",
    widthCm: painting.widthCm?.toString() ?? "",
    heightCm: painting.heightCm?.toString() ?? "",
    story: painting.story ?? "",
    provenance: painting.provenance,
    tags: tagNames,
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/paintings/${painting.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: f.title,
        year: f.year ? Number(f.year) : null,
        medium: f.medium || null,
        widthCm: f.widthCm ? Number(f.widthCm) : null,
        heightCm: f.heightCm ? Number(f.heightCm) : null,
        story: f.story || null,
        provenance: f.provenance,
        tags: f.tags,
      }),
    });
    setBusy(false);
    setMsg(res.ok ? "נשמר." : "השמירה נכשלה.");
    router.refresh();
  }

  async function changeStatus(status: P["status"]) {
    setBusy(true);
    await fetch(`/api/paintings/${painting.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(false);
    router.refresh();
  }

  async function remove() {
    if (!confirm(`למחוק את "${painting.title}" לצמיתות? אי אפשר לבטל.`)) return;
    setBusy(true);
    await fetch(`/api/paintings/${painting.id}`, { method: "DELETE" });
    router.push("/admin");
    router.refresh();
  }

  return (
    <>
      {msg && <div className={a.note}>{msg}</div>}

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
        <label className={a.label}>טכניקה</label>
        <input className={a.input} value={f.medium} onChange={(e) => set("medium", e.target.value)} dir="auto" />
      </div>

      <div className={a.field}>
        <label className={a.label}>הסיפור</label>
        <textarea className={a.textarea} value={f.story} onChange={(e) => set("story", e.target.value)} dir="auto" />
      </div>

      <div className={a.field}>
        <label className={a.label}>תגיות</label>
        <div className={a.chips}>
          {Array.from(new Set([...allTags, ...f.tags])).map((t) => (
            <button
              key={t}
              type="button"
              className={`${a.chip} ${f.tags.includes(t) ? a.chipOn : ""}`}
              onClick={() => set("tags", f.tags.includes(t) ? f.tags.filter((x) => x !== t) : [...f.tags, t])}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className={a.field}>
        {/* Private bookkeeping — never rendered publicly (§5). */}
        <label className={a.label}>איפה הציור נמצא (פרטי, לא מוצג באתר)</label>
        <div className={a.chips}>
          {PROVENANCE.map(([v, label]) => (
            <button
              key={v}
              type="button"
              className={`${a.chip} ${f.provenance === v ? a.chipOn : ""}`}
              onClick={() => set("provenance", v)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <button className={a.btn} onClick={save} disabled={busy} type="button">
        {busy ? "שומר…" : "שמירה"}
      </button>

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        {painting.status !== "published" && (
          <button className={`${a.btn} ${a.btnQuiet}`} onClick={() => changeStatus("published")} disabled={busy} type="button">
            פרסום
          </button>
        )}
        {painting.status === "published" && (
          <button className={`${a.btn} ${a.btnQuiet}`} onClick={() => changeStatus("hidden")} disabled={busy} type="button">
            הסתרה
          </button>
        )}
        {painting.status === "hidden" && (
          <button className={`${a.btn} ${a.btnQuiet}`} onClick={() => changeStatus("draft")} disabled={busy} type="button">
            החזרה לטיוטה
          </button>
        )}
      </div>

      <button className={`${a.btn} ${a.btnDanger}`} style={{ marginTop: 30 }} onClick={remove} disabled={busy} type="button">
        מחיקה לצמיתות
      </button>
    </>
  );
}
