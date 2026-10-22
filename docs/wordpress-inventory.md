# Old WordPress site – inventory (WP1)

What the old site contains and how it maps to the new one. Based on the WordPress export from 2026-10-16 (structure only – that export is **not** up to date and must not be used
for the content migration in WP7; take a fresh export then).

## What the old site has

- **Menus:** "Teams" (Herren, Jugend, Schüler, T-Ball, Softball, Intra League | BKIL), "Sites" (Startseite, Kontakt,
  Ballpark, Vereinsgeschichte, Downloads, Förderverein, 🎄 Xmas-Ball 🎄), "Footer" (Impressum, Datenschutzerklärung, Kontakt).
- **14 pages**, all top level: the 5 team pages (76–146 words each, with a training table and BSM shortcodes), BKIL,
  Ballpark, Vereinsgeschichte (2,400 words), Förderverein, Downloads (2 PDFs), Kontakt (3 contacts + address),
  Xmas-Ball 2026 (`/turnieranmeldung/`), Impressum, Datenschutzerklärung.
- **530 posts** from 2003 to 2026 (most in 2004–2009 and since 2024). Categories: Allgemein 334, Herren 124, Schüler 22,
  Jugend 15, Slow Pitch 14, Herren2 13, T-Ball 12, Damen 9, Abteilungsleitung 6, Junioren 5, Vorstand 4, Incrediball 4,
  BKIL 3, Förderverein 3, Softball-Juniors 2.
- Sponsors only exist in the sidebar, there is no sponsor page.
- Spielplan and Tabellen don't exist as pages; they were BSM plugin shortcodes on the team pages.

## Mapping to the new sitemap

The sitemap is the one in [`design.md`](design.md#sitemap); every old page has a place in it.
Old URLs that move get 301 redirects (WP7):

| Old | New |
|---|---|
| `/herren/`, `/jugend/`, `/schueler/`, `/t-ball/`, `/softball/` | `/teams/<team>` |
| `/foerderverein-bretten-kangaroos-e-v-gemeinsam-fuer-baseball-und-softball-in-bretten/` | `/foerderverein` |
| `/datenschutzerklaerung/` | `/datenschutz` |
| `/turnieranmeldung/` | `/xmas-ball` |
| `/YYYY/MM/DD/<slug>/` | `/news/<slug>` |

`/ballpark`, `/vereinsgeschichte`, `/bkil`, `/downloads`, `/kontakt`, `/impressum` keep their URLs. BKIL moves from the
Teams menu to Verein; `/sponsoren`, `/spielplan`, `/tabellen`, `/probetraining` and `/teams` are new.

## Decisions from the review

- **Every post moves over** and stays reachable like any other article, the 2003–2012 archive included.
- **Old categories:** current teams map to the `team` field (used by the team filter on Aktuelles and on team pages).
  Teams that no longer exist get no `team` – the posts show up under "Alle" only – but keep their old name in an
  optional `old_team` text field that is shown as a label on the post.

  | Category | `team` | `old_team` |
  |---|---|---|
  | Herren | `herren` | – |
  | Jugend | `jugend` | – |
  | Schüler | `schueler` | – |
  | T-Ball | `t-ball` | – |
  | Herren2, Junioren, Damen, Slow Pitch, Softball-Juniors, Incrediball | – | `Herren 2`, `Junioren`, `Damen`, `Slow Pitch`, `Softball-Juniors`, `Incrediball` |
  | BKIL, Allgemein, Abteilungsleitung, Vorstand, Förderverein | – | – |

  Incrediball is an old, separate thing, not BKIL.
- **Tournament:** gets its own page `/xmas-ball` with all infos and the sign-up form, published only while a tournament
  is on the table. The homepage shows a teaser linking there. `/turnieranmeldung/` redirects to `/xmas-ball`.
- The **Startseite** menu entry goes (the logo links home).
