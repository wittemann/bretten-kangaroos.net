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
- [ ] Decide who writes content, make sure they have GitHub accounts and invite them to Pages CMS (→ WP1, go-live)
- [x] Decide the deploy route → GitHub Action via SFTP/SSH (→ WP3)
- [x] Create an SFTP user in IONOS and store `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PASSWORD`, `DEPLOY_PATH`, `DEPLOY_KNOWN_HOSTS` as GitHub repo secrets (→ WP3)
- [x] Set up a test subdomain (`neu.bretten-kangaroos.net`) pointing at the `DEPLOY_PATH` folder and run the first deploy (→ WP3)
- [x] Upload `private/signup-config.php` + `private/.htaccess` next to the web root once by hand (→ WP8)
- [ ] After testing the sign-up form: set `to_addresses` in the uploaded `private/signup-config.php` back to
      `xmasball@bretten-kangaroos.net` (currently my personal address for testing) (→ WP8, before go-live)
- [x] Provide the BSM API key only if WP4 finds out the JSON API needs one → not needed (→ WP4)
- [x] Confirm which leagues/teams show up on the standings and games pages → the teams in the current site's menu (→ WP4, see `bsm-api.md`)
- [x] Find out what the old website runs on → WordPress, full access, local backup (→ WP7)
- [x] Point Claude to the local backup → `/Volumes/Backup/Martin/Ionos FTP/2026-10-16/bretten-kangaroos.WordPress.2026-10-16.xml`,
      used for the structure only (→ WP1)
- [ ] Take a fresh WordPress export (Tools → Export → All content) for the migration – the 2026-10-16 export is **not**
      up to date and must not be used for WP7 (→ WP7)
- [ ] Right before the DNS switch: stop editing WordPress, take a final export, let Claude re-run the migration (→ WP7, WP9)
- [x] Decide how much moves over → everything (all pages and the complete news archive) (→ WP7)
- [x] Sponsor list → same as on the current WordPress site, taken over in WP5/WP7 (→ WP5)
- [x] Impressum and privacy policy → copied from the current WordPress site (→ WP9)
- [ ] Review the privacy policy before go-live: the new site no longer uses WordPress plugins/cookies, but adds
      BSM data, hosting via IONOS only and the PHP sign-up form – the text has to match. Legal responsibility stays with the club (→ WP9)
- [ ] Plan the domain/DNS switch from the old site to the new one (→ WP9)
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
- [ ] Short how-to for writers (create news, upload images, drafts) — **Haiku**

### WP2 – Astro + Bookworm theme
Needs: WP1.

- [ ] Set up Astro with the Bookworm theme in the repo — **Sonnet**
- [ ] Content collections that read `content/`, images from `public/images` — **Sonnet**
- [ ] Hide news with `draft: true` in the build — **Haiku**
- [x] Work out the Kangaroos look with **Claude Design** (colours, logo, navigation, layouts of the pages from WP1) — together with me → [`design.md`](design.md)
- [ ] Apply the design from [`design.md`](design.md) to the Bookworm theme (colours, fonts, header/menus, footer, page templates) — **Sonnet**
  - [x] Part 1: brand tokens (`theme.json`, type scale, Barlow/Barlow Condensed via Astro Font API), header (pinstripe, Verein dropdown, phone full-screen menu), footer, shared `.page-title-band` style
  - [x] Part 3: text pages (`[regular].astro` with title band, year column, file list), Kontakt page; content of Ballpark, Vereinsgeschichte, Förderverein, BKIL, Downloads, Kontakt, Impressum, Datenschutz copied from the old site (PDFs in `public/files`)
  - [x] Real crest at `public/images/crest.png`
  - [x] Startseite: hero with ballpark photo, last results from BSM, news, Xmas-Ball teaser, team tiles
  - [ ] News templates, Spielplan restyle, calendar feeds
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

- [ ] Calendar: "In meinen Kalender" per game (.ics + Google link) and subscription feeds per team / all teams, generated at build time (see `design.md`) — **Sonnet**
- [ ] Once a year: new league IDs into `src/data/bsm-leagues.json` (see `bsm-api.md`) — **Haiku**

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

- [ ] Take stock of the WordPress site from the backup: pages, posts, categories → teams, media, downloads, permalink structure — **Sonnet**
- [ ] Conversion WordPress → Markdown + front matter matching `.pages.yml` (WXR export or DB dump; check existing tools like
      `wordpress-export-to-markdown` before writing our own; map categories to `team`, clean up shortcodes/page-builder HTML) — **Opus**
- [ ] Run the conversion, copy media from `wp-content/uploads` into `public/images`, fix links — **Haiku**
- [ ] Keep the conversion re-runnable: a final run on a fresh export right before the DNS switch only adds/updates
      migrated files and never overwrites content created or edited in Pages CMS since — **Opus**
- [ ] Redirects from old WordPress permalinks via `.htaccess` — **Sonnet**

### WP8 – Tournament sign-up form (required for go-live)
Needs: WP2 + WP3, mailbox + PHP version from my tasks. Sends mail only, no list of signed-up teams.

- [ ] Form on `/xmas-ball` + PHP script with these protections — **Opus** (security-relevant):
  - PHPMailer over SMTP, not `mail()`
  - validate the email with `filter_var(..., FILTER_VALIDATE_EMAIL)`, use user input only as Reply-To
  - honeypot field, minimum time to fill the form, rate limit per IP
  - SMTP password in a config file outside the web root / not in Git
  - send plain-text mails or escape everything with `htmlspecialchars()`
- [x] Make sure the deploy (WP3) uploads the PHP script but never the SMTP config — **Sonnet**
- [ ] Reminder: update PHPMailer once or twice a year — **Haiku**

### WP9 – Go-live
Needs: everything above, privacy policy review + DNS plan from my tasks.

- [ ] Add the Impressum and privacy policy pages, texts copied from the current WordPress site — **Haiku**
- [ ] Mark the privacy policy passages that no longer fit the new site (WordPress plugins, cookies, ...) for my review — **Sonnet**
- [ ] Remove the test content (`content/test.md`, sample news) — **Haiku**
- [ ] Final check: links, images, mobile view, BSM pages, sign-up form (test submission), deploy schedule — **Sonnet**
