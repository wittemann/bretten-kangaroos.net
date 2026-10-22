import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

// Content lives in /content (not src/content) so Pages CMS can edit it.
// Each collection mirrors an entry in .pages.yml — keep the fields in sync.

// News collection schema (.pages.yml: news)
const newsCollection = defineCollection({
  loader: glob({ pattern: "*.md", base: "content/news" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    team: z.enum(["Herren", "Jugend", "Softball", "Verein"]).optional(),
    image: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

// Single pages: top-level Markdown files in /content (.pages.yml: test)
const pagesCollection = defineCollection({
  loader: glob({ pattern: "*.md", base: "content" }),
  schema: z.object({
    title: z.string(),
    meta_title: z.string().optional(),
    description: z.string().optional(),
    image: z.string().optional(),
    draft: z.boolean().optional(),
  }),
});

// Export collections
export const collections = {
  news: newsCollection,
  pages: pagesCollection,
};
