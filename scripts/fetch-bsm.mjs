// Fetches standings and games from the BSM (Baseball Softball Manager) for the
// leagues in src/data/bsm-leagues.json and writes src/data/bsm-cache.json,
// which is the only thing the pages read. Design: docs/bsm-api.md.
//
// A league that can't be fetched or looks wrong keeps its entry from the old
// cache, so BSM being down never breaks the build. Exits non-zero only when
// the config itself is broken.
//
// Club logos of the table rows are downloaded into public/images/bsm-logos/
// (small WebP), so the pages never hotlink the BSM server.
//
// When run in GitHub Actions, writes `changed=true|false` to $GITHUB_OUTPUT
// (timestamps ignored) so the workflow only commits real data changes.

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { isDeepStrictEqual } from "node:util";
import sharp from "sharp";

const BASE_URL = "https://bsm.baseball-softball.de";
const CONFIG_PATH = new URL("../src/data/bsm-leagues.json", import.meta.url);
const CACHE_PATH = new URL("../src/data/bsm-cache.json", import.meta.url);
const LOGO_DIR = new URL("../public/images/bsm-logos/", import.meta.url);
const LOGO_SIZE = 64; // shown at 28px, enough for 2x screens
const TIMEOUT_MS = 15_000;
const RETRIES = 2;
const PARALLEL = 3;
const FORM_GAMES = 5;
// Games whose score counts for the form (W/L like the BSM table): forfeits
// and no-shows are rated with a fixed score.
const RATED_STATES = new Set([
  "played",
  "forfeit",
  "no_show",
  "manually_valued",
]);

const config = readConfig();
warnOnOldSeason();
const oldCache = readJson(CACHE_PATH);
const oldLeagues = new Map(
  (oldCache?.leagues ?? []).map((league) => [league.leagueId, league]),
);
// Club id → logo URL on the BSM, filled while reading the tables
const logoSources = new Map();

const leagues = await mapLimit(config.leagues, PARALLEL, async (entry) => {
  const old = oldLeagues.get(entry.leagueId);
  try {
    const league = await fetchLeague(entry, old);
    console.log(
      `BSM ${entry.leagueId} (${entry.label}): ${league.games.length} games` +
        (league.standings ? `, ${league.standings.length} table rows` : ""),
    );
    return league;
  } catch (error) {
    console.warn(
      `::warning::BSM ${entry.leagueId} (${entry.label}): ${error.message} – ` +
        (old ? `keeping data from ${old.fetchedAt}` : "no old data"),
    );
    if (old) {
      // Config fields may have changed even though BSM failed
      return { ...old, label: entry.label, team: entry.team };
    }
    return {
      leagueId: entry.leagueId,
      name: entry.label,
      label: entry.label,
      team: entry.team,
      fetchedAt: null,
      standings: null,
      games: [],
    };
  }
});

const cache = {
  builtAt: new Date().toISOString(),
  season: config.season,
  leagues,
  logos: await updateLogos(oldCache?.logos ?? {}),
};
writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + "\n");

const changed = !isDeepStrictEqual(
  withoutTimestamps(cache),
  withoutTimestamps(oldCache),
);
console.log(`BSM cache written, data ${changed ? "changed" : "unchanged"}.`);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
}

// --- fetching ---------------------------------------------------------------

async function fetchLeague(entry, old) {
  const [table, matches] = await Promise.all([
    entry.standings
      ? getJson(`/leagues/${entry.leagueId}/table.json`)
      : Promise.resolve(null),
    getJson(`/matches.json?filter[leagues][]=${entry.leagueId}&compact=true`),
  ]);

  if (
    table &&
    (!Array.isArray(table.rows) || table.league_id !== entry.leagueId)
  ) {
    throw new Error("table.json has an unexpected shape");
  }
  if (
    !Array.isArray(matches) ||
    matches.some((m) => m?.id == null || !m.time || !m.state)
  ) {
    throw new Error("matches.json has an unexpected shape");
  }

  // Only Bretten games: the pages show nothing else, and it keeps the
  // committed cache small
  const games = matches
    .map((match) => normaliseGame(match))
    .filter((game) => game.isUs)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));

  // A league that suddenly has no Bretten games is more likely a BSM hiccup
  // than real data
  if (old?.games.length && !games.length) {
    throw new Error("no Bretten games any more");
  }

  const forms = teamForms(matches);
  return {
    leagueId: entry.leagueId,
    name: table?.league_name ?? matches[0]?.league?.name ?? entry.label,
    label: entry.label,
    team: entry.team,
    fetchedAt: new Date().toISOString(),
    standings: table ? table.rows.map((row) => normaliseRow(row, forms)) : null,
    games,
  };
}

// Last results per league entry, from all games of the league (the table
// itself only has the streak). League entry id → ["W", "L", …], oldest first.
function teamForms(matches) {
  const results = new Map();
  const add = (entryId, runsFor, runsAgainst, match) => {
    if (entryId == null) return;
    const team = results.get(entryId) ?? [];
    team.push({
      time: Date.parse(toIso(match.time)),
      result: runsFor > runsAgainst ? "W" : runsFor < runsAgainst ? "L" : "T",
    });
    results.set(entryId, team);
  };
  for (const match of matches) {
    if (
      !RATED_STATES.has(match.state) ||
      match.home_runs == null ||
      match.away_runs == null
    ) {
      continue;
    }
    add(match.home_league_entry?.id, match.home_runs, match.away_runs, match);
    add(match.away_league_entry?.id, match.away_runs, match.home_runs, match);
  }
  return new Map(
    [...results].map(([entryId, team]) => [
      entryId,
      team
        .sort((a, b) => a.time - b.time)
        .slice(-FORM_GAMES)
        .map((r) => r.result),
    ]),
  );
}

// --- logos ------------------------------------------------------------------

// Downloads the logo of every club seen in a table when it is new or BSM has
// a newer one (the URL carries a timestamp). Returns club id → file path,
// keeping old logos when a download fails.
async function updateLogos(oldLogos) {
  mkdirSync(LOGO_DIR, { recursive: true });
  const logos = {};
  // Only clubs still in a table; old ones drop out of the manifest
  const ids = new Set(
    leagues
      .flatMap((l) => (l.standings ?? []).flatMap((r) => r.clubIds ?? []))
      .map(String),
  );
  await mapLimit([...ids], PARALLEL, async (id) => {
    const old = oldLogos[id];
    const source = logoSources.get(Number(id));
    const file = `/images/bsm-logos/${id}.webp`;
    const onDisk = existsSync(new URL(`${id}.webp`, LOGO_DIR));
    if (old && onDisk && (!source || source === old.source)) {
      logos[id] = old;
      return;
    }
    if (!source) return;
    try {
      const image = await getBinary(source);
      const webp = await sharp(image)
        .resize(LOGO_SIZE, LOGO_SIZE, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ quality: 85 })
        .toBuffer();
      writeFileSync(new URL(`${id}.webp`, LOGO_DIR), webp);
      logos[id] = { file, source };
    } catch (error) {
      console.warn(`::warning::BSM logo of club ${id}: ${error.message}`);
      if (old && onDisk) logos[id] = old;
    }
  });
  // Stable key order so the cache only changes when a logo does
  return Object.fromEntries(
    Object.entries(logos).sort(([a], [b]) => Number(a) - Number(b)),
  );
}

async function getBinary(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "bretten-kangaroos.net build" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || !type.startsWith("image/")) {
    throw new Error(`HTTP ${response.status} (${type || "no type"})`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function getJson(path) {
  let lastError;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** attempt);
    try {
      const response = await fetch(BASE_URL + path, {
        headers: {
          Accept: "application/json",
          "User-Agent": "bretten-kangaroos.net build",
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      // BSM answers 403 with an empty text/html body, so check both
      const type = response.headers.get("content-type") ?? "";
      if (!response.ok || !type.includes("json")) {
        throw new Error(
          `HTTP ${response.status} (${type || "no type"}) for ${path}`,
        );
      }
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

// --- normalising ------------------------------------------------------------

function normaliseRow(row, forms) {
  const team = row.league_entry?.team;
  const clubs = team?.clubs ?? [];
  for (const club of clubs) {
    if (club.logo_url) logoSources.set(club.id, club.logo_url);
  }
  return {
    rank: Number.parseInt(row.rank, 10) || null,
    team: row.team_name,
    short: row.short_team_name ?? team?.short_name ?? "",
    isUs: isOurTeam(team),
    games: row.match_count,
    wins: row.wins_count,
    losses: row.losses_count,
    pct: row.quota,
    gamesBehind: row.games_behind,
    streak: row.streak ?? "",
    outOfCompetition:
      Boolean(row.not_competing) || /\(a\.\s?K\.\)/.test(row.team_name),
    form: forms.get(row.league_entry?.id) ?? [],
    clubIds: clubs.map((club) => club.id),
  };
}

function normaliseGame(match) {
  const home = normaliseGameTeam(match.home_team_name, match.home_league_entry);
  const away = normaliseGameTeam(match.away_team_name, match.away_league_entry);
  const homeRuns = match.home_runs ?? null;
  const awayRuns = match.away_runs ?? null;
  const isUs = home.isUs || away.isUs;

  let result = null;
  if (
    isUs &&
    match.state === "played" &&
    homeRuns != null &&
    awayRuns != null
  ) {
    const ours = home.isUs ? homeRuns : awayRuns;
    const theirs = home.isUs ? awayRuns : homeRuns;
    result = ours > theirs ? "W" : ours < theirs ? "L" : "T";
  }

  return {
    id: match.id,
    number: match.match_id ?? "",
    start: toIso(match.time),
    state: match.state,
    stateLabel: match.human_state ?? match.state,
    home,
    away,
    homeRuns,
    awayRuns,
    field: match.field
      ? {
          name: match.field.name ?? "",
          city: match.field.city ?? "",
          street: match.field.street ?? "",
        }
      : null,
    isUs,
    isHome: home.isUs,
    result,
    scoresheetUrl: match.scoresheet_url || null,
  };
}

function normaliseGameTeam(name, leagueEntry) {
  const team = leagueEntry?.team;
  return {
    name: name ?? team?.name ?? "",
    short: team?.short_name ?? "",
    isUs: isOurTeam(team),
  };
}

function isOurTeam(team) {
  return (team?.clubs ?? []).some((club) => club.id === config.clubId);
}

// "2026-10-17 13:00:00 +0200" → "2026-10-17T13:00:00+02:00"
function toIso(time) {
  const m = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/.exec(
    time,
  );
  return m ? `${m[1]}T${m[2]}${m[3]}:${m[4]}` : time;
}

// --- helpers ----------------------------------------------------------------

function readConfig() {
  const config = readJson(CONFIG_PATH);
  const valid =
    Number.isInteger(config?.clubId) &&
    Number.isInteger(config?.season) &&
    Array.isArray(config?.leagues) &&
    config.leagues.every(
      (l) =>
        Number.isInteger(l.leagueId) &&
        typeof l.team === "string" &&
        typeof l.label === "string" &&
        typeof l.standings === "boolean",
    );
  if (!valid) {
    console.error("::error::src/data/bsm-leagues.json is missing or invalid");
    process.exit(1);
  }
  return config;
}

// From March on the new season's leagues exist; scripts/reminders.mjs also
// opens an issue for it
function warnOnOldSeason() {
  const now = new Date();
  if (now.getFullYear() > config.season && now.getMonth() >= 2) {
    console.warn(
      `::warning::src/data/bsm-leagues.json still has season ${config.season} – ` +
        `add the ${now.getFullYear()} league IDs (docs/bsm-api.md)`,
    );
  }
}

function readJson(url) {
  try {
    return JSON.parse(readFileSync(url, "utf8"));
  } catch {
    return null;
  }
}

function withoutTimestamps(cache) {
  if (!cache) return null;
  return {
    season: cache.season,
    leagues: cache.leagues.map(({ fetchedAt, ...rest }) => rest),
    logos: cache.logos ?? {},
  };
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  };
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
