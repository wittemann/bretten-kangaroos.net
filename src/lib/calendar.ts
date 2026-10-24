// iCalendar files from the BSM games: one feed per team plus one for all
// teams (/kalender/<team>.ics, /kalender/alle.ics) and one file per game
// (/kalender/spiel/<id>.ics). Built at build time, see design.md "Spielplan".
import { leaguesFor, teamName, type GameWithLeague } from "@/lib/bsm";

// Games have no end time in the BSM; three hours fit a baseball game
const GAME_HOURS = 3;

export const isCanceled = (game: GameWithLeague) =>
  game.state === "canceled" || game.state === "cancelled";

export const gamesFor = (team?: string): GameWithLeague[] =>
  leaguesFor(team)
    .flatMap((league) => league.games.map((game) => ({ ...game, league })))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));

// "Herren: Bretten Kangaroos – Heilbronn Pirates (3:12)"
export const gameTitle = (game: GameWithLeague) => {
  const score =
    game.state === "played" && game.homeRuns != null && game.awayRuns != null
      ? ` (${game.homeRuns}:${game.awayRuns})`
      : "";
  const prefix = isCanceled(game) ? "Abgesagt – " : "";
  return `${prefix}${teamName(game.league)}: ${game.home.name} – ${game.away.name}${score}`;
};

export const gameLocation = (game: GameWithLeague) =>
  game.field
    ? [game.field.name, game.field.street, game.field.city].filter(Boolean).join(", ")
    : "";

const gameDetails = (game: GameWithLeague) =>
  [game.league.label, game.number && `Spiel ${game.number}`, game.isHome ? "Heimspiel" : "Auswärtsspiel"]
    .filter(Boolean)
    .join(" · ");

// 20260412T090000Z
const icsDate = (date: Date) =>
  date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const gameEnd = (game: GameWithLeague) =>
  new Date(Date.parse(game.start) + GAME_HOURS * 3600 * 1000);

const escapeText = (text: string) =>
  text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// Lines longer than 75 bytes are folded (RFC 5545 3.1), never inside a UTF-8 character
const encoder = new TextEncoder();
function fold(line: string) {
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function eventLines(game: GameWithLeague, stamp: string, siteUrl: string) {
  const location = gameLocation(game);
  return [
    "BEGIN:VEVENT",
    `UID:bsm-${game.id}@bretten-kangaroos.net`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${icsDate(new Date(game.start))}`,
    `DTEND:${icsDate(gameEnd(game))}`,
    `SUMMARY:${escapeText(gameTitle(game))}`,
    location && `LOCATION:${escapeText(location)}`,
    `DESCRIPTION:${escapeText(gameDetails(game))}`,
    `URL:${siteUrl}/spielplan`,
    `STATUS:${isCanceled(game) ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
  ].filter(Boolean) as string[];
}

export function calendar(name: string, games: GameWithLeague[], siteUrl: string) {
  const stamp = icsDate(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bretten Kangaroos//Spielplan//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
    "X-WR-TIMEZONE:Europe/Berlin",
    // ask subscribed calendars to check back every few hours
    "REFRESH-INTERVAL;VALUE=DURATION:PT3H",
    "X-PUBLISHED-TTL:PT3H",
    ...games.flatMap((game) => eventLines(game, stamp, siteUrl)),
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

// Prefilled "add event" link for Google Calendar
export const googleEventUrl = (game: GameWithLeague) => {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: gameTitle(game),
    dates: `${icsDate(new Date(game.start))}/${icsDate(gameEnd(game))}`,
    details: gameDetails(game),
    location: gameLocation(game),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
};

export const icsResponse = (body: string) =>
  new Response(body, { headers: { "Content-Type": "text/calendar; charset=utf-8" } });
