// Usage statistics from the IONOS access logs, run locally only.
//
//   npm run stats               write anonymous counts to stats/usage.json
//   npm run stats -- --list     show the log folder (names, sizes, dates)
//
// Login: STATS_SFTP_HOST and STATS_SFTP_USER in .env, the password in the
// macOS Keychain (service "kangaroos-stats-sftp"). Log lines are reduced to
// counts in memory: no IP address, user agent or raw line is ever written to
// disk. Visitors per day are counted with a hash of address + browser + day
// and a random salt that only lives while the script runs.

import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import SftpClient from "ssh2-sftp-client";

// Pinned host key (ED25519) of the IONOS SFTP server, checked on 2026-10-26.
const HOST_KEY_SHA256 = "1gx2w8Rtv3wCgi7Jh8myf/KVd72cRQbow03UP8P095Q";
const KEYCHAIN_SERVICE = "kangaroos-stats-sftp";
const LOG_DIR = "/logs";
const OUT_FILE = "stats/usage.json";

const SITES = { "bretten-kangaroos.net": "alt", "www.bretten-kangaroos.net": "alt", "neu.bretten-kangaroos.net": "neu" };

const BOT_AGENT =
  /bot|crawl|spider|slurp|scan|preview|monitor|fetch|http-client|headless|lighthouse|curl|wget|python|go-http|java\/|okhttp|axios|node|php|ruby|perl|wordpress|feed|rss|facebookexternalhit|whatsapp|telegram|discord|skype|embedly|bingpreview|semrush|ahrefs|mj12|dotbot|petal|bytespider|gptbot|claude|anthropic|perplexity|ccbot|dataforseo|censys|zgrab|masscan|nmap|nikto|sqlmap/i;
const ASSET = /\.(css|js|mjs|map|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|eot|xml|txt|json|webmanifest|mp4|webm|zip|php\d?|pl|py)$/i;
// Attack probes, not broken links: keep them out of the 404 list.
const PROBE = /^\/(wp-json|wp-admin|wp-includes|\.|ip$|ipfs|cgi-bin|vendor|admin|phpmyadmin|xmlrpc|owa|actuator|server-status|boaform|hnap|autodiscover)|\/\./i;
const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
// IP host "-" ... [25/Oct/2026:00:00:12 +0200] "GET /path HTTP/1.1" 200 267 host "referer" "agent" "…"
const LINE =
  /^(\S+) \S+ \S+ \[(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):\d{2}:\d{2} [^\]]+\] "(\S+) (\S+)[^"]*" (\d{3}) \S+ (\S+) "([^"]*)" "([^"]*)"/;

function readEnv(file = ".env") {
  const env = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
  return env;
}

function keychainPassword() {
  return execFileSync("security", ["find-generic-password", "-s", KEYCHAIN_SERVICE, "-w"], {
    encoding: "utf8",
  }).trim();
}

async function connect() {
  const env = readEnv();
  if (!env.STATS_SFTP_HOST || !env.STATS_SFTP_USER) {
    throw new Error("STATS_SFTP_HOST and STATS_SFTP_USER must be set in .env");
  }
  const sftp = new SftpClient();
  await sftp.connect({
    host: env.STATS_SFTP_HOST,
    username: env.STATS_SFTP_USER,
    password: keychainPassword(),
    hostVerifier: (key) =>
      createHash("sha256").update(key).digest("base64").replace(/=+$/, "") === HOST_KEY_SHA256,
    readyTimeout: 20000,
  });
  return sftp;
}

async function list(sftp) {
  const files = (await sftp.list(LOG_DIR)).sort((a, b) => b.modifyTime - a.modifyTime);
  for (const f of files) {
    console.log(
      `${new Date(f.modifyTime).toISOString().slice(0, 16)}  ${String(f.size).padStart(10)}  ${f.name}${f.type === "d" ? "/" : ""}`,
    );
  }
}

// Old WordPress paths and new paths into the same German sections.
function section(site, path) {
  const p = path.toLowerCase();
  if (p === "/" || p === "/index.html") return "Startseite";
  if (/^\/(news|aktuelles|\d{4}\/\d{2}\/\d{2}|category)(\/|$)/.test(p)) return "News";
  if (/^\/(teams|herren|jugend|schueler|t-ball|softball)(\/|$)/.test(p)) return "Teams";
  if (/^\/spielplan/.test(p)) return "Spielplan";
  if (/^\/tabellen/.test(p)) return "Tabellen";
  if (/^\/(probetraining|mehr\/training)/.test(p)) return "Probetraining";
  if (/^\/(xmas-ball|turnieranmeldung)/.test(p)) return "Xmas-Ball";
  if (/^\/(ballpark|anfahrt)/.test(p)) return "Ballpark";
  if (/^\/(vereinsgeschichte|foerderverein|bkil|sponsoren|downloads|mehr\/downloads|kontakt)/.test(p)) return "Verein";
  if (/^\/(impressum|datenschutz)/.test(p)) return "Impressum/Datenschutz";
  return "Sonstige";
}

function referrerSource(referer, ownHost) {
  if (!referer || referer === "-") return "Direkt";
  let host;
  try {
    host = new URL(referer).hostname.replace(/^www\./, "");
  } catch {
    return "Sonstige";
  }
  if (host.endsWith("bretten-kangaroos.net") || host === ownHost) return null; // internal click
  if (/google\./.test(host)) return "Google";
  if (/bing\.|duckduckgo|ecosia|qwant|yahoo|startpage|brave/.test(host)) return "Andere Suchmaschinen";
  if (/facebook|fb\.|instagram/.test(host)) return "Facebook/Instagram";
  if (/baseball-softball\.de|bsm|dbv/.test(host)) return "Verband/BSM";
  return "Andere Websites";
}

const device = (agent) => (/ipad|tablet/i.test(agent) ? "Tablet" : /mobi|android|iphone/i.test(agent) ? "Handy" : "Computer");
const inc = (obj, key, by = 1) => (obj[key] = (obj[key] ?? 0) + by);

function aggregate(lines, stats, salt) {
  for (const line of lines) {
    const m = LINE.exec(line);
    if (!m) {
      stats.unparsed++;
      continue;
    }
    const [, ip, dd, mon, yyyy, hh, method, rawPath, status, vhost, referer, agent] = m;
    const site = SITES[vhost.toLowerCase()];
    if (!site) continue;
    const day = `${yyyy}-${String(MONTHS[mon]).padStart(2, "0")}-${dd}`;
    const path = rawPath.split("?")[0].split("#")[0];
    const s = stats.sites[site];

    if (method === "POST" && path === "/signup.php") {
      inc(s.signups, day);
      continue;
    }
    if (method !== "GET" && method !== "HEAD") continue;
    if (!agent || agent === "-" || BOT_AGENT.test(agent)) {
      inc(s.botRequests, day);
      continue;
    }

    if (/^\/kalender\/.+\.ics$/.test(path) && status === "200") {
      // Calendar apps poll the feed; count distinct subscribers per day.
      const feed = path.replace(/^\/kalender\//, "");
      const key = createHash("sha256").update(salt + ip + agent + day + feed).digest("base64");
      if (!stats.seen.has(key)) {
        stats.seen.add(key);
        inc((s.calendar[feed] ??= {}), day);
      }
      continue;
    }
    if (/\.pdf$/i.test(path) && (status === "200" || status === "206")) {
      inc(s.downloads, decodeURIComponent(path.split("/").pop()));
      continue;
    }
    if (status === "404" && !ASSET.test(path) && !PROBE.test(path)) {
      inc(s.notFound, path);
      continue;
    }
    if (status !== "200" && status !== "304") continue;
    if (ASSET.test(path) || /^\/(wp-|_astro|images|files|feed|xmlrpc|signup)/.test(path)) continue;

    const date = new Date(`${day}T00:00:00`);
    inc(s.pageviews, day);
    inc(s.sections, section(site, path));
    inc(s.pages, decodeURIComponent(path.replace(/\/$/, "") || "/"));
    inc(s.devices, device(agent));
    inc(s.hourByWeekday, `${(date.getDay() + 6) % 7}-${Number(hh)}`); // 0 = Monday
    const source = referrerSource(referer, vhost);
    if (source) inc(s.sources, source);

    const visitor = createHash("sha256").update(salt + ip + agent + day + site).digest("base64");
    if (!stats.seen.has(visitor)) {
      stats.seen.add(visitor);
      inc(s.visitors, day);
    }
  }
}

const top = (obj, n) =>
  Object.fromEntries(
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n),
  );

async function collect(sftp) {
  const salt = randomBytes(32).toString("hex");
  const emptySite = () => ({
    pageviews: {}, visitors: {}, botRequests: {}, sections: {}, pages: {}, devices: {}, sources: {},
    hourByWeekday: {}, calendar: {}, downloads: {}, notFound: {}, signups: {},
  });
  const stats = { unparsed: 0, seen: new Set(), sites: { alt: emptySite(), neu: emptySite() } };

  const files = (await sftp.list(LOG_DIR)).filter((f) => f.type === "-" && /^access\.log\.\d/.test(f.name));
  for (const f of files) {
    const buf = await sftp.get(`${LOG_DIR}/${f.name}`);
    const text = (f.name.endsWith(".gz") ? gunzipSync(buf) : buf).toString("utf8");
    aggregate(text.split("\n"), stats, salt);
    process.stdout.write(`${f.name} `);
  }
  console.log();

  const days = Object.keys({ ...stats.sites.alt.pageviews, ...stats.sites.neu.pageviews }).sort();
  const out = {
    generatedAt: new Date().toISOString(),
    period: { from: days[0], to: days.at(-1) },
    note: "Anonyme Zählung aus den IONOS-Zugriffsprotokollen, Bots herausgefiltert. Keine IP-Adressen gespeichert.",
    sites: {},
  };
  for (const [name, s] of Object.entries(stats.sites)) {
    out.sites[name] = {
      ...s,
      pages: top(s.pages, 40),
      downloads: top(s.downloads, 20),
      notFound: top(s.notFound, 30),
    };
  }
  mkdirSync("stats/dashboard", { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(out, null, 1));
  writeDashboardFiles(out);
  console.log(`Written ${OUT_FILE}: ${out.period.from} – ${out.period.to}, ${stats.unparsed} unparsed lines`);
}

// Flat row files for the claude.ai dashboard: one per day and site, and one
// row per breakdown value (dimension = Bereich, Seite, Quelle, …).
function writeDashboardFiles(out) {
  const daily = [];
  const breakdown = [];
  for (const [site, s] of Object.entries(out.sites)) {
    const days = new Set([...Object.keys(s.pageviews), ...Object.keys(s.visitors), ...Object.keys(s.botRequests)]);
    for (const day of [...days].sort()) {
      daily.push({
        day, site,
        pageviews: s.pageviews[day] ?? 0,
        visitors: s.visitors[day] ?? 0,
        botRequests: s.botRequests[day] ?? 0,
        signups: s.signups[day] ?? 0,
      });
    }
    const add = (dimension, obj) => {
      for (const [key, views] of Object.entries(obj)) breakdown.push({ site, dimension, key, views });
    };
    add("Bereich", s.sections);
    add("Seite", s.pages);
    add("Quelle", s.sources);
    add("Gerät", s.devices);
    add("Stunde", s.hourByWeekday); // key "<weekday 0=Mo>-<hour>"
    add("Download", s.downloads);
    add("Nicht gefunden", s.notFound);
    const feeds = {};
    for (const [feed, perDay] of Object.entries(s.calendar)) feeds[feed] = Object.values(perDay).reduce((a, b) => a + b, 0);
    add("Kalender", feeds);
  }
  writeFileSync("stats/dashboard/daily.json", JSON.stringify(daily));
  writeFileSync("stats/dashboard/breakdown.json", JSON.stringify(breakdown));
}

const sftp = await connect();
try {
  if (process.argv.includes("--list")) await list(sftp);
  else await collect(sftp);
} finally {
  await sftp.end();
}
