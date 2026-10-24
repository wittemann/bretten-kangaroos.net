// Standings and games from the BSM, read from src/data/bsm-cache.json, which
// scripts/fetch-bsm.mjs writes before every build. Shapes: docs/bsm-api.md.
import cache from "@/data/bsm-cache.json";
import config from "@/data/bsm-leagues.json";

export type StandingRow = {
  rank: number | null;
  team: string;
  short: string;
  isUs: boolean;
  games: number;
  wins: number;
  losses: number;
  pct: string;
  gamesBehind: string;
  streak: string;
  outOfCompetition: boolean;
  // From the league's games: last five rated results, oldest first.
  // Missing in caches from before.
  form?: ("W" | "L" | "T")[];
  clubIds?: number[];
};

export type GameTeam = { name: string; short: string; isUs: boolean };

export type Game = {
  id: number;
  number: string;
  start: string;
  state: string;
  stateLabel: string;
  home: GameTeam;
  away: GameTeam;
  homeRuns: number | null;
  awayRuns: number | null;
  field: { name: string; city: string; street: string } | null;
  isUs: boolean;
  isHome: boolean;
  result: "W" | "L" | "T" | null;
  scoresheetUrl: string | null;
};

export type LeagueData = {
  leagueId: number;
  name: string;
  label: string;
  team: string;
  fetchedAt: string | null;
  standings: StandingRow[] | null;
  games: Game[];
};

export type GameWithLeague = Game & { league: LeagueData };

const TIME_ZONE = "Europe/Berlin";

export const leagues = (cache.leagues ?? []) as LeagueData[];

const logos = ((cache as { logos?: Record<string, { file: string }> }).logos ??
  {}) as Record<string, { file: string }>;

// Self-hosted logos of a table row (two for an SG); our own row uses the crest
export const rowLogos = (row: StandingRow) =>
  row.isUs
    ? ["/images/crest.png"]
    : (row.clubIds ?? []).flatMap((id) => logos[id]?.file ?? []);

// "Herren – Bezirksliga" → "Herren"
export const teamName = (league: LeagueData) => league.label.split(" – ")[0];

// Teams in config order, for the filter on the games page
export const teams = [
  ...new Map(leagues.map((l) => [l.team, teamName(l)])).entries(),
].map(([slug, name]) => ({ slug, name }));

export const leaguesFor = (team?: string) =>
  leagues.filter((l) => !team || l.team === team);

// Leagues configured with a table (the cache has `standings: null` both for
// leagues without a table and for tables BSM couldn't deliver)
export const standingsFor = (team?: string) =>
  leaguesFor(team).filter(
    (l) => config.leagues.find((c) => c.leagueId === l.leagueId)?.standings,
  );

// Upcoming games: planned or cancelled, not before today (cancelled ones stay
// visible, struck through). Everything else (played, forfeits, or planned in
// the past without a score) is a result.
// "Now" is the build time – fine with the hourly weekend rebuilds.
export function splitGames(team?: string, now = new Date()) {
  const startOfToday = berlinDateKey(now);
  const all: GameWithLeague[] = leaguesFor(team).flatMap((league) =>
    league.games.map((game) => ({ ...game, league })),
  );
  const isUpcoming = (g: Game) =>
    ["planned", "canceled", "cancelled"].includes(g.state) &&
    berlinDateKey(new Date(g.start)) >= startOfToday;

  const byStart = (a: Game, b: Game) =>
    Date.parse(a.start) - Date.parse(b.start);
  return {
    upcoming: all.filter(isUpcoming).sort(byStart),
    results: all.filter((g) => !isUpcoming(g)).sort((a, b) => byStart(b, a)),
  };
}

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  timeZone: TIME_ZONE,
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("de-DE", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

// "Sa., 17.10.2026"
export const formatDate = (iso: string) => dateFormatter.format(new Date(iso));
// "13:00"
export const formatTime = (iso: string) => timeFormatter.format(new Date(iso));
// "17.10.2026, 13:00 Uhr"
export const formatDateTime = (iso: string) =>
  `${formatDate(iso).replace(/^\S+\s/, "")}, ${formatTime(iso)} Uhr`;

// YYYY-MM-DD in German time, comparable as a string
function berlinDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(date);
}
