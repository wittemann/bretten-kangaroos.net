// RSS feed of the news: /feed.xml (the old WordPress feed /feed/ redirects here)
import type { APIRoute } from "astro";
import config from "@/config/config.json";
import { getSinglePage } from "@/lib/contentParser.astro";
import { sortByDate } from "@/lib/utils/sortFunctions";
import { plainify } from "@/lib/utils/textConverter";

const MAX_ITEMS = 20;

const escapeXml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const teaser = (body: string) => {
  const text = plainify(body).replace(/\s+/g, " ").trim();
  return text.length > 300 ? `${text.slice(0, 300).replace(/\s\S*$/, "")} …` : text;
};

export const GET: APIRoute = async ({ site }) => {
  const origin = site!.origin;
  const posts = sortByDate(await getSinglePage("news")).slice(0, MAX_ITEMS);
  const items = posts.map((post) => {
    const link = `${origin}/news/${post.id}`;
    return [
      "    <item>",
      `      <title>${escapeXml(post.data.title)}</title>`,
      `      <link>${link}</link>`,
      `      <guid isPermaLink="true">${link}</guid>`,
      `      <pubDate>${post.data.date.toUTCString()}</pubDate>`,
      `      <description>${escapeXml(teaser(post.body ?? ""))}</description>`,
      "    </item>",
    ].join("\n");
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(config.site.title)} – Aktuelles</title>
    <link>${origin}/news</link>
    <description>Neuigkeiten der Bretten Kangaroos – Baseball und Softball in Bretten</description>
    <language>de-de</language>
    <atom:link href="${origin}/feed.xml" rel="self" type="application/rss+xml" />
${items.join("\n")}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
};
