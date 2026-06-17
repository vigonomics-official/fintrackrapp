import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://fintrackrapp.lovable.app";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/login", changefreq: "monthly", priority: "0.5" },
          { path: "/signup", changefreq: "monthly", priority: "0.6" },
          { path: "/forgot-password", changefreq: "yearly", priority: "0.3" },
          { path: "/reset-password", changefreq: "yearly", priority: "0.2" },
          { path: "/onboarding", changefreq: "monthly", priority: "0.4" },
          { path: "/dashboard", changefreq: "weekly", priority: "0.7" },
          { path: "/budgets", changefreq: "monthly", priority: "0.6" },
          { path: "/categories", changefreq: "monthly", priority: "0.5" },
          { path: "/goals", changefreq: "monthly", priority: "0.6" },
          { path: "/import", changefreq: "monthly", priority: "0.4" },
          { path: "/insights", changefreq: "weekly", priority: "0.6" },
          { path: "/investments", changefreq: "monthly", priority: "0.6" },
          { path: "/loans", changefreq: "monthly", priority: "0.5" },
        ];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
