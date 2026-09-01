"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import a from "@/app/admin/admin.module.css";

/**
 * One field, no username — the password determines the role (PLAN.md §3).
 * One field is one less thing to confuse her.
 */
export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { next?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "משהו השתבש.");
        setBusy(false);
        return;
      }
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next && next.startsWith("/") ? next : (data.next ?? "/admin/add"));
      router.refresh();
    } catch {
      setError("אין חיבור. נסו שוב.");
      setBusy(false);
    }
  }

  return (
    <main className={a.shell}>
      <h1 className={a.h1}>כניסה</h1>
      <p className={a.lede}>הזינו את הסיסמה כדי להוסיף ציורים.</p>

      <form onSubmit={submit}>
        {error && <div className={`${a.note} ${a.error}`}>{error}</div>}
        <div className={a.field}>
          <label className={a.label} htmlFor="pw">
            סיסמה
          </label>
          <input
            id="pw"
            className={a.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
            dir="ltr"
            style={{ textAlign: "start" }}
          />
        </div>
        <button className={a.btn} type="submit" disabled={busy || !password}>
          {busy ? "רגע…" : "כניסה"}
        </button>
      </form>
    </main>
  );
}
