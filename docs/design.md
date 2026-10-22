# Design – decisions (WP2)

Worked out together in Claude Design: **[Kangaroos Website Design](https://claude.ai/artifact/RXnS8HFKzh8UexTVsKQrca)**
(private canvas, share it from the canvas' Share menu if others should see it). The canvas is the visual reference;
this file records what was decided so the implementation doesn't depend on it.

Chosen direction: **"Clubhaus"** – green header with a faint pinstripe (from the crest), white pages, rust as the one accent.
Directions "Anzeigetafel" and "Kreide & Rasen" were dropped.

## Brand

| Token | Value | Source | Use |
|---|---|---|---|
| Waldgrün | `#23461E` | crest ring | header, footer, dark areas, active filter |
| Trikotgrün | `#1E7B3C` | jerseys | links, "Sieg" |
| Hellgrün | `#80B058` | inner crest ring | lines only, never text |
| Känguru-Rost | `#A3500F` | the kangaroo | primary button (Probetraining, Team anmelden), labels |
| Dunkles Rost | `#8A3A0A` | – | "Niederlage" (instead of red) |
| Kreide | `#F7F6F1` | – | page title bands, quiet backgrounds |
| Tinte | `#1D231B` | – | text; secondary text stays `#4A4A4A` like the old site |
| Linie | `#E3E3DE` | – | borders, dividers |

- Logos: the round crest (BSM, `Oldschool_Vector_MIX_002_transpar.png`) is the main logo – header on a white disc,
  footer, favicon. The "Kangaroos" script from the old header only works on dark backgrounds.
- Fonts: **Barlow Condensed** (600/700, uppercase) for headings, labels, buttons and scores; **Barlow** (400–600) for text.
- Type scale: page title 56 px (40 px on phones, one shared style on every subpage), section 32, tile 24, intro 20,
  text 17, label 15 (uppercase, letter-spaced, rust).
- Radius 4 px (buttons) / 6 px (cards); pill buttons for filters; touch targets ≥ 44 px.
- No team logos from BSM (hotlinking would send visitor IPs to a third party). No embedded Google Maps for the same reason.

## Navigation

- Main menu: `Aktuelles · Teams · Spielplan · Tabellen · Verein ▾ · [Probetraining]` – Probetraining is the only coloured button.
- Only **Verein** opens a dropdown: Ballpark, Vereinsgeschichte, Förderverein, Intra League (BKIL), Sponsoren, Downloads, Kontakt,
  each with a one-line description, plus an address box with "Anfahrt".
- **Teams** has no dropdown: `/teams` is the overview, and every team page has a team switcher (pill links to the sibling team pages).
- Phone: menu button → full-screen green menu, Probetraining on top, then Aktuelles/Spielplan/Tabellen, teams as tiles, Verein list.
- Filter/switcher rows (Spielplan, Aktuelles, team pages) always sit **below** the page title.
- Footer: sponsor strip, address, Verein links, Kontakt, Instagram/Facebook, Impressum/Datenschutz.

## Sitemap

```
/                       Startseite
/news, /news/<slug>     Aktuelles, Beitrag
/teams                  Teams-Übersicht
/teams/<team>           herren, jugend, schueler, t-ball, softball
/spielplan, /tabellen   BSM data
/probetraining          all training times, generated from the team files
/xmas-ball              tournament infos + sign-up form, only while a tournament is on
/ballpark, /vereinsgeschichte, /foerderverein, /bkil, /sponsoren, /downloads, /kontakt
/impressum, /datenschutz
```

BKIL is not a team, just a text page under Verein. Old URLs that move get 301 redirects (WP7): `/herren/` → `/teams/herren`
etc., the long Förderverein slug → `/foerderverein`, `/YYYY/MM/DD/<slug>/` → `/news/<slug>`.

## Page types and where content lives

| Page | Content (Pages CMS) | Template |
|---|---|---|
| Startseite | `content/home.md` (hero text, tournament teaser) | `index.astro` – results, news, teams, sponsors pulled in |
| Aktuelles / Beitrag | `content/news/*.md` | `news/index.astro`, `news/[slug].astro` |
| Team pages | `content/teams/<team>.md`: ages, league, image, badge, training (season/days/time/place), coaches, email + body. BSM league IDs stay in `src/data/bsm-leagues.json` (same team slugs) | `teams/[slug].astro` |
| Teams, Probetraining | – (built from the team files) | `teams/index.astro`, `probetraining.astro` |
| Spielplan, Tabellen | – (BSM cache) | already built |
| Sponsoren | `content/sponsors/*.md` | already built |
| Text pages | `content/pages/<page>.md` (optional "Dateien" list for downloads, PDFs in `public/files`) | `[regular].astro`; `## 1992 – Title` headings render as a year column (Vereinsgeschichte) |
| Kontakt | `content/kontakt.md`, contacts as a front matter list | own layout |
| Xmas-Ball | `content/xmas-ball.md`, `active` switches the page and the homepage teaser on | own layout with the sign-up form |

News details:
- Quotes (`>`) render as the green quote box.
- An optional "Zahlen" list field (number + label) renders the stats box after the image – no shortcodes in the body.
- The team select in `.pages.yml` must offer all teams (Schüler and T-Ball are missing today).
- Posts of teams that no longer exist have no `team` (they show under "Alle") but an optional `old_team` label, see
  [`wordpress-inventory.md`](wordpress-inventory.md).

## Spielplan in season + calendar

- Upcoming games grouped by day; a day with only home games gets a green "Heimspieltag am Ballpark" heading.
- Row: start time (large), opponent with Bretten in bold, team · league · "Spiel 1 von 2" · home/away, "Anfahrt" for away games.
- Cancelled games stay visible, struck through, with an "abgesagt" label.
- **"In meinen Kalender"** per game: menu with "Apple, Outlook & andere" (`.ics` download) and "Google Kalender" (prefilled link).
- **"Spielplan abonnieren"**: one iCal feed per team plus one for all teams (`webcal://`, Google link, copy link). New dates,
  reschedules and cancellations come through on their own.
- All generated at build time from the BSM cache – no external service. The weekend rebuilds keep the feeds fresh within
  an hour; calendar apps poll on their own schedule (Google can take several hours).
