import { unified } from "@astrojs/markdown-remark";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import AutoImport from "astro-auto-import";
import { defineConfig, fontProviders, sharpImageService } from "astro/config";
import config from "./src/config/config.json";
import theme from "./src/config/theme.json";

// Helper to parse font string format: "FontName:wght@400;500;600;700"
function parseFontString(fontStr) {
  const [name, weightPart] = fontStr.split(":");
  let weights = [400]; // default weight

  if (weightPart) {
    // Extract weights from wght@400;500;600 format
    const weightMatch = weightPart.match(/wght@?([\d;]+)/);
    if (weightMatch) {
      weights = weightMatch[1].split(";").map((w) => parseInt(w, 10));
    }
  }

  // remove + from font name and add space
  const cleanName = name.replace(/\+/g, " ");
  return { name: cleanName, weights };
}

// Build fonts configuration from theme.json
const fontsConfig = Object.entries(theme.fonts.font_family)
  .filter(([key]) => !key.includes("_type")) // Filter out type entries
  .map(([key, fontStr]) => {
    const { name, weights } = parseFontString(fontStr);
    const typeKey = `${key}_type`;
    const fallback = theme.fonts.font_family[typeKey] || "sans-serif";

    return {
      name,
      cssVariable: `--font-${key}`,
      provider: fontProviders.google(),
      weights,
      display: "swap",
      fallbacks: [fallback],
    };
  });

// "## 1992 – Title" (or a range, "## 2020–22 – Title") headings become year headings
// (rendered as a year column, e.g. Vereinsgeschichte)
function rehypeYearHeadings() {
  const walk = (node) => {
    if (node.type === "element" && node.tagName === "h2") {
      const first = node.children?.[0];
      const match = first?.type === "text" && first.value.match(/^(\d{4}(?:[–-]\d{2})?) [–-] (.*)$/s);
      if (match) {
        first.value = match[2];
        node.properties = { ...node.properties, className: ["year-heading"], "data-year": match[1] };
      }
    }
    node.children?.forEach(walk);
  };
  return (tree) => walk(tree);
}

// A paragraph that is only bold text ("**Title**", how the old WordPress posts mark
// their sub-headings) becomes an h2, so it gets the section heading style
function rehypeBoldHeadings() {
  const isBlank = (child) => child.type === "text" && !child.value.trim();
  const walk = (node) => {
    node.children?.forEach((child, i) => {
      if (child.type !== "element" || child.tagName !== "p") return walk(child);
      const content = child.children.filter((c) => !isBlank(c));
      if (content.length === 1 && content[0].type === "element" && content[0].tagName === "strong") {
        node.children[i] = { ...child, tagName: "h2", children: content[0].children };
      }
    });
  };
  return (tree) => walk(tree);
}

// An image alone in its paragraph with a title (![alt](src "Caption")) becomes a
// figure with that title as caption
function rehypeFigures() {
  const isBlank = (child) => child.type === "text" && !child.value.trim();
  const walk = (node) => {
    node.children?.forEach((child, i) => {
      if (child.type !== "element" || child.tagName !== "p") return walk(child);
      const content = child.children.filter((c) => !isBlank(c));
      const img = content[0];
      if (content.length !== 1 || img.type !== "element" || img.tagName !== "img" || !img.properties?.title) return;
      const caption = String(img.properties.title);
      delete img.properties.title;
      node.children[i] = {
        type: "element",
        tagName: "figure",
        properties: {},
        children: [img, { type: "element", tagName: "figcaption", properties: {}, children: [{ type: "text", value: caption }] }],
      };
    });
  };
  return (tree) => walk(tree);
}

// https://astro.build/config
export default defineConfig({
  site: config.site.base_url,
  base: config.site.base_path ? config.site.base_path : "/",
  trailingSlash: config.site.trailing_slash ? "always" : "never",
  image: { service: sharpImageService() },
  vite: { plugins: [tailwindcss()] },
  fonts: fontsConfig,
  integrations: [
    react(),
    sitemap(),
    AutoImport({
      imports: [
        "@/shortcodes/Button",
        "@/shortcodes/Accordion",
        "@/shortcodes/Notice",
        "@/shortcodes/Video",
        "@/shortcodes/Youtube",
        "@/shortcodes/Tabs",
        "@/shortcodes/Tab",
      ],
    }),
    mdx(),
  ],
  markdown: {
    processor: unified(),
    rehypePlugins: [rehypeBoldHeadings, rehypeYearHeadings, rehypeFigures],
    shikiConfig: { theme: "one-dark-pro", wrap: true },
  },
});
