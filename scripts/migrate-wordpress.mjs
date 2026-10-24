// Converts the posts of a WordPress export (WXR) into news files in
// content/news, with their images in public/images/news and linked files in
// public/files/news (WP7). Pages are not converted, they were moved by hand.
//
// Usage:
//   npm run migrate -- <export.xml> [--uploads <dir>] [--retry-missing] [--offline]
//
//   --uploads        a local copy of wp-content/uploads (e.g. from an FTP backup),
//                    tried before downloading from the live site
//   --retry-missing  look again for media that wasn't found in an earlier run
//                    (implied by --uploads)
//   --offline        never download from the live site
//
// Re-runnable: scripts/wordpress-migration.json remembers which file each
// WordPress post became and a hash of what was written. A later run on a fresh
// export adds new posts and updates migrated files only while they are
// unchanged; files edited or deleted in Pages CMS since are left alone.
// The run also writes the old-permalink redirects into public/.htaccess and a
// report to docs/wordpress-migration-report.md.

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { XMLParser } from "fast-xml-parser";
import sharp from "sharp";
import TurndownService from "turndown";

const ROOT = new URL("..", import.meta.url).pathname;
const MANIFEST_PATH = join(ROOT, "scripts/wordpress-migration.json");
const REPORT_PATH = join(ROOT, "docs/wordpress-migration-report.md");
const HTACCESS_PATH = join(ROOT, "public/.htaccess");
const NEWS_DIR = "content/news";
const LIVE_SITE = "https://bretten-kangaroos.net";
// Hosts the old site ran under; their links and images point to the live site
const OWN_HOSTS =
  /^https?:\/\/(?:[\w-]+\.)?bretten-kangaroos\.(?:net|com|de)(?=\/|$)/i;
const MAX_IMAGE_SIZE = 1600;
const PARALLEL_DOWNLOADS = 4;
const TIMEOUT_MS = 20_000;

// Old categories → `team` / `old_team`, see docs/wordpress-inventory.md
const TEAM_BY_CATEGORY = {
  herren: "herren",
  jugend: "jugend",
  schuler: "schueler",
  "t-ball": "t-ball",
};
const OLD_TEAM_BY_CATEGORY = {
  herren2: "Herren 2",
  junioren: "Junioren",
  damen: "Damen",
  slowpitch: "Slow Pitch",
  "softball-juniors": "Softball-Juniors",
  incrediball: "Incrediball",
};

// Old pages that moved (docs/wordpress-inventory.md); the rest keep their URL
const PAGE_REDIRECTS = {
  "/herren/": "/teams/herren",
  "/jugend/": "/teams/jugend",
  "/schueler/": "/teams/schueler",
  "/t-ball/": "/teams/t-ball",
  "/softball/": "/teams/softball",
  "/foerderverein-bretten-kangaroos-e-v-gemeinsam-fuer-baseball-und-softball-in-bretten/":
    "/foerderverein",
  "/datenschutzerklaerung/": "/datenschutz",
  "/turnieranmeldung/": "/xmas-ball",
  // linked from old posts
  "/mehr/training/": "/probetraining",
  "/mehr/downloads/": "/downloads",
  "/anfahrt/": "/ballpark",
};

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    uploads: { type: "string" },
    "retry-missing": { type: "boolean", default: false },
    offline: { type: "boolean", default: false },
  },
});
if (positionals.length !== 1) {
  console.error(
    "Usage: npm run migrate -- <export.xml> [--uploads <dir>] [--retry-missing] [--offline]",
  );
  process.exit(1);
}
const retryMissing = options["retry-missing"] || Boolean(options.uploads);

const manifest = readManifest();
const report = {
  created: [],
  updated: [],
  unchanged: 0,
  editedInCms: [],
  deletedInCms: [],
  empty: [],
  missingMedia: new Map(), // post file → [old paths]
};

// --- Read the export ----------------------------------------------------------

const { items, authors } = readExport(positionals[0]);
const attachments = new Map(
  items
    .filter((item) => item["wp:post_type"] === "attachment")
    .map((item) => [String(item["wp:post_id"]), item["wp:attachment_url"]]),
);
const posts = items
  .filter(
    (item) =>
      item["wp:post_type"] === "post" && item["wp:status"] === "publish",
  )
  .map(readPost)
  .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);

// File names are fixed on first conversion and then kept, so URLs stay stable
const takenFiles = new Set(Object.values(manifest.posts).map((p) => p.file));
for (const post of posts) {
  post.file = manifest.posts[post.id]?.file ?? newFileName(post);
  post.url = `/news/${post.file.slice(NEWS_DIR.length + 1, -3)}`;
}
const postsByPath = new Map(posts.map((post) => [post.oldPath, post]));

// --- Media --------------------------------------------------------------------

const takenMedia = new Set(Object.values(manifest.media).filter(Boolean));
const html = new Map(posts.map((post) => [post.id, prepareHtml(post)]));
const mediaRefs = new Set();
for (const post of posts) {
  for (const ref of collectMedia(html.get(post.id))) mediaRefs.add(ref);
  if (post.thumbnail) mediaRefs.add(post.thumbnail);
}
await resolveAllMedia([...mediaRefs]);

// --- Convert and write --------------------------------------------------------

const turndown = createTurndown();
for (const post of posts) {
  const missing = [];
  turndown.missing = missing;
  let body = tidyMarkdown(turndown.turndown(html.get(post.id)));

  // Featured image, else the first image of the post; shown above the text,
  // so it's taken out of the body
  let image = post.thumbnail ? mediaFile(post.thumbnail) : null;
  if (post.thumbnail && !image) missing.push(mediaKey(post.thumbnail));
  image ??= body.match(/!\[[^\]]*\]\((\/images\/[^)\s]+)\)/)?.[1] ?? null;
  if (image) body = tidyMarkdown(removeFirstImage(body, image));

  if (missing.length) report.missingMedia.set(post.file, [...new Set(missing)]);
  // Posts of only images that are all missing come back once they're found
  if (!body && !image) {
    report.empty.push(post);
    continue;
  }
  writePost(post, frontMatter(post, image) + body + "\n");
}

writeManifest();
writeRedirects();
writeReport();

console.log(
  `News: ${report.created.length} new, ${report.updated.length} updated, ` +
    `${report.unchanged} unchanged, ${report.editedInCms.length} edited in Pages CMS (kept), ` +
    `${report.deletedInCms.length} deleted in Pages CMS (not recreated), ${report.empty.length} empty (skipped)`,
);
const missingCount = Object.values(manifest.media).filter((m) => !m).length;
console.log(
  `Media: ${Object.keys(manifest.media).length - missingCount} found, ${missingCount} missing`,
);
console.log(`Report: ${REPORT_PATH.slice(ROOT.length)}`);

// ==============================================================================

function readExport(path) {
  // The export contains a few control characters that make it invalid XML
  const xml = readFileSync(path, "utf8").replace(
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,
    "",
  );
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    parseTagValue: false,
    isArray: (name) => ["item", "category", "wp:postmeta"].includes(name),
  });
  const channel = parser.parse(xml).rss.channel;
  // login → name shown as the post's author; some accounts only have their
  // login ("bryan.schaffer") as display name, that becomes "Bryan Schaffer"
  const authors = new Map(
    [channel["wp:author"] ?? []].flat().map((a) => {
      const name = textOf(a["wp:author_display_name"]).trim();
      const fromLogin = name
        .split(".")
        .map((part) => part.replace(/(^|-)\p{Ll}/gu, (c) => c.toUpperCase()))
        .join(" ");
      return [textOf(a["wp:author_login"]), /^[\p{L}-]+(\.[\p{L}-]+)+$/u.test(name) ? fromLogin : name];
    }),
  );
  return { items: channel.item, authors };
}

function readPost(item) {
  const categories = (item.category ?? [])
    .filter((c) => c.domain === "category")
    .map((c) => c.nicename);
  const thumbnailId = (item["wp:postmeta"] ?? []).find(
    (m) => m["wp:meta_key"] === "_thumbnail_id",
  )?.["wp:meta_value"];
  const slug = decodeURIComponent(item["wp:post_name"]);
  const date = item["wp:post_date"].slice(0, 10);
  return {
    id: Number(item["wp:post_id"]),
    title: decodeEntities(textOf(item.title)).trim(),
    date,
    slug,
    oldPath: `/${date.replaceAll("-", "/")}/${slug}/`,
    categories,
    author: authors.get(textOf(item["dc:creator"])) || undefined,
    content: textOf(item["content:encoded"]),
    thumbnail: thumbnailId ? attachments.get(String(thumbnailId)) : undefined,
  };
}

function textOf(value) {
  if (value == null) return "";
  return typeof value === "object" ? String(value["#text"] ?? "") : String(value);
}

function newFileName(post) {
  // Posts imported from the very old site are called "import123"
  const base =
    toSlug(/^(import)?\d+$/.test(post.slug) ? post.title : post.slug) ||
    toSlug(post.title) ||
    String(post.id);
  let file = `${NEWS_DIR}/${post.date}-${base}.md`;
  for (let n = 2; takenFiles.has(file) || existsSync(join(ROOT, file)); n++) {
    file = `${NEWS_DIR}/${post.date}-${base}-${n}.md`;
  }
  takenFiles.add(file);
  return file;
}

// ASCII slug: umlauts transliterated, emojis and punctuation dropped
function toSlug(text, maxLength = 70) {
  const slug = text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length <= maxLength) return slug;
  return slug.slice(0, maxLength).replace(/-[^-]*$/, "");
}

function teamFields(categories) {
  // A post of several current teams is club news, the select takes only one
  const teams = [...new Set(categories.map((c) => TEAM_BY_CATEGORY[c]).filter(Boolean))];
  if (teams.length === 1) return { team: teams[0] };
  if (teams.length > 1) return {};
  const oldTeam = categories.map((c) => OLD_TEAM_BY_CATEGORY[c]).find(Boolean);
  return oldTeam ? { old_team: oldTeam } : {};
}

function frontMatter(post, image) {
  const fields = {
    title: post.title,
    date: post.date,
    ...(post.author ? { author: post.author } : {}),
    ...teamFields(post.categories),
    ...(image ? { image } : {}),
  };
  const lines = Object.entries(fields).map(([key, value]) =>
    key === "date" ? `${key}: ${value}` : `${key}: ${JSON.stringify(value)}`,
  );
  return `---\n${lines.join("\n")}\n---\n\n`;
}

// --- HTML clean-up ------------------------------------------------------------

function prepareHtml(post) {
  let html = post.content;

  // [gallery ids="1,2"] (once) → the attachments as images
  html = html.replace(/\[gallery[^\]]*ids="([\d,\s]+)"[^\]]*\]/g, (_, ids) =>
    ids
      .split(",")
      .map((id) => attachments.get(id.trim()))
      .filter(Boolean)
      .map((url) => `<img src="${url}">`)
      .join(""),
  );

  // Flash and iframe videos → a link to the video
  html = html.replace(
    /<object[\s\S]*?<\/object>|<iframe[\s\S]*?<\/iframe>|<embed[^>]*>/gi,
    (match) => {
      const id = match.match(/youtube(?:-nocookie)?\.com\/(?:v|embed)\/([\w-]{11})/i)?.[1];
      return id ? `<p><a href="https://www.youtube.com/watch?v=${id}">Video auf YouTube</a></p>` : "";
    },
  );
  // Block editor embeds only hold the URL as text
  html = html.replace(
    /<div class="wp-block-embed__wrapper">\s*(https?:\/\/\S+?)\s*<\/div>/g,
    (_, url) => `<p><a href="${url}">${/youtu/.test(url) ? "Video auf YouTube" : url}</a></p>`,
  );

  // Pasted MS Word: conditional comments, embedded styles and XML
  html = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(style|mce:style|xml|script|title|head)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/?(meta|link|o:p|w:[\w]+|m:[\w]+)\b[^>]*>/gi, "");

  // Classic editor posts are stored without paragraphs (wpautop adds them)
  if (!/<!-- wp:/.test(post.content)) {
    html = autoParagraphs(html);
  }

  // Several line breaks in a row separate paragraphs
  html = html.replace(/(?:<br\s*\/?>\s*){2,}/gi, "</p><p>");
  return html;
}

// Simplified wpautop: blank lines → paragraphs, single newlines → <br>
function autoParagraphs(html) {
  const block = /^<(p|div|ul|ol|li|h[1-6]|figure|table|blockquote|hr)\b/i;
  return html
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) =>
      block.test(chunk) ? chunk : `<p>${chunk.replace(/\n/g, "<br>")}</p>`,
    )
    .join("\n");
}

// --- Markdown -----------------------------------------------------------------

function createTurndown() {
  const service = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    emDelimiter: "*",
    br: "\\",
  });
  service.remove(["style", "script", "noscript", "form", "input", "button", "object", "embed", "param", "iframe"]);

  service.addRule("image", {
    filter: "img",
    replacement: (_, node) => {
      const ref = node.getAttribute("src");
      const file = ref && mediaFile(ref);
      if (!file) {
        if (ref) service.missing.push(mediaKey(ref));
        return "";
      }
      const alt = (node.getAttribute("alt") || "").replace(/[[\]\n]/g, " ").trim();
      return `\n\n![${alt}](${file})\n\n`;
    },
  });

  service.addRule("link", {
    filter: (node) => node.nodeName === "A" && node.getAttribute("href"),
    replacement: (content, node) => {
      // Links around an image only point to the large version of it
      if (!content.trim() || (/^\s*!\[/.test(content) && /\)\s*$/.test(content))) {
        return content;
      }
      const href = rewriteLink(node.getAttribute("href"), service);
      return href ? `[${content}](${href})` : content;
    },
  });

  service.addRule("caption", {
    filter: "figcaption",
    replacement: (content) => (content.trim() ? `\n\n*${content.trim()}*\n\n` : ""),
  });
  return service;
}

function rewriteLink(href, service) {
  href = decodeEntities(href.trim());
  if (/^(mailto:|tel:)/i.test(href)) return href;
  if (!/^https?:\/\//i.test(href)) {
    if (!href.startsWith("/")) return null; // relative links of the very old site
    href = LIVE_SITE + href;
  }
  if (!OWN_HOSTS.test(href)) return href;
  if (!/^https?:\/\/(www\.)?bretten-kangaroos\.net/i.test(href)) return null; // dead old domains

  const path = safeDecodeURI(href.replace(OWN_HOSTS, "").replace(/[?#].*$/, "")) || "/";
  if (path.startsWith("/wp-content/uploads/")) {
    // Links to a large version of an image are dropped, files are kept
    if (/\.(jpe?g|png|gif|webp)$/i.test(path)) return null;
    const file = mediaFile(path);
    if (!file) service.missing.push(mediaKey(path));
    return file;
  }
  const post = postsByPath.get(path.endsWith("/") ? path : `${path}/`);
  if (post) return post.url;
  const page = path.endsWith("/") ? path : `${path}/`;
  return PAGE_REDIRECTS[page] ?? (path.replace(/\/$/, "") || "/");
}

function tidyMarkdown(markdown) {
  const blocks = markdown
    .replace(/ /g, " ")
    .split(/\n{2,}/)
    // lines left with only a line break (from "&nbsp;<br>") and breaks at the edges
    .map((block) => block.replace(/[ \t]+$/gm, "").replace(/^[ \t]*\\$/gm, ""))
    .map((block) => block.trim().replace(/^(?:\\?\n)+/, "").replace(/(?:\n|\\)+$/, "").trim())
    .filter((block) => block && !/^(\\|\*\*\*\*|\*\*|__)$/.test(block));

  // Images in a row (galleries) go into one paragraph and are shown as a grid
  const merged = [];
  const isImages = (block) => /^(?:!\[[^\]]*\]\([^)]+\)\n?)+$/.test(block);
  for (const block of blocks) {
    if (merged.length && isImages(block) && isImages(merged.at(-1))) {
      merged[merged.length - 1] += `\n${block}`;
    } else {
      merged.push(block);
    }
  }
  return merged.join("\n\n");
}

function removeFirstImage(markdown, file) {
  const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return markdown.replace(new RegExp(`!\\[[^\\]]*\\]\\(${escaped}\\)\\n?`), "");
}

// --- Media files --------------------------------------------------------------

// Paths in posts → their path on the live site
function normalizeMediaPath(ref) {
  return safeDecodeURI(decodeEntities(ref.trim()).replace(OWN_HOSTS, ""));
}

// One key per image: WordPress links resized copies like "-1024x573" and
// "-scaled" versions of the same upload
function mediaKey(ref) {
  return normalizeMediaPath(ref).replace(/-\d+x\d+(?=\.\w+$)/, "").replace(/-scaled(?=\.\w+$)/, "");
}

function collectMedia(html) {
  const refs = [];
  for (const [, ref] of html.matchAll(/<img\b[^>]*?\ssrc=["']([^"']+)["']/gi)) refs.push(ref);
  for (const [, ref] of html.matchAll(/\shref=["']([^"']*\/wp-content\/uploads\/[^"']+)["']/gi)) {
    const isImage = /\.(jpe?g|png|gif|webp)$/i.test(ref);
    if (!isImage && (OWN_HOSTS.test(ref) || ref.startsWith("/"))) refs.push(ref);
  }
  return refs;
}

// The local file a media reference became, or null when it couldn't be found
function mediaFile(ref) {
  return manifest.media[mediaKey(ref)] ?? null;
}

async function resolveAllMedia(refs) {
  // key → the paths seen for it, tried after the full-size versions
  const variants = new Map();
  for (const ref of refs) {
    const key = mediaKey(ref);
    if (key in manifest.media && !(manifest.media[key] === null && retryMissing)) continue;
    variants.set(key, [...(variants.get(key) ?? []), normalizeMediaPath(ref)]);
  }
  let done = 0;
  await mapLimit([...variants], PARALLEL_DOWNLOADS, async ([key, paths]) => {
    manifest.media[key] = await fetchMedia(key, paths);
    if (++done % 100 === 0) console.log(`Media: ${done}/${variants.size}`);
  });
}

// Largest version first: the "-scaled" upload, the original, then resized copies
async function fetchMedia(key, paths) {
  if (!key.startsWith("/wp-content/uploads/")) return null;
  const candidates = new Set([key.replace(/(?=\.\w+$)/, "-scaled"), key, ...paths]);
  for (const candidate of candidates) {
    const data = readLocalUpload(candidate) ?? (await download(candidate));
    if (!data) continue;
    try {
      return await saveMedia(key, data);
    } catch (error) {
      console.warn(`Media: can't convert ${candidate}: ${error.message}`);
    }
  }
  return null;
}

function readLocalUpload(path) {
  if (!options.uploads) return null;
  const file = join(options.uploads, path.slice("/wp-content/uploads/".length));
  return existsSync(file) && statSync(file).isFile() ? readFileSync(file) : null;
}

async function download(path) {
  if (options.offline) return null;
  try {
    const url = LIVE_SITE + encodeURI(path).replace(/[?#]/g, encodeURIComponent);
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    // WordPress answers some missing files with an HTML page
    const isHtml = response.headers.get("content-type")?.startsWith("text/html");
    return response.ok && !isHtml ? Buffer.from(await response.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

// Images are scaled down (they're shown at most 1000px wide), files copied
async function saveMedia(path, data) {
  const [, year, month, name] = path.match(/^\/wp-content\/uploads\/(?:(\d{4})\/(\d{2})\/)?(.+)$/) ?? [];
  const dot = name.lastIndexOf(".");
  const ext = name.slice(dot + 1).toLowerCase().replace("jpeg", "jpg");
  const base =
    toSlug(name.slice(0, dot).replace(/-\d+x\d+$/, "").replace(/-scaled$/, ""), 80) || "datei";
  const isImage = ["jpg", "png", "gif", "webp"].includes(ext);
  const folder = `${isImage ? "images" : "files"}/news/${year ?? "alt"}${month ? `/${month}` : ""}`;

  // Reserved right away, other downloads run in parallel
  let publicPath = `/${folder}/${base}.${ext}`;
  for (let n = 2; takenMedia.has(publicPath); n++) publicPath = `/${folder}/${base}-${n}.${ext}`;
  takenMedia.add(publicPath);

  const target = join(ROOT, "public", publicPath);
  mkdirSync(dirname(target), { recursive: true });
  if (!isImage || ext === "gif") {
    writeFileSync(target, data);
  } else {
    let image = sharp(data).rotate().resize({
      width: MAX_IMAGE_SIZE,
      height: MAX_IMAGE_SIZE,
      fit: "inside",
      withoutEnlargement: true,
    });
    image = ext === "png" ? image.png({ compressionLevel: 9 }) : image.jpeg({ quality: 80, mozjpeg: true });
    await image.toFile(target);
  }
  return publicPath;
}

// --- Writing ------------------------------------------------------------------

function writePost(post, content) {
  const path = join(ROOT, post.file);
  const hash = sha256(content);
  const known = manifest.posts[post.id];

  if (known) {
    if (!existsSync(path)) {
      report.deletedInCms.push(post);
      return;
    }
    if (sha256(readFileSync(path, "utf8")) !== known.hash) {
      report.editedInCms.push(post);
      return;
    }
    if (known.hash === hash) {
      report.unchanged++;
      return;
    }
    report.updated.push(post);
  } else {
    report.created.push(post);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  manifest.posts[post.id] = { file: post.file, oldPath: post.oldPath, hash };
}

function readManifest() {
  if (!existsSync(MANIFEST_PATH)) return { posts: {}, media: {} };
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
}

function writeManifest() {
  const sorted = (object) => Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));
  const data = { posts: manifest.posts, media: sorted(manifest.media) };
  writeFileSync(MANIFEST_PATH, JSON.stringify(data, null, 2) + "\n");
}

// Old permalinks → new URLs, as a generated block in public/.htaccess
function writeRedirects() {
  const begin = "# BEGIN WordPress redirects (generated by scripts/migrate-wordpress.mjs)";
  const end = "# END WordPress redirects";
  const rule = (oldPath, url) => {
    // Apache matches the decoded path; emojis in old slugs are matched loosely
    const pattern = oldPath
      .replace(/\/$/, "")
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/[^\x20-\x7e]+/g, "[^/]*");
    // Apache adds the trailing slash to a page's folder, so point there directly
    return `RedirectMatch 301 "^${pattern}/?$" "${url}/"`;
  };
  const lines = [
    begin,
    ...Object.entries(PAGE_REDIRECTS).map(([from, to]) => rule(from, to)),
    // Posts deleted in Pages CMS or not migrated yet go to the news overview
    ...[
      ...Object.values(manifest.posts).map((p) => [
        p.oldPath,
        existsSync(join(ROOT, p.file)) ? `/news/${p.file.slice(NEWS_DIR.length + 1, -3)}` : "/news",
      ]),
      ...report.empty.filter((p) => !manifest.posts[p.id]).map((p) => [p.oldPath, "/news"]),
    ]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([oldPath, url]) => rule(oldPath, url)),
    'RedirectMatch 301 "^/category/" "/news/"',
    'RedirectMatch 301 "^/wp-content/uploads/" "/news/"',
    end,
  ];
  const htaccess = readFileSync(HTACCESS_PATH, "utf8");
  const start = htaccess.indexOf(begin);
  const stop = htaccess.indexOf(end);
  const next =
    start >= 0 && stop > start
      ? htaccess.slice(0, start) + lines.join("\n") + htaccess.slice(stop + end.length)
      : `${htaccess.trimEnd()}\n\n${lines.join("\n")}\n`;
  writeFileSync(HTACCESS_PATH, next);
}

function writeReport() {
  const list = (posts) =>
    posts.length ? posts.map((p) => `- \`${p.file}\` – ${p.title}`).join("\n") : "None.";
  const missing = [...report.missingMedia]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([file, paths]) => `- \`${file}\` – ${paths.length} missing: ${paths.map((p) => `\`${p}\``).join(", ")}`)
    .join("\n");
  const missingTotal = new Set([...report.missingMedia.values()].flat()).size;

  writeFileSync(
    REPORT_PATH,
    `# WordPress migration – report

Generated by \`scripts/migrate-wordpress.mjs\` on ${new Date().toISOString().slice(0, 10)} from
\`${positionals[0].replace(process.env.HOME, "~")}\` (${posts.length} posts). See WP7 in [\`todo.md\`](todo.md).

| | Posts |
|---|---|
| New | ${report.created.length} |
| Updated | ${report.updated.length} |
| Unchanged | ${report.unchanged} |
| Edited in Pages CMS since, kept | ${report.editedInCms.length} |
| Deleted in Pages CMS since, not recreated | ${report.deletedInCms.length} |

## Edited in Pages CMS (not overwritten)

${list(report.editedInCms)}

## Deleted in Pages CMS (not recreated)

${list(report.deletedInCms)}

## Not migrated, only missing images

These posts consist of images that are all missing. They're added by a later run that finds them; until
then their old URLs redirect to \`/news\`.

${list(report.empty)}

## Missing images and files

${missingTotal} files referenced by ${report.missingMedia.size} posts could be found neither in the
uploads folder nor on the live site. They're left out of the posts. To fill them in, run the migration
again with a copy of \`wp-content/uploads\` from a backup: \`npm run migrate -- <export.xml> --uploads <dir>\`.

${missing || "None."}
`,
  );
}

// --- Helpers ------------------------------------------------------------------

function decodeEntities(text) {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", bdquo: "„", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", sbquo: "‚", auml: "ä", ouml: "ö", uuml: "ü", Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß", euro: "€" };
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (match, entity) => {
    if (entity[0] === "#") {
      const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return String.fromCodePoint(code);
    }
    return named[entity] ?? match;
  });
}

function safeDecodeURI(text) {
  try {
    return decodeURI(text);
  } catch {
    return text;
  }
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

async function mapLimit(list, limit, fn) {
  const results = [];
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (next < list.length) {
      const index = next++;
      results[index] = await fn(list[index]);
    }
  });
  await Promise.all(workers);
  return results;
}
