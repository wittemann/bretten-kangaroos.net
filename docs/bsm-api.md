# BSM API – findings and design (WP4)

Research for WP4 in [`todo.md`](todo.md). All requests below were run for real on **2026-10-22** against
`https://bsm.baseball-softball.de` without any API key, cookie or special header.

## TL;DR

- **No API key is needed** for the two endpoints the site needs: league standings (`leagues/{id}/table.json`)
  and league matches (`matches.json?filter[leagues][]=…&compact=true`).
- Everything else (league lists, clubs, teams, single matches, full non-compact match data) answers **403** without a key.
  We don't need any of it, so the key stays unused for now.
- Bretten Kangaroos = **club 398**. Season 2026 has **6 Bretten teams/leagues** (table below).
- Leagues get **new IDs every season**, so the league list is config (one small JSON file in the repo) that has to be updated once a year.
- Build-time fetch writes a committed cache file; if BSM fails, the build uses the last good cache and never fails.

## Access test

| Request | Without key |
|---|---|
| `GET /leagues/{id}/table.json` | **200** JSON |
| `GET /matches.json?filter[leagues][]={id}&compact=true` | **200** JSON |
| `GET /matches.json?filter[seasons][]=2026&compact=true` | **200** JSON, but 16.9 MB / ~25 s (all of Germany) |
| `GET /matches.json?filter[leagues][]={id}` (not compact) | 403 |
| `GET /leagues.json`, `/leagues/{id}.json`, `/leagues/{id}/matches.json` | 403 |
| `GET /clubs.json`, `/clubs/398.json`, `/clubs/398/teams.json`, `/clubs/398/matches.json` | 403 |
| `GET /teams/{id}.json`, `/matches/{id}.json`, `/league_groups.json` | 403 |
| `GET /matches.json?filter[clubs][]=398…` | filter ignored → full dump, timed out |
| `GET /matches.json?filter[teams][]=…` | 404 after ~14 s |

Watch out: adding an **invalid** `api_key=` to a public endpoint turns it into 403. So if a key is ever added, it must be valid,
otherwise leave it off.

403 responses are `text/html` with an empty body, not JSON – the fetch code must check the status and content type.

## IDs

**Club:** `398` – "Kangaroos", acronym `BRK`, short name "Bretten Kangaroos",
logo `https://bsm.baseball-softball.de/system/clubs/logos/000/000/398/thumb/Oldschool_Vector_MIX_002_transpar.png?1713003060`

**Home field:** `293` – "Kangaroos Ballpark", Häringsäcker 1, Bretten (owned by club 398).
(A second field entry `487` with the same name/address belongs to club 843 – ignore.)

**Season 2026 teams** (found by scanning the full 2026 match dump for club 398):

| League ID | League (acronym) | Team ID | League entry ID | Bretten games | Table rank (22.10.) |
|---|---|---|---|---|---|
| 6350 | Bezirksliga Herren (`BEZLH I`) | 23915 | 46438 | 8 | 4. of 5 |
| 6353 | Jugend Verbandsliga (`JUGVL`) | 23876 | 46452 | 9 | 3. of 4 |
| 6358 | Schüler Landesliga (`SCHLL I`) | 23880 | 46478 | 24 | 1. of 5 |
| 6346 | Softball Schüler (`SBSCH`) | 23879 | 46410 | 2 | 10. of 12 |
| 6343 | T-Ball (`TB`) | 23875 | 46372 | 8 (6 still `planned`) | 16. of 16 |
| 6366 | Baseball Pokal (`PH`) | 23914 | 46519 | 1 | 12. of 22 |

Notes:
- **Decision (Martin, 22.10.):** show the teams from the current site's menu – Herren, Jugend, Schüler, T-Ball.
  The Pokal goes with Herren as games only, no table. Softball Schüler (6346) is left out: the old site has no page for it
  (its "Softball" page is the adult slow-pitch team, which plays no BSM league). BKIL is club-internal, not in BSM.
  T-Ball has tournament days whose last games are still `planned` without a score.
- In every league Bretten has exactly one team; the team is identified in match data by club ID 398 in
  `home_league_entry.team.clubs[]` / `away_league_entry.team.clubs[]` (works for SGs with several clubs too).
- League `6349` (Landesliga Herren) only showed up because another team played at the Kangaroos Ballpark – no Bretten team.

### Finding the IDs for a new season

`leagues.json` needs a key, so for a new season do this once (manual script, not part of the build):

```bash
curl -s -g "https://bsm.baseball-softball.de/matches.json?filter[seasons][]=2027&compact=true" -o matches-2027.json
```

then list every `league.id` where a team has club 398 (≈ 16 MB, 25–60 s). Alternatively look the league up on the BSM website.
Put the result into `src/data/bsm-leagues.json` (see below).

## Endpoints

Base: `https://bsm.baseball-softball.de`. `-g` stops curl from treating `[]` as a glob.

### 1. Standings

```bash
curl -s "https://bsm.baseball-softball.de/leagues/6358/table.json"
```

~2–11 KB, ~0.1 s. Weak `ETag`, `cache-control: max-age=0, private, must-revalidate`. Trimmed sample:

```json
{
  "league_id": 6358,
  "league_name": "Schüler Landesliga",
  "season": 2026,
  "rows": [
    {
      "rank": "1.",
      "not_competing": "",
      "team_name": "Bretten Kangaroos",
      "short_team_name": "BRK",
      "match_count": 24,
      "wins_count": 19,
      "losses_count": 5,
      "quota": ".792",
      "games_behind": "0",
      "streak": "L2",
      "league_entry": {
        "id": 46478,
        "team": {
          "id": 23880,
          "name": "Bretten Kangaroos",
          "short_name": "BRK",
          "clubs": [
            { "type": "Club", "id": 398, "name": "Kangaroos", "acronym": "BRK",
              "short_name": "Bretten Kangaroos", "logo_url": "https://bsm.baseball-softball.de/system/clubs/logos/…" }
          ]
        }
      }
    },
    { "rank": "2.", "team_name": "Remchingen Racoons", "…": "…" }
  ]
}
```

Quirks: `rank` is a string with a trailing dot (`"1."`), equal ranks are not merged (rank 1 and 2 above have the same record),
`quota` and `games_behind` are strings, "außer Konkurrenz" teams carry `(a.K.)` in `team_name`.

### 2. Matches of a league

```bash
curl -s -g "https://bsm.baseball-softball.de/matches.json?filter[leagues][]=6358&compact=true"
```

Returns all games of the league season (the 6 Bretten leagues: 46–270 KB each, ~0.1–0.3 s). Several leagues in one call
work: `filter[leagues][]=6358&filter[leagues][]=6350`. `compact=true` is **required** (without it: 403).

Optional `filter[gamedays][]=` with `previous` | `current` | `next` | `any` (default `any`). `current`/`next` return `[]`
outside the season; `previous` returned the last game day. We don't need it – fetching the whole league is small enough
and lets us compute "last results" and "next games" ourselves.

Trimmed sample (one Bretten game; logos, umpire/scorer and empty fields removed):

```json
[
  {
    "id": 63434,
    "match_id": "21.013",
    "time": "2026-10-17 13:00:00 +0200",
    "state": "played",
    "human_state": "gespielt",
    "home_runs": 19,
    "away_runs": 14,
    "league": { "id": 6353, "name": "Jugend Verbandsliga", "acronym": "JUGVL",
                "sport": "baseball_male", "human_sport": "Baseball", "human_sport_short": "BB", "sort": 50 },
    "scoresheet_url": "https://bsm.baseball-softball.de/matches/63434/combined_scoresheets/Spiel-21-punkt-013.pdf",
    "field": { "id": 293, "name": "Kangaroos Ballpark", "street": "Häringsäcker 1",
               "postal_code": "75015", "city": "Bretten", "club": { "type": "Club", "id": 398 } },
    "livestream_url": "",
    "home_team_name": "Bretten Kangaroos",
    "home_league_entry": { "id": 46452, "team": { "id": 23876, "name": "Bretten Kangaroos", "short_name": "BRK",
                           "clubs": [ { "id": 398, "name": "Kangaroos", "acronym": "BRK", "short_name": "Bretten Kangaroos" } ] } },
    "away_team_name": "Stuttgart Reds",
    "away_league_entry": { "id": 46454, "team": { "id": 24072, "name": "Stuttgart Reds", "short_name": "STU",
                           "clubs": [ { "id": 436, "name": "Reds", "acronym": "STU", "short_name": "Stuttgart Reds" } ] } },
    "statistics_published": false
  }
]
```

Each club object also carries `type` and `logo_url`; each match also has `umpire_selection`, `scorer_selection`
(club objects), `umpire_assignments`, `scorer_assignments`, `easyscore_id`, `second_league`, `extra_rating_league*` and
`scoresheet_file_name/_content_type/_updated_at`.

Field notes:
- `time` is local time with offset (`+0200` / `+0100`), parse it as is.
- `state` values seen in 2026: `played`, `planned`, `canceled`, `no_show`, `forfeit`, `retreat`, `manually_valued`,
  `exclusion`. `human_state` is the German label to display. `home_runs`/`away_runs` are `null` while `planned`.
- `match_id` is the league's game number (`"26.010-1"`, `"99-008"`) – a string, not unique across leagues; `id` is unique.
- `livestream_url` is `null` or `""` when unset; `field` may be `null`; a doubleheader is two matches with suffixes `-1`/`-2`.
- `scoresheet_url` links to the PDF score sheet when uploaded – worth a link on the results page.

## Proposed data model

Config, committed and edited once per season (could later move into Pages CMS / the team content from WP1):

```jsonc
// src/data/bsm-leagues.json
{
  "clubId": 398,
  "season": 2026,
  "leagues": [
    { "leagueId": 6350, "team": "herren",  "label": "Herren – Bezirksliga",       "standings": true },
    { "leagueId": 6353, "team": "jugend",  "label": "Jugend – Verbandsliga",      "standings": true },
    { "leagueId": 6358, "team": "schueler","label": "Schüler – Landesliga",       "standings": true },
    { "leagueId": 6343, "team": "tball",   "label": "T-Ball",                     "standings": true },
    { "leagueId": 6366, "team": "herren",  "label": "Baseball Pokal",             "standings": false }
  ]
}
```

`team` is the slug of the team page from WP1, so a team page can pull "its" standings and games.

Normalised data the pages consume (what the fetch step writes, TypeScript shape):

```ts
type BsmData = {
  builtAt: string;              // ISO time of the fetch run (per-league success time is leagues[].fetchedAt)
  season: number;
  leagues: LeagueData[];
};

type LeagueData = {
  leagueId: number;
  name: string;                 // from BSM, e.g. "Schüler Landesliga"
  label: string;                // from config
  team: string;                 // team page slug from config
  fetchedAt: string;            // when this league was last fetched successfully
  standings: StandingRow[] | null;
  games: Game[];                // Bretten games only, sorted by time (keeps the committed cache ~50 KB)
};

type StandingRow = {
  rank: number;                 // "1." → 1
  team: string;                 // team_name
  short: string;
  isUs: boolean;                // clubs contain 398
  games: number; wins: number; losses: number;
  pct: string;                  // ".792" – keep the baseball formatting
  gamesBehind: string;          // "0", "4.5"
  streak: string;               // "W14"
  outOfCompetition: boolean;    // "(a.K.)" in name or not_competing set
};

type Game = {
  id: number;                   // BSM id
  number: string;               // match_id
  start: string;                // ISO with offset
  state: string;                // raw state
  stateLabel: string;           // human_state
  home: GameTeam; away: GameTeam;
  homeRuns: number | null; awayRuns: number | null;
  field: { name: string; city: string; street: string } | null;
  isUs: boolean;                // Bretten plays in this game
  isHome: boolean;              // Bretten is the home team
  result: "W" | "L" | "T" | null; // from Bretten's view, only when played
  scoresheetUrl: string | null;
};

type GameTeam = { name: string; short: string; isUs: boolean };
```

Not hotlinked: showing logos straight from the BSM server would send visitors' IP addresses to a third party.

### Additions (2026-10-24): logos and form

- **Logos:** `fetch-bsm.mjs` downloads the `logo_url` of every club in a table row (two for an SG), shrinks it to a
  64×64 WebP in `public/images/bsm-logos/<clubId>.webp` and lists it in `logos` of the cache
  (`{ "<clubId>": { file, source } }`). A logo is downloaded again only when its BSM URL changes (it carries a timestamp);
  a failed download keeps the old file. Our own row shows `public/images/crest.png`. The deploy Action commits the logo
  folder together with the cache.
- **Form** is computed from all games of the league (the table only has the streak), per league entry: the last five
  results (`W`/`L`/`T`, oldest first) of all rated games (`played`, `forfeit`, `no_show`, `manually_valued`), so it
  agrees with BSM's W/L and streak. Checked 2026-10-24: wins/losses counted this way equal the BSM tables except ties,
  which BSM counts as half a win.
- Each row also carries `clubIds`. `StandingRow` gains `form` and `clubIds`.
- Runs scored/allowed and the run difference were tried and left out (Martin, 24.10.: not relevant).
- `/tabellen` shows the logo and the Form (from md) – on the phone it stays Pl., Team, S, N, Quote.
  The small table on team pages shows the logo too.

Pages (built: `/tabellen`, `/spielplan`, components `BsmStandings.astro` / `BsmGames.astro`, helpers in `src/lib/bsm.ts`):
- **Standings page:** one table per league with `standings: true`, Bretten row highlighted, "Stand: {fetchedAt}" below.
- **Games page:** Bretten games only (`isUs`), grouped "Nächste Spiele" (`planned`, today or later) and "Ergebnisse"
  (played, newest first), filter by team; home games marked; link to score sheet when present.
- Team pages from WP1 can reuse both, filtered by `team`.
- "Now" is the build time – fine because of the hourly weekend rebuilds (WP6).

## Build-time fetch design

Goal: fresh data on every build, the last good data when BSM is down or returns garbage, and **never** a failed build because of BSM.

### Where the data lives

- `src/data/bsm-cache.json` – the normalised `BsmData` above, **committed to the repo**. It is the fallback and the
  only thing pages read.
- No reliance on the GitHub Actions cache for correctness: it is evicted after 7 days without use and is scoped per
  branch, so in the winter break it would be empty exactly when we need it. Committing the file guarantees a fallback
  for every build, including local builds and fresh clones.

### Flow

A small Node script `scripts/fetch-bsm.mjs`, run before `astro build` (`"build": "node scripts/fetch-bsm.mjs && astro build"`).
Doing it as a separate step (instead of inside an Astro loader) keeps the network logic testable on its own and
keeps `astro dev` offline-friendly.

```
read config (bsm-leagues.json) + existing cache (bsm-cache.json, may be missing)
for each league in config, in parallel (max 3 at a time):
    fetch table.json      (only if standings: true)
    fetch matches.json?filter[leagues][]=ID&compact=true
    each request: 15 s timeout, 2 retries with backoff, User-Agent "bretten-kangaroos.net build"
    validate: status 200, content-type JSON, parses, shape check
              (table: rows is an array, league_id matches; matches: array, every item has id/time/state,
               and at least one game of club 398 if the old cache had one)
    ok   → normalise, set fetchedAt = now, use new data
    fail → log a warning, keep this league's entry from the old cache unchanged (old fetchedAt)
           (no old entry → standings null, games [] → page shows "Daten zurzeit nicht verfügbar")
write bsm-cache.json only if something changed (compare without builtAt/fetchedAt to avoid noisy commits)
always exit 0 (unless the config itself is broken)
```

Per-league fallback means one broken league never wipes the others.

### Persisting the new data

- The deploy Action (WP3/WP6) runs the script, builds, deploys, and then commits `src/data/bsm-cache.json` back
  to `main` when it changed (`git diff --quiet || git commit … && git push`, with `[skip ci]` in the message so the
  commit doesn't trigger another deploy). That keeps the committed fallback at most one build old.
- Commit author: the Actions bot (`github-actions[bot]`). Needs `permissions: contents: write` in the workflow.
- Volume: only commits when results actually change, i.e. a handful per weekend in season, none in winter.
- Alternative if bot commits on `main` are unwanted: keep the cache only in `actions/cache` and accept that a cold
  cache plus BSM outage shows the "nicht verfügbar" message. Recommendation: commit it.

### Season change

Once a year: run the discovery from "Finding the IDs for a new season", update `bsm-leagues.json`. Until then the old
season's data stays on the pages (the cache keeps working). The shape check above also warns when a configured league
suddenly returns 0 games.

### Load on BSM

6 leagues × 2 small requests per build ≈ 12 requests, ~1 MB in total; at most 15 builds per weekend day. Never fetch
the 16 MB season dump in the build.

## Open points

- BSM has no documented API contract/stability promise for the keyless endpoints; if they start answering 403 the
  fallback keeps the site up and the key can be added as a GitHub secret (`BSM_API_KEY`, sent as `api_key=` query
  parameter) without changing the design.
