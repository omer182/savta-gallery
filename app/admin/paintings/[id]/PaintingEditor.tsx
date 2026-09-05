"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import a from "../../admin.module.css";
import s from "./editor.module.css";

type Status = "draft" | "published" | "hidden";

type P = {
  id: number;
  title: string;
  year: number | null;
  medium: string | null;
  widthCm: number | null;
  heightCm: number | null;
  story: string | null;
  status: Status;
  provenance: "artist" | "sold" | "gifted" | "unknown";
};

const PROVENANCE = [
  ["artist", "אצל האמנית"],
  ["sold", "נמכר"],
  ["gifted", "ניתן במתנה"],
  ["unknown", "לא ידוע"],
] as const;

/** The three real states, chosen directly rather than inferred from buttons. */
const STATUSES: Array<{ value: Status; label: string; hint: string }> = [
  { value: "draft", label: "טיוטה", hint: "נשמר, לא מופיע באתר" },
  { value: "published", label: "מפורסם", hint: "גלוי לכולם באתר" },
  { value: "hidden", label: "מוסתר", hint: "הוסר מהאתר, נשמר כאן" },
];

export function PaintingEditor({
  painting,
  tagNames,
  allTags,
  allMedia,
}: {
  painting: P;
  tagNames: string[];
  allTags: string[];
  allMedia: string[];
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
  const [status, setStatus] = useState<Status>(painting.status);
  const [tagPool, setTagPool] = useState(allTags);
  const [mediaPool, setMediaPool] = useState(allMedia);
  const [newTag, setNewTag] = useState("");
  const [newMedium, setNewMedium] = useState("");
  const [showMediumInput, setShowMediumInput] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  /**
   * Unlike technique, the input stays open after adding: a painting takes
   * several tags, so she can type them one after another without reopening.
   */
  async function addTag() {
    const name = newTag.trim();
    if (!name) return;
    setNewTag("");
    if (!f.tags.includes(name)) set("tags", [...f.tags, name]);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setTagPool(((await res.json()) as { tags: string[] }).tags);
        return;
      }
    } catch {
      /* offline — keep it locally so the edit is not lost */
    }
    setTagPool((p) => (p.includes(name) ? p : [...p, name]));
  }

  function addMedium() {
    const name = newMedium.trim();
    if (!name) return;
    setMediaPool((p) => (p.includes(name) ? p : [...p, name]));
    set("medium", name);
    setNewMedium("");
    setShowMediumInput(false);
  }

  /** One save: fields and status go together, so there is no half-applied edit. */
  async function save() {
    setBusy(true);
    setMsg(null);
    try {
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
          status,
        }),
      });
      setMsg(res.ok ? "נשמר." : "השמירה נכשלה.");
      router.refresh();
    } catch {
      setMsg("השמירה נכשלה.");
    } finally {
      setBusy(false);
    }
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
        <input
          className={a.input}
          value={f.title}
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
            value={f.year}
            onChange={(e) => set("year", e.target.value)}
          />
          <input
            className={a.input}
            inputMode="decimal"
            placeholder="רוחב"
            value={f.widthCm}
            onChange={(e) => set("widthCm", e.target.value)}
          />
          <input
            className={a.input}
            inputMode="decimal"
            placeholder="גובה"
            value={f.heightCm}
            onChange={(e) => set("heightCm", e.target.value)}
          />
        </div>
      </div>

      <div className={a.field}>
        <label className={a.label}>טכניקה</label>
        <div className={a.chips}>
          {mediaPool.map((m) => (
            <button
              key={m}
              type="button"
              className={`${a.chip} ${f.medium === m ? a.chipOn : ""}`}
              onClick={() => set("medium", f.medium === m ? "" : m)}
            >
              {m}
            </button>
          ))}
          <button type="button" className={a.chip} onClick={() => setShowMediumInput((v) => !v)}>
            + טכניקה אחרת
          </button>
        </div>
        {showMediumInput && (
          <div className={a.row} style={{ marginTop: 12 }}>
            <input
              className={a.input}
              placeholder="טכניקה חדשה"
              value={newMedium}
              onChange={(e) => setNewMedium(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addMedium();
                }
              }}
              dir="auto"
            />
            <button type="button" className={s.inlineBtn} onClick={addMedium}>
              הוספה
            </button>
          </div>
        )}
      </div>

      <div className={a.field}>
        <label className={a.label}>הסיפור</label>
        <textarea
          className={a.textarea}
          value={f.story}
          onChange={(e) => set("story", e.target.value)}
          dir="auto"
        />
      </div>

      <div className={a.field}>
        <label className={a.label}>תגיות</label>
        <div className={a.chips}>
          {Array.from(new Set([...tagPool, ...f.tags])).map((t) => (
            <button
              key={t}
              type="button"
              className={`${a.chip} ${f.tags.includes(t) ? a.chipOn : ""}`}
              onClick={() =>
                set("tags", f.tags.includes(t) ? f.tags.filter((x) => x !== t) : [...f.tags, t])
              }
            >
              {t}
            </button>
          ))}
          <button type="button" className={a.chip} onClick={() => setShowTagInput((v) => !v)}>
            + תגית חדשה
          </button>
        </div>
        {showTagInput && (
          <div className={a.row} style={{ marginTop: 12 }}>
            <input
              className={a.input}
              placeholder="תגית חדשה"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addTag();
                }
              }}
              dir="auto"
              autoFocus
            />
            <button type="button" className={s.inlineBtn} onClick={() => void addTag()}>
              הוספה
            </button>
          </div>
        )}
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

      <div className={a.field}>
        <label className={a.label}>מצב הציור</label>
        <div className={s.states}>
          {STATUSES.map((st) => (
            <button
              key={st.value}
              type="button"
              className={`${s.state} ${status === st.value ? s.stateOn : ""}`}
              onClick={() => setStatus(st.value)}
              aria-pressed={status === st.value}
            >
              <span className={s.stateLabel}>{st.label}</span>
              <span className={s.stateHint}>{st.hint}</span>
            </button>
          ))}
        </div>
        {status !== painting.status && (
          <div className={a.hint}>המצב ישתנה כשתשמרו.</div>
        )}
      </div>

      <button className={a.btn} onClick={save} disabled={busy} type="button">
        {busy ? "שומר…" : "שמירה"}
      </button>

      <Link className={`${a.btn} ${a.btnQuiet}`} style={{ marginTop: 10 }} href="/admin">
        → חזרה לרשימה
      </Link>

      <button
        className={`${a.btn} ${a.btnDanger}`}
        style={{ marginTop: 30 }}
        onClick={remove}
        disabled={busy}
        type="button"
      >
        מחיקה לצמיתות
      </button>
    </>
  );
}
