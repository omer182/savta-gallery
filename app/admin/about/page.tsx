import { getPage } from "@/lib/queries";
import a from "../admin.module.css";
import { AdminNav } from "../AdminNav";
import { AboutEditor } from "./AboutEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "עמוד אודות" };

export default async function AdminAbout() {
  const page = getPage("about");
  return (
    <main className={a.shell}>
      <AdminNav />
      <h1 className={a.h1}>עמוד אודות</h1>
      <p className={a.lede}>שורה ריקה בין פסקאות.</p>
      <AboutEditor title={page?.title ?? "אודות"} body={page?.body ?? ""} />
    </main>
  );
}
