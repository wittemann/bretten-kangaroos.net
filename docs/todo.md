# Bretten Kangaroos website – status & todo

## Goal

New website for the Bretten Kangaroos baseball club:

```
Markdown in GitHub  →  edited by non-technical writers in Pages CMS  →  built with Astro  →  static files on IONOS
```

## Done

- [x] Repo `wittemann/bretten-kangaroos.net` created
- [x] Pages CMS test skeleton pushed (`.pages.yml`, `content/test.md`, `content/news/`, `public/images/`)
- [x] Pages CMS connected and tried out (create/delete a news entry works)
- [x] Local clone in `~/workspace/bretten-kangaroos.net`, commits use the GitHub noreply address
  (`159054+wittemann@users.noreply.github.com`, set in the repo only), because GitHub blocks pushes with the private address

## Decisions

- **Content:** Markdown files + front matter in this repo, Pages CMS as the editor
- **Build:** Astro, with the **Bookworm** theme as the one to try first
- **Hosting:** IONOS, static files
- **Deploy route:** GitHub Action builds and uploads via SFTP with password (`lftp mirror`; the deploy user has no SSH), no IONOS Deploy Now
- **Old website:** WordPress, full access, recent backup available locally; **everything moves over** (all pages, complete news archive)
- **Standings & games:** loaded from the BSM (Baseball Softball Manager) at build time and rendered on custom pages
- **Fresh stats:** automatic rebuild + deploy **every hour from 6:00 to 20:00 (German time) on Saturdays and Sundays** so BSM results stay up to date
- **Design:** the Kangaroos look (colours, logo, page layouts) is worked out with Claude Design, then applied to the Bookworm theme
- **Tournament sign-up form (on its own page `/xmas-ball`, teaser on the homepage, required for go-live, sends mail only – no list of signed-up teams):** small PHP script on IONOS that sends mail via SMTP from its own mailbox
  (`xmasball@bretten-kangaroos.net`) with PHPMailer, no external form service (data stays on IONOS, no DSGVO agreement with a third party, free)

## Model hints

- **Opus** – design decisions, unknown APIs, security-relevant code, anything that needs real thinking
- **Sonnet** – normal implementation work along a clear plan
- **Haiku** – small, mechanical changes (config tweaks, cleanups, bulk conversion along a finished script)

---

## My tasks (Martin)

Things only I can do. The work package each one unblocks is in brackets.

- [x] Sitemap → start from the structure of the current WordPress site, Claude proposes it in WP1 (→ WP1)
- [x] Review the proposed sitemap: what still makes sense, what goes, what's missing (→ WP1)
- [x] Decide the deploy route → GitHub Action via SFTP/SSH (→ WP3)
- [x] Create an SFTP user in IONOS and store `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PASSWORD`, `DEPLOY_PATH`, `DEPLOY_KNOWN_HOSTS` as GitHub repo secrets (→ WP3)
- [x] Set up a test subdomain (`neu.bretten-kangaroos.net`) pointing at the `DEPLOY_PATH` folder and run the first deploy (→ WP3)
- [x] Upload `private/signup-config.php` + `private/.htaccess` next to the web root once by hand (→ WP8)
- [x] After testing the sign-up form: set `to_addresses` in the uploaded `private/signup-config.php` back to
      `xmasball@bretten-kangaroos.net` (→ WP8, before go-live)
- [x] Provide the BSM API key only if WP4 finds out the JSON API needs one → not needed (→ WP4)
- [x] Confirm which leagues/teams show up on the standings and games pages → the teams in the current site's menu (→ WP4, see `bsm-api.md`)
- [x] Find out what the old website runs on → WordPress, full access, local backup (→ WP7)
- [x] Point Claude to the local backup → `/Volumes/Backup/Martin/Ionos FTP/2026-10-16/bretten-kangaroos.WordPress.2026-10-16.xml`,
      used for the structure only (→ WP1)
- [x] Take a fresh WordPress export (Tools → Export → All content) for the migration →
      `~/Downloads/bretten-kangaroos.WordPress.2026-10-23.xml` (531 posts, 14 pages, 792 media; 8 stray control
      characters make it invalid XML, the converter has to strip them) (→ WP7)
- [ ] Right before the DNS switch: stop editing WordPress, take a final export, let Claude re-run the migration (→ WP7, WP9)
- [ ] At home: find `wp-content/uploads` on the backup drive (IONOS FTP backup) and let Claude re-run the migration with
      `--uploads <folder>` – about 1,450 images of older posts (2003–2023) are gone from the live server and are
      missing in the migrated posts, see [`wordpress-migration-report.md`](wordpress-migration-report.md) (→ WP7)
- [ ] After the uploads re-run: pick photos for the years of the Vereinsgeschichte (Pages CMS: "Foto" per year). Today only
      2015 has one; article photos exist for 2023–2026 (BKIL teams, Xmas-Ball 2024, Römercup 2025, Landesliga title 2026);
      for 1988–2022 look in the restored images or my own photos (the board suggests a motif per year) (→ WP2)
- [x] Decide how much moves over → everything (all pages and the complete news archive) (→ WP7)
- [x] Sponsor list → same as on the current WordPress site, taken over in WP5/WP7 (→ WP5)
- [x] Impressum and privacy policy → copied from the current WordPress site (→ WP9)
- [x] Review the privacy policy before go-live → rewritten 2026-10-26 from [`datenschutz-review.md`](datenschutz-review.md):
      VfB Bretten e.V. responsible (department has no legal capacity of its own), Bryan Schaffer as Kangaroos contact;
      cookies/Google Fonts/analysis/consent passages removed; new sections for server logs, sign-up form
      (mails deleted 3 months after the tournament), abuse protection, BSM data, links. Impressum: § 5 DDG instead of TMG (→ WP9)
- [ ] Get the VfB board's OK that the privacy policy names VfB Bretten e.V. as responsible and Bryan Schaffer as contact (→ WP9)
- [x] Check that the data processing agreement (AVV) with IONOS is in place → set up 2026-10-26 – the privacy policy says so. Contracts from
      19.07.2022 on have it in the IONOS AGB; older ones: IONOS account → Menü → "Mein Konto" → tile
      "Datenschutz & Privatsphäre" → AVV "Weitere Informationen", conclude it online (free). Save the PDF for the club (→ WP9)
- [ ] Decide who deletes the sign-up mails in the `xmasball@` mailbox three months after each tournament – the
      Reminders workflow opens an issue when it's due (→ WP8)
- [ ] Legal responsibility stays with the club: have someone from the club read the new text once (→ WP9)
- [ ] Switch the domain in the IONOS dashboard (one click, no plan needed) (→ WP9). For the sign-up form:
      point `bretten-kangaroos.net` at the same `DEPLOY_PATH` folder as `neu.` – `signup.php` needs `private/`
      one level above the web folder (otherwise upload `private/` next to the new folder too); leave the MX records
      alone so the `xmasball@` mailbox keeps working. Form, token and the redirect after sending use relative paths only
- [x] Check that the test sign-up "TEST Final-Check – bitte ignorieren" from 2026-10-26 arrived in the
      `xmasball@bretten-kangaroos.net` mailbox → arrived (→ WP8, WP9)
- [ ] Subscribe to one calendar feed on the phone and in Google Calendar, e.g. `webcal://neu.bretten-kangaroos.net/kalender/alle.ics` (→ WP4)
- [x] Privacy policy, decisions from [`datenschutz-review.md`](datenschutz-review.md) → decided 2026-10-26, see above;
      the form already had its privacy notice with link; the rate limit now deletes expired hashed-IP entries on
      every form load instead of at random, so the text can promise it (→ WP9)
- [ ] Team photos and badges: upload a photo per team and set `badge` (e.g. "Landesliga-Meister 2026") in Pages CMS – the
      team pages show them under the title (→ WP2)
- [ ] After go-live: pick the writers, get them GitHub accounts, invite them to Pages CMS, hand out
      [`anleitung-redaktion.md`](anleitung-redaktion.md) (→ WP1)
- [x] For the tournament form: create the `xmasball@bretten-kangaroos.net` mailbox (→ WP8)
- [x] For the tournament form: set PHP 8.3+ in the IONOS control panel → runs on 8.4 (→ WP8)

---

## Work packages (in execution order)

### WP1 – Content model & CMS structure
Needs: the WordPress backup (path) from my tasks.

- [x] Read the menu/page structure of the current WordPress site and propose a sitemap, with suggestions
      on what could go or be merged — **Opus** → sitemap in [`design.md`](design.md) checked against the old site,
      inventory, redirects and category mapping in [`wordpress-inventory.md`](wordpress-inventory.md)
- [x] → my review of the sitemap
- [x] Design the content structure: pages, news, teams, sponsors, plus what BSM data needs per team (league IDs) — **Opus**
- [x] Extend `.pages.yml` to match (incl. sponsors: name, logo, link, order; team files; all teams in the news team select; optional `old_team` text; optional "Zahlen" list) — **Sonnet**
- [x] Short how-to for writers (create news, upload images, drafts) — **Haiku** → [`anleitung-redaktion.md`](anleitung-redaktion.md)

### WP2 – Astro + Bookworm theme
Needs: WP1.

- [x] Set up Astro with the Bookworm theme in the repo — **Sonnet**
- [x] Content collections that read `content/`, images from `public/images` — **Sonnet** (`src/content.config.ts`)
- [x] Hide news with `draft: true` in the build — **Haiku** (`src/lib/contentParser.astro`)
- [x] Work out the Kangaroos look with **Claude Design** (colours, logo, navigation, layouts of the pages from WP1) — together with me → [`design.md`](design.md)
- [x] Apply the design from [`design.md`](design.md) to the Bookworm theme (colours, fonts, header/menus, footer, page templates) — **Sonnet**
  - [x] Part 1: brand tokens (`theme.json`, type scale, Barlow/Barlow Condensed via Astro Font API), header (pinstripe, Verein dropdown, phone full-screen menu), footer, shared `.page-title-band` style
  - [x] Part 3: text pages (`[regular].astro` with title band, year column, file list), Kontakt page; content of Ballpark, Vereinsgeschichte, Förderverein, BKIL, Downloads, Kontakt, Impressum, Datenschutz copied from the old site (PDFs in `public/files`)
  - [x] Real crest at `public/images/crest.png`
  - [x] Startseite: hero with ballpark photo, last results from BSM, news, Xmas-Ball teaser, team tiles
  - [x] News templates, Spielplan restyle, calendar feeds (detailed in "Match the design boards" below)
- [x] **Match the design boards** — compared every board in [`design/`](design/) with the built pages on 2026-10-24.
      Colours, fonts, header and footer fit everywhere; the page layouts were built from Bookworm defaults instead of
      the boards. Before each item: open the board, build to it — **Sonnet**
  - [x] All subpages: one shared title band like the boards – left-aligned title, intro text inside the band (`intro` prop of
        `TitleBand`), filter/switcher pills inside the band in the board style; `/spielplan`, `/tabellen`, `/sponsoren` moved over,
        team pages show "ages · league" under the title. Text pages (`[regular].astro`) have no intro yet – needs a front matter field
  - [x] Teams overview (`Teams.dc.html`): list rows instead of cards – team + ages · league, badge (e.g. "Meister 2026"),
        "Training" with summer/winter times, "Coach(es)" with names, "Zur Teamseite →"; below a green Probetraining box and an "Außerdem: Intra League (BKIL)" box
  - [x] Team page (`Team-Schueler.dc.html`): ages · league line under the title, badge top right (e.g. "Landesliga-Meister 2026"),
        team photo under the title band; main column: text, training as summer/winter cards, coaches as cards with initials
        and roles, "Aus dem Team"; sidebar: green "Lust mitzuspielen?" box with button, mini standings ("Tabelle") with the own row
        highlighted, "Letzte Spiele" with S/N scores and "Alle Spiele der <Team> →". Done 2026-10-24; photo and badge show once a
        team file has `image` / `badge` (none has yet, see my tasks)
  - [x] Probetraining (`Probetraining.dc.html`): three steps "Team finden · Kurz Bescheid geben · Vorbeikommen" in the title band,
        one table (Team, Alter, Wann, Wo, Kontakt) with a Winter/Sommer switch that picks the current season by itself, "Noch Fragen?" box with Kontakt button.
        Done 2026-10-24: winter = November to February; a slot counts for the season its `season` field starts with ("Sommer …"/"Winter …"),
        a slot without season for both; teams without training in a season show the other one greyed ("nur im Sommer: …")
  - [x] Spielplan offseason (`Spielplan-Clubhaus.dc.html`): two columns – games left, standings of the selected team right with
        "Alle Tabellen →"; results grouped by month, "Sieg"/"Niederlage" as a text chip instead of the S/N dot, "Spielbericht" link.
        Today one long list of the whole season – show the latest results with "Alle Ergebnisse der Saison →" like `Spielplan-Saison.dc.html`
  - [x] Spielplan in season (`Spielplan-Saison.dc.html`): days as green bars ("Heimspieltag am Ballpark"), large start time,
        "In meinen Kalender" per game, "Spielplan abonnieren" button in the title band and the green subscription box – together with the calendar feeds (WP4)
  - [x] Aktuelles (`Aktuelles.dc.html`): two lead posts with photo side by side, then a compact list (date + team left, title + one-line teaser right),
        numbered pagination, 10 posts per page. Done 2026-10-24
  - [x] News post (`News-Artikel.dc.html`): "← Aktuelles" back link, team chip + date + author, large left-aligned title, intro paragraph,
        then the image with caption; body headings in the section style (today they render as small bold text), green quote box,
        "Zahlen" box, footer with "Zur Teamseite der <Team> →" and share links (WhatsApp, Link kopieren), "Weitere Beiträge" with three posts.
        Done 2026-10-24: the first paragraph is the intro; bold-only paragraphs of the old posts render as headings.
        Image captions left out – not needed, decided 2026-10-26
  - [x] Ballpark (`Ballpark.dc.html`): title band over the ballpark photo with the address, text plus a facts grid (Kunstrasen, Flutlicht,
        Dugouts, Tribünen, Verkaufshaus, DBV-tauglich), "Anfahrt" box with a map image (no embedded Google Maps) and "In Karten-App öffnen",
        "1992 – seit über 30 Jahren" box linking to Vereinsgeschichte. Done 2026-10-24: own content file `content/ballpark.md`
        (Pages CMS "Ballpark", facts editable); the board's Kontakt section is left out, it lives on `/kontakt`.
        Map picture `public/images/ballpark-map.jpg` stitched from OpenStreetMap tiles (zoom 16) with the credit
        "© OpenStreetMap-Mitwirkende" in the picture; without `map_image` the box shows the crest
  - [x] Vereinsgeschichte (`Vereinsgeschichte.dc.html`): close already – add the intro in the title band and the photo box under 1992.
        Done 2026-10-24: text pages have an `intro` field (Pages CMS "Einleitung") for the title band; an image alone in its
        paragraph with a title (`![alt](src "Bildunterschrift")`) renders as a photo box with caption on every page;
        closing line "… und weiter bis heute" links to Aktuelles
  - [x] Vereinsgeschichte, new board `Geschichte-Kombi.dc.html` (milestone cards + chapter accordion). Done 2026-10-24: own
        page `vereinsgeschichte.astro` and content file `content/vereinsgeschichte.md` (Pages CMS "Vereinsgeschichte") with six
        chapters, year titles from the board, the full year texts kept; a milestone card jumps to its year and opens the chapter.
        Years without a photo show no grey placeholder like the board – only 2015 has one so far (see photo task above)
  - [x] Verein dropdown (`Menu-Desktop.dc.html`): wide panel, links in two columns with descriptions, address box with crest and "Anfahrt →" on the right.
        ~~Bug: hover opened it and the click right after closed it again~~ fixed 2026-10-24. Done 2026-10-24: panel hangs from the
        header bottom, descriptions taken over from the board (`src/config/menu.json`)
  - [x] Phone menu (`Menu-Handy.dc.html`): crest + name in the menu header instead of "Menü", ages under the team tiles, Verein links in normal text, Instagram/Facebook at the end.
        Done 2026-10-24: ages come from the team files (`ages`); the "Alle Teams" tile stays next to the five teams
  - [x] Startseite (`Home-Clubhaus*.dc.html`): fits. The small differences (four team tiles per row on desktop, compact one-line
        results on the phone) stay as they are – decided 2026-10-24
- [x] Team pages from `content/teams/*.md`, Teams overview and Probetraining page generated from them — **Sonnet** (`/teams`, `/teams/<slug>` with switcher, `/probetraining`; team files are still empty stubs, so texts/times need filling in Pages CMS)

### WP3 – Deployment pipeline
Needs: WP2, deploy route + SFTP secrets from my tasks. Comes early so every later package is live right away.

- [x] GitHub Action (`.github/workflows/deploy.yml`): build + upload to IONOS via SFTP on every push to `main` (i.e. after every save in Pages CMS) — **Sonnet**
- [x] `.htaccess` basics on IONOS (HTTPS redirect, caching, 404 page) — **Haiku**

### WP4 – BSM integration (custom pages)
Needs: WP2, league/team confirmation from my tasks.

- [x] Find out whether the plain BSM JSON API works without a key (assumption: yes; a key is available if not) — **Sonnet**
- [x] Explore the BSM API and design the data fetch (endpoints, IDs, data model) — **Opus**
- [x] Fetch at build time; if BSM can't be reached, keep the last data and don't break the build — **Opus**
- [x] Standings page per team/league — **Sonnet**
- [x] Schedule & results (games) page — **Sonnet**

- [x] Calendar: "In meinen Kalender" per game (.ics + Google link) and subscription feeds per team / all teams, generated at build time (see `design.md`) — **Sonnet**
      → `/kalender/<team>.ics`, `/kalender/alle.ics`, `/kalender/spiel/<id>.ics` (`src/lib/calendar.ts`); the season layout was
      checked with made-up games only, check it again with the first real 2027 dates
- [x] Feeds checked live 2026-10-26: all five load as `text/calendar`, valid line endings/folding, 50 games, unique UIDs
- [ ] Subscribe to one feed on a phone (Apple) and in Google Calendar on `neu.bretten-kangaroos.net` – needs a real phone, see my tasks
- [ ] Once a year: new league IDs into `src/data/bsm-leagues.json` (see `bsm-api.md`) — **Haiku**. From March on the
      Reminders workflow (`.github/workflows/reminders.yml`, Mondays) opens an issue and the BSM fetch warns while the file
      still has last year's season

### WP5 – Sponsors
Needs: WP1 (sponsor fields), WP2. Can run in parallel with WP4.

- [x] Sponsor page (`/sponsoren`) and sponsor strip in the footer built from `content/sponsors/` — **Sonnet**
- [x] Take over the sponsors (logos, links, order) from the sidebar of the current WordPress site — **Haiku**

### WP6 – Scheduled weekend deploys
Needs: WP3 + WP4.

- [x] Add a schedule to the deploy Action: every hour from 6:00 to 20:00 German time on Saturday and Sunday.
      GitHub cron runs in UTC and German time shifts between UTC+1/+2, so e.g. `cron: "0 4-19 * * 6,0"` plus a first step
      that skips the run when the Europe/Berlin hour is outside 6–20 — **Haiku**

### WP7 – Data migration
Needs: WP1 + WP2, access to the old site from my tasks.

- [x] Take stock of the WordPress site from the backup: pages, posts, categories → teams, media, downloads, permalink structure — **Sonnet**
      → [`wordpress-inventory.md`](wordpress-inventory.md)
- [x] Conversion WordPress → Markdown + front matter matching `.pages.yml` — **Opus** → own script
      `scripts/migrate-wordpress.mjs` (`npm run migrate -- <export.xml> [--uploads <dir>]`, turndown + fast-xml-parser):
      categories → `team`/`old_team`, MS Word paste and old Flash videos cleaned up, galleries shown as an image grid
- [x] Run the conversion on the 2026-10-23 export: 525 posts, 673 images (scaled to max. 1600px) and 8 PDFs; 1,448 images
      of older posts are gone from the live server, 6 posts of only such images are left out until they're found
      → [`wordpress-migration-report.md`](wordpress-migration-report.md), see my tasks
- [x] Keep the conversion re-runnable: `scripts/wordpress-migration.json` remembers each post's file and a hash, a later
      run adds/updates only files nobody edited or deleted in Pages CMS — **Opus**
- [x] Redirects from old WordPress permalinks, generated by the script into `public/.htaccess` — **Sonnet**
- [x] Check the redirects on `neu.bretten-kangaroos.net` — 2026-10-26: all 544 rules answer 301 to the right page, every target answers 200
- [x] Links pasted from GMX/web.de webmail (`deref-gmx.net/…?redirectUrl=…`) are unwrapped by the script; two posts
      (2019-11-06, 2024-06-14) still have them and get fixed by the next migration re-run

### WP8 – Tournament sign-up form (required for go-live)
Needs: WP2 + WP3, mailbox + PHP version from my tasks. Sends mail only, no list of signed-up teams.

- [x] Form on `/xmas-ball` + PHP script with these protections — **Opus** (security-relevant), tested live 2026-10-23:
  - PHPMailer over SMTP, not `mail()`
  - validate the email with `filter_var(..., FILTER_VALIDATE_EMAIL)`, use user input only as Reply-To
  - honeypot field, minimum time to fill the form, rate limit per IP
  - SMTP password in a config file outside the web root / not in Git
  - send plain-text mails or escape everything with `htmlspecialchars()`
- [x] Make sure the deploy (WP3) uploads the PHP script but never the SMTP config — **Sonnet**
- [x] PHPMailer updates: Dependabot opens a pull request for new versions (`.github/dependabot.yml`, checked monthly);
      merging it deploys the update

### WP9 – Go-live
Needs: everything above, privacy policy review + DNS plan from my tasks.

- [x] Add the Impressum and privacy policy pages, texts copied from the current WordPress site — **Haiku** (done in WP2 part 3)
- [x] Mark the privacy policy passages that no longer fit the new site (WordPress plugins, cookies, ...) for my review — **Sonnet** → [`datenschutz-review.md`](datenschutz-review.md)
- [x] Remove the test content (`content/pages/test.md`, sample news `2026-10-16-saisonabschluss.md`) — **Haiku**, 2026-10-24
- [x] Final check: links, images, mobile view, BSM pages, sign-up form (test submission), deploy schedule — **Sonnet**, 2026-10-26:
  - links/images: no broken internal link or image in the 650 built pages; all pages and 710 images/files answer 200 live.
    About 20 external links in old news posts (2004–2019) point to dead sites – left as they are, they're archive
  - mobile: four pages were wider than the phone (long words in headings, a long URL in Datenschutz, the BKIL table) →
    headings and text break long words, content tables scroll sideways on phones; all 649 pages now fit 375px
  - BSM: all five leagues fetched in the scheduled runs, standings and games render
  - sign-up form: test submission "TEST Final-Check" sent OK; bad token, too-fast and the config file (404) checked
  - deploy schedule: GitHub ran only 4 of the 16 hourly runs per weekend day → cron moved from minute 0 to 23,
    check the run count after the next weekend
- [x] Usage statistics, 2026-10-26: `npm run stats` (local only) reads the IONOS access logs over a separate SFTP
      user (host/user in `.env`, password in the Keychain as `kangaroos-stats-sftp`), keeps anonymous counts in the
      git-ignored `stats/` and writes `stats/dashboard/*.json` for the claude.ai dashboard
      [Kangaroos Website-Statistik](https://claude.ai/artifact/TUBXWB2RZ5ghWYbqjsYXdr) – to refresh it, run the script and
      ask Claude to upload the two files again. IONOS keeps about 8 weeks of logs. Privacy policy has a "Zugriffsstatistik" section
- [ ] Re-run the final check right before the DNS switch (after the final WordPress export) — **Sonnet**
