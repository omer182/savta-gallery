"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import a from "../admin.module.css";

export function AboutEditor({ title, body }: { title: string; body: string }) {
  const router = useRouter();
  const [t, setT] = useState(title);
  const [b, setB] = useState(body);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/pages/about", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: t, body: b }),
    });
    setBusy(false);
    setMsg(res.ok ? "נשמר." : "השמירה נכשלה.");
    router.refresh();
  }

  return (
    <>
      {msg && <div className={a.note}>{msg}</div>}
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
      <button className={a.btn} onClick={save} disabled={busy} type="button">
        {busy ? "שומר…" : "שמירה"}
      </button>
    </>
  );
}
