# Bretten Kangaroos – Website

Astro-Website mit dem [Bookworm-Light-Theme](https://github.com/themefisher/bookworm-light-astro)
(übernommen von Commit `b94f01e`, Lizenz in `LICENSE-bookworm-theme`). Inhalte werden in
[Pages CMS](https://pagescms.org) gepflegt. Anleitung für Redakteure: [`docs/anleitung-redaktion.md`](docs/anleitung-redaktion.md).

- `.pages.yml` – Konfiguration für Pages CMS
- `content/` – Inhalte (Markdown + Front Matter), bleibt hier, damit Pages CMS sie findet
  - `content/news/` – News (`/news`, `/news/<datei>`); Einträge mit `draft: true` werden nicht gebaut
  - `content/sponsors/` – Sponsoren (Name, Logo, Link, Reihenfolge) für `/sponsoren` und den Footer
  - `content/*.md` – Einzelseiten (`content/test.md` → `/test`)
- `public/images/` – hochgeladene Bilder, ausgeliefert unter `/images/…`
- `src/content.config.ts` – Content Collections; Felder müssen zu `.pages.yml` passen
- `src/` – Theme (Layouts, Seiten, Styles), `src/config/` für Titel, Menü usw.

## Lokal starten

Voraussetzung: Node.js 22+ und npm.

```bash
npm install
```

```bash
npm run dev
```

Dev-Server auf http://localhost:4321. Produktions-Build nach `dist/`:

```bash
npm run build
```

```bash
npm run preview
```

Abhängigkeiten sind auf exakte Versionen gepinnt (`.npmrc`: `save-exact`, `package-lock.json`).

## Deployment

`.github/workflows/deploy.yml` baut die Seite und lädt sie per SFTP (`lftp mirror`) auf den
IONOS-Webspace:

- bei jedem Push auf `main` – also auch nach jedem Speichern in Pages CMS
- samstags und sonntags stündlich von 6 bis 20 Uhr (deutsche Zeit), damit die BSM-Ergebnisse aktuell bleiben
- von Hand über GitHub → Actions → Deploy → „Run workflow“

Repo-Secrets (GitHub → Settings → Secrets and variables → Actions):

| Secret | Inhalt |
|---|---|
| `DEPLOY_HOST` | SFTP-Server von IONOS |
| `DEPLOY_USER` / `DEPLOY_PASSWORD` | SFTP-Zugang |
| `DEPLOY_PATH` | Web-Root der neuen Seite, z. B. `/neu-website` (nicht `/`, weil `private/` daneben liegt) |
| `DEPLOY_KNOWN_HOSTS` | Ausgabe von `ssh-keyscan <host>` – damit nur der echte Server das Passwort bekommt |

Der Web-Root wird jedes Mal exakt auf `dist/` gespiegelt, überzählige Dateien werden gelöscht. Als
Schutz legt der Deploy eine Datei `.kangaroos-deploy` ab und bricht ab, wenn der Zielordner nicht leer
ist und diese Datei fehlt – ein falscher `DEPLOY_PATH` (z. B. der Ordner der alten WordPress-Seite)
wird so nicht überschrieben.

`public/.htaccess` sorgt für HTTPS-Weiterleitung, die 404-Seite, Caching (`/_astro/` ein Jahr, Bilder
einen Monat, HTML immer frisch) und sperrt Dateien mit Punkt am Anfang.

## Spielplan und Tabellen (BSM)

`/spielplan` und `/tabellen` zeigen Spiele und Tabellen aus dem BSM (Baseball Softball Manager).
`scripts/fetch-bsm.mjs` (`npm run bsm`) holt die Daten der Ligen aus
`src/data/bsm-leagues.json` und schreibt `src/data/bsm-cache.json`, das die Seiten lesen. Ist der BSM
nicht erreichbar, bleiben die alten Daten stehen, der Build bricht nie deswegen ab. Der Deploy-Workflow
führt das Skript vor jedem Build aus und committet die Datei zurück, wenn sich Ergebnisse geändert haben.
`npm run build` holt bewusst keine Daten, damit die Datei lokal unverändert bleibt.

```bash
npm run bsm
```

holt die Daten von Hand (`npm run dev` und `npm run build` tun das nicht). Ligen bekommen jede Saison neue IDs – dann
`bsm-leagues.json` anpassen, wie in `docs/bsm-api.md` beschrieben.

## Turnier-Anmeldung (PHP)

Das Formular auf `/xmas-ball` (`src/layouts/components/TournamentSignup.astro`) schickt an
`public/signup.php`. Die Seite und der Hinweis auf der Startseite gibt es nur, solange in
`content/xmas-ball.md` `active: true` steht; die Kategorien dort (z. B. T-Ball, Schüler, Jugend) sind
zugleich die Auswahl im Formular (je 0–2 Mannschaften). Das Skript prüft die Eingaben und verschickt eine Text-Mail per SMTP über das
eigene IONOS-Postfach (PHPMailer). Es wird keine Liste der Teams gespeichert; auf dem Server liegen nur
Rate-Limit-Dateien mit gehashten IP-Adressen und Zeitstempeln (älter als das Zeitfenster werden sie
gelöscht). Voraussetzung auf dem Server: **PHP 8.3.36+ bzw. 8.4.27+** (ältere Versionen haben die kritischen
Lücken CVE-2026-109618/-109619 „PHP2Shell“, die jedes erreichbare PHP-Skript angreifbar machen – im
IONOS-Kundenbereich prüfen).

- `public/signup.php` – Endpunkt, landet beim Build unverändert in `dist/`
- `server/composer.json`, `server/composer.lock` – PHPMailer (gepinnte Version)
- `server/config.example.php` – Vorlage für die Konfiguration (SMTP-Zugang, HMAC-Secret, Limits)
- `server/vendor/` – wird mit Composer erzeugt, **nicht** im Git

Schutzmaßnahmen: Honeypot-Feld, Mindest-Ausfüllzeit über einen HMAC-signierten Zeitstempel
(`signup.php?token`, vom Formular per JavaScript geholt), Rate-Limit pro IP, E-Mail-Prüfung mit
`filter_var`, die Adresse aus dem Formular nur als Reply-To, Steuerzeichen/Zeilenumbrüche in einzeiligen
Feldern werden entfernt, zusätzlich eine Obergrenze für alle Mails zusammen (gegen Botnetze), IPv6 wird pro
/64-Netz gezählt, PHP-Fehlermeldungen gehen nie an Besucher, und das Skript bricht ab, wenn `private/`
versehentlich im Web-Root liegt.

### Deployment auf IONOS

Auf dem Webspace liegen zwei Verzeichnisse nebeneinander – nur das erste ist der Web-Root der Domain:

```text
<SFTP-Home>/
├── <web-root>/                  ← Inhalt von dist/ (inkl. signup.php), bei jedem Deploy
└── private/                     ← NICHT öffentlich, liegt neben dem Web-Root
    ├── signup-config.php     ← einmalig von Hand anlegen, nie vom Deploy angefasst
    ├── vendor/                  ← aus server/vendor/ (composer install), beim Deploy
    └── ratelimit/               ← legt das Skript selbst an
```

`signup.php` sucht `private/` unter `dirname(__DIR__)/private`, also direkt neben dem Web-Root.
Liegt es woanders, muss der Pfad in `signup.php` angepasst werden.

1. **Einmalig von Hand:** `server/config.example.php` nach `private/signup-config.php` kopieren,
   SMTP-Passwort des Turnier-Postfachs und ein zufälliges `hmac_secret` eintragen
   (`php -r 'echo bin2hex(random_bytes(32)), "\n";'`), per SFTP hochladen, Rechte `600`.
   Zusätzlich eine `private/.htaccess` mit `Require all denied` anlegen – als zweite Sicherung, falls der
   Ordner doch einmal im Web-Root landet.
2. **Bei jedem Deploy** (GitHub Action, siehe [Deployment](#deployment)): `dist/` in den Web-Root,
   `server/vendor/` nach `private/vendor/`. `private/signup-config.php` und `private/ratelimit/` werden
   nie angefasst.
3. PHPMailer ein- bis zweimal im Jahr aktualisieren: `composer update --working-dir=server`, committen,
   deployen.

### Lokal testen

Voraussetzung: PHP 8.3+, Composer, [Mailpit](https://mailpit.axllent.org) als Fake-SMTP-Server.

```bash
composer install --working-dir=server
```

Ein lokales `private/` außerhalb des Repos anlegen, z. B. `/tmp/kangaroos-private/`, darin
`vendor` als Symlink auf `server/vendor` und eine `signup-config.php` mit `smtp_host` `127.0.0.1`,
`smtp_port` `1025`, `smtp_secure` `''`, `smtp_user` `''`. Dann:

```bash
mailpit
```

```bash
npm run build && KANGAROOS_PRIVATE_DIR=/tmp/kangaroos-private php -S 127.0.0.1:8080 -t dist
```

Formular auf http://127.0.0.1:8080/xmas-ball/#signup (in `content/xmas-ball.md` muss `active: true` stehen), Mails auf http://127.0.0.1:8025.
