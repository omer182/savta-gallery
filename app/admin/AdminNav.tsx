"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import a from "./admin.module.css";

export function AdminNav() {
  const router = useRouter();

  return (
    <nav className={a.adminNav}>
      <Link href="/">האתר</Link>
      <Link href="/admin">ניהול</Link>
      <Link href="/admin/add">הוספת ציור</Link>
      <Link href="/admin/import/crop">חיתוך</Link>
      <Link href="/admin/import/stories">סיפורים</Link>
      <Link href="/admin/about">עמוד אודות</Link>
      <button
        type="button"
        style={{ marginInlineStart: "auto", color: "var(--muted)" }}
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          router.push("/");
          router.refresh();
        }}
      >
        יציאה
      </button>
    </nav>
  );
}
