import type { Metadata } from "next";
import { connection } from "next/server";
import BarBrowser from "@/components/bar/bar-browser";
import { getPublicBarCatalog } from "@/lib/bar/queries.server";
import "@/components/bar/bar.css";

export const metadata: Metadata = { title: "BAR", description: "选择手边材料，查找酒谱、用量与制作步骤。", alternates: { canonical: "/bar" } };
export default async function BarPage() {
  await connection();
  return <BarBrowser catalog={await getPublicBarCatalog()} />;
}
