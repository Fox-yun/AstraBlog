import { requireOwner } from "@/lib/authorization";
import Link from "next/link";
import "@/components/bar/bar.css";
export const metadata = { title: "Studio · 酒谱", robots: { index: false, follow: false } };
export default async function BarStudioLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  return <div className="bar-surface bar-stack"><nav className="bar-row" aria-label="酒单管理"><Link href="/studio/bar">酒谱</Link><Link href="/studio/bar/ingredients">材料字典</Link><Link href="/studio/bar/categories">类型标签</Link><Link href="/bar">查看公开酒单</Link></nav>{children}</div>;
}
