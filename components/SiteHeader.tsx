import Link from "next/link";
import { getSession } from "@/lib/auth";
import s from "./gallery.module.css";

export const ARTIST_NAME = "בלומה שוורצברג קמין";

/**
 * Nav is `גלריה · אודות · חיפוש` for visitors. A logged-in artist gains one
 * extra item and nothing else — there is no admin dashboard for her (PLAN.md §1).
 */
export async function SiteHeader({ current, count }: { current?: string; count?: number }) {
  const session = await getSession();

  const items: Array<{ href: string; label: string; key: string }> = [
    { href: "/", label: "גלריה", key: "gallery" },
    { href: "/about", label: "אודות", key: "about" },
    { href: "/search", label: "חיפוש", key: "search" },
  ];

  return (
    <>
      <header className={`${s.head} ${s.wrap}`}>
        <div className={s.headRow}>
          <Link className={s.marque} href="/">
            <h1>{ARTIST_NAME}</h1>
            {count !== undefined && (
              <div className={s.sub}>{count} ציורים · 1974–2026</div>
            )}
          </Link>
          <nav className={s.nav}>
            {items.map((i) => (
              <Link
                key={i.key}
                href={i.href}
                className={`${s.navlink} ${current === i.key ? s.navOn : ""}`}
                aria-current={current === i.key ? "page" : undefined}
              >
                {i.label}
              </Link>
            ))}
            {session && (
              <Link href="/admin/add" className={`${s.navlink} ${s.navAdd}`}>
                הוספת ציור
              </Link>
            )}
            {session?.role === "admin" && (
              <Link href="/admin" className={s.navlink}>
                ניהול
              </Link>
            )}
          </nav>
        </div>
      </header>
      <div className={s.rule} />
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className={s.footer}>
      © {new Date().getFullYear()} {ARTIST_NAME} · כל הציורים נותרים ברשות האמנית
    </footer>
  );
}
