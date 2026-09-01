import g from "@/components/gallery.module.css";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { getPage } from "@/lib/queries";
import s from "./page.module.css";

export const revalidate = 3600;

export const metadata = { title: "אודות" };

export default async function AboutPage() {
  const page = getPage("about");
  const paragraphs = (page?.body ?? "").split(/\n{2,}/).filter((p) => p.trim());

  return (
    <>
      <SiteHeader current="about" />
      <main className={g.wrap}>
        <div className={s.prose}>
          <h2>{page?.title ?? "אודות"}</h2>
          {paragraphs.length ? (
            paragraphs.map((p, i) => (
              <p key={i} dir="auto">
                {p}
              </p>
            ))
          ) : (
            <p dir="auto">עוד לא נכתב כאן דבר.</p>
          )}
          <p className={s.note}>(הדיוקן שלה ותצלומי הסטודיו יופיעו כאן.)</p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
