"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import a from "@/app/admin/admin.module.css";
import s from "./login.module.css";

/**
 * One field, no username — the password determines the role (PLAN.md §3).
 * One field is one less thing to confuse her.
 */
export default function LoginPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /*
   * Until React has hydrated, this form is just HTML: tapping the button does a
   * native GET to /login?, the page reloads, and the password is lost — which
   * looks exactly like the login silently refusing to work. On a phone loading
   * a dev bundle over WiFi that window is seconds long, and it is the failure
   * actually observed in the server log.
   *
   * The button is therefore inert until the handler is genuinely attached.
   */
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Next tick, not synchronously in the effect body: the point is only to
    // observe that hydration has happened, and this keeps the set out of the
    // effect's synchronous path.
    const id = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(id);
  }, []);

  async function submit(e?: React.FormEvent | React.KeyboardEvent) {
    e?.preventDefault();

    // Read from the DOM, not from React state: iOS password autofill sets the
    // input's value WITHOUT firing a change event, so state-based validation
    // would see an empty field and refuse a perfectly good password. For the
    // same reason the button below is disabled only while busy — never on
    // "looks empty to React".
    const password = inputRef.current?.value ?? "";
    if (!password) {
      setError("צריך סיסמה.");
      inputRef.current?.focus();
      return;
    }

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
      // The login succeeded, but that only means the server SENT a cookie.
      // Confirm the browser actually stored and returned it before navigating:
      // otherwise middleware bounces the next request back here and the whole
      // thing looks like the button doing nothing.
      const check = await fetch("/api/auth/session", { cache: "no-store" });
      const who = (await check.json().catch(() => ({ role: null }))) as {
        role: string | null;
      };
      if (!who.role) {
        setError("הדפדפן לא שמר את העוגייה. בדקו שחסימת עוגיות אינה פעילה ונסו שוב.");
        setBusy(false);
        return;
      }

      const requested = new URLSearchParams(window.location.search).get("next");
      const target = requested?.startsWith("/") ? requested : (data.next ?? "/admin/add");

      // A full page load, not router.push(). The destination is behind
      // middleware that reads the session cookie, and a client-side navigation
      // can issue its RSC request before Safari has committed the Set-Cookie
      // from this response — middleware then sees no session and bounces
      // straight back here, which looks like the login silently doing nothing.
      window.location.assign(target);
    } catch {
      setError("אין חיבור. נסו שוב.");
      setBusy(false);
    }
  }

  return (
    <main className={a.shell}>
      <h1 className={a.h1}>כניסה</h1>
      <p className={a.lede}>הזינו את הסיסמה כדי להוסיף ציורים.</p>

      <form
        onSubmit={submit}
        /* Belt to the braces above: even if a native submit slips through, it
           must never put the password in a URL. */
        method="post"
        action="/login"
      >
        {error && <div className={`${a.note} ${a.error}`}>{error}</div>}
        <div className={a.field}>
          <label className={a.label} htmlFor="pw">
            סיסמה
          </label>
          <input
            ref={inputRef}
            id="pw"
            className={a.input}
            type="password"
            autoComplete="current-password"
            autoFocus
            dir="ltr"
            style={{ textAlign: "start" }}
            // Without this the iOS keyboard shows a plain "return" that does not
            // submit; this makes it a Go key.
            enterKeyHint="go"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (ready && !busy) void submit(e);
              }
            }}
          />
        </div>
        <button className={a.btn} type="submit" disabled={busy || !ready}>
          {busy ? "רגע…" : ready ? "כניסה" : "טוען…"}
        </button>
      </form>

      <div className={s.back}>
        <Link className={s.backLink} href="/">
          → חזרה לגלריה
        </Link>
      </div>
    </main>
  );
}
