import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { teamSlugs } from "@/lib/teams";

// Content lives in /content (not src/content) so Pages CMS can edit it.
// Each collection mirrors an entry in .pages.yml — keep the fields in sync.

// Pages CMS saves an empty string when an optional field is cleared
const optionalString = z.string().optional();
const optionalEmail = z.string().email().or(z.literal("")).optional();

// Startseite (.pages.yml: home)
const homeCollection = defineCollection({
  loader: glob({ pattern: "home.md", base: "content" }),
  schema: z.object({
    title: z.string(),
    hero_title: z.string(),
    hero_text: optionalString,
    hero_image: optionalString,
  }),
});

// News collection schema (.pages.yml: news)
const newsCollection = defineCollection({
  loader: glob({ pattern: "*.md", base: "content/news" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    author: optionalString,
    // no team = Vereins-News, shown under "Alle" only
    team: z.enum(teamSlugs).or(z.literal("")).optional().transform((t) => t || undefined),
    // name of a team that no longer exists (old posts), shown as a label
    old_team: optionalString,
    image: optionalString,
    stats: z.array(z.object({ value: z.string(), label: z.string() })).default([]),
    draft: z.boolean().default(false),
  }),
});

// Teams (.pages.yml: teams), the file name is the team slug
const teamsCollection = defineCollection({
  loader: glob({ pattern: "*.md", base: "content/teams" }),
  schema: z.object({
    title: z.string(),
    order: z.number().default(100),
    ages: optionalString,
    league: optionalString,
    badge: optionalString,
    image: optionalString,
    training: z
      .array(
        z.object({
          season: optionalString,
          days: z.string(),
          time: z.string(),
          place: z.string(),
        }),
      )
      .default([]),
    coaches: z
      .array(z.object({ name: z.string(), role: optionalString }))
      .default([]),
    email: optionalEmail,
  }),
});

// Xmas-Ball tournament page (.pages.yml: xmas_ball)
const xmasBallCollection = defineCollection({
  loader: glob({ pattern: "xmas-ball.md", base: "content" }),
  schema: z.object({
    title: z.string(),
    active: z.boolean().default(false),
    date: z.preprocess((d) => d || undefined, z.coerce.date().optional()),
    place: optionalString,
    deadline: z.preprocess((d) => d || undefined, z.coerce.date().optional()),
    teaser: optionalString,
    image: optionalString,
    // also the sign-up options; public/signup.php accepts any category name
    categories: z
      .array(
        z.object({
          name: z.string().max(40),
          years: optionalString,
          fee: optionalString,
        }),
      )
      .max(10)
      .default([]),
  }),
});

// Text pages (.pages.yml: pages), rendered by [regular].astro
const pagesCollection = defineCollection({
  loader: glob({ pattern: "*.md", base: "content/pages" }),
  schema: z.object({
    title: z.string(),
    meta_title: optionalString,
    description: optionalString,
    // shown under the title in the title band
    intro: optionalString,
    image: optionalString,
    files: z.array(z.object({ title: z.string(), file: z.string() })).default([]),
    draft: z.boolean().optional(),
  }),
});

// Kontakt (.pages.yml: kontakt)
const kontaktCollection = defineCollection({
  loader: glob({ pattern: "kontakt.md", base: "content" }),
  schema: z.object({
    title: z.string(),
    contacts: z
      .array(
        z.object({
          role: z.string(),
          name: z.string(),
          email: optionalEmail,
          phone: optionalString,
        }),
      )
      .default([]),
  }),
});

// Ballpark page (.pages.yml: ballpark), the address comes from src/config/menu.json
const ballparkCollection = defineCollection({
  loader: glob({ pattern: "ballpark.md", base: "content" }),
  schema: z.object({
    title: z.string(),
    description: optionalString,
    image: optionalString,
    // a picture of the map, no embedded Google Maps (privacy)
    map_image: optionalString,
    map_link: optionalString,
    facts: z.array(z.object({ title: z.string(), text: optionalString })).default([]),
  }),
});

// Sponsors (.pages.yml: sponsors), shown on /sponsoren and in the footer
const sponsorsCollection = defineCollection({
  loader: glob({ pattern: "*.md", base: "content/sponsors" }),
  schema: z.object({
    name: z.string(),
    logo: z.string(),
    link: z.string().url().or(z.literal("")).optional(),
    order: z.number().default(100),
    draft: z.boolean().default(false),
  }),
});

// Export collections
export const collections = {
  home: homeCollection,
  news: newsCollection,
  teams: teamsCollection,
  xmasBall: xmasBallCollection,
  pages: pagesCollection,
  kontakt: kontaktCollection,
  ballpark: ballparkCollection,
  sponsors: sponsorsCollection,
};
