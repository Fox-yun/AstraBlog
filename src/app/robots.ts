import { MetadataRoute } from "next";
import { absoluteUrl } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/studio/", "/auth/", "/api/"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
