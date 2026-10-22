# Bretten Kangaroos – Website

Astro-Website mit dem [Bookworm-Light-Theme](https://github.com/themefisher/bookworm-light-astro)
(übernommen von Commit `b94f01e`, Lizenz in `LICENSE-bookworm-theme`). Inhalte werden in
[Pages CMS](https://pagescms.org) gepflegt.

- `.pages.yml` – Konfiguration für Pages CMS
- `content/` – Inhalte (Markdown + Front Matter), bleibt hier, damit Pages CMS sie findet
  - `content/news/` – News (`/news`, `/news/<datei>`); Einträge mit `draft: true` werden nicht gebaut
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

## Turnier-Anmeldung (PHP)

Das Formular auf der Startseite (`src/layouts/components/TurnierAnmeldung.astro`) schickt an
`public/anmeldung.php`. Das Skript prüft die Eingaben und verschickt eine Text-Mail per SMTP über das
eigene IONOS-Postfach (PHPMailer). Es wird keine Liste der Teams gespeichert; auf dem Server liegen nur
Rate-Limit-Dateien mit gehashten IP-Adressen und Zeitstempeln (älter als das Zeitfenster werden sie
gelöscht). Voraussetzung auf dem Server: **PHP 8.3.36+ bzw. 8.4.27+** (ältere Versionen haben die kritischen
Lücken CVE-2026-109618/-109619 „PHP2Shell“, die jedes erreichbare PHP-Skript angreifbar machen – im
IONOS-Kundenbereich prüfen).

- `public/anmeldung.php` – Endpunkt, landet beim Build unverändert in `dist/`
- `server/composer.json`, `server/composer.lock` – PHPMailer (gepinnte Version)
- `server/config.example.php` – Vorlage für die Konfiguration (SMTP-Zugang, HMAC-Secret, Limits)
- `server/vendor/` – wird mit Composer erzeugt, **nicht** im Git

Schutzmaßnahmen: Honeypot-Feld, Mindest-Ausfüllzeit über einen HMAC-signierten Zeitstempel
(`anmeldung.php?token`, vom Formular per JavaScript geholt), Rate-Limit pro IP, E-Mail-Prüfung mit
`filter_var`, die Adresse aus dem Formular nur als Reply-To, Steuerzeichen/Zeilenumbrüche in einzeiligen
Feldern werden entfernt, zusätzlich eine Obergrenze für alle Mails zusammen (gegen Botnetze), IPv6 wird pro
/64-Netz gezählt, PHP-Fehlermeldungen gehen nie an Besucher, und das Skript bricht ab, wenn `private/`
versehentlich im Web-Root liegt.

### Deployment auf IONOS

Auf dem Webspace liegen zwei Verzeichnisse nebeneinander – nur das erste ist der Web-Root der Domain:

```text
<SFTP-Home>/
├── <web-root>/                  ← Inhalt von dist/ (inkl. anmeldung.php), bei jedem Deploy
└── private/                     ← NICHT öffentlich, liegt neben dem Web-Root
    ├── anmeldung-config.php     ← einmalig von Hand anlegen, nie vom Deploy angefasst
    ├── vendor/                  ← aus server/vendor/ (composer install), beim Deploy
    └── ratelimit/               ← legt das Skript selbst an
```

`anmeldung.php` sucht `private/` unter `dirname(__DIR__)/private`, also direkt neben dem Web-Root.
Liegt es woanders, muss der Pfad in `anmeldung.php` angepasst werden.

1. **Einmalig von Hand:** `server/config.example.php` nach `private/anmeldung-config.php` kopieren,
   SMTP-Passwort des Turnier-Postfachs und ein zufälliges `hmac_secret` eintragen
   (`php -r 'echo bin2hex(random_bytes(32)), "\n";'`), per SFTP hochladen, Rechte `600`.
   Zusätzlich eine `private/.htaccess` mit `Require all denied` anlegen – als zweite Sicherung, falls der
   Ordner doch einmal im Web-Root landet.
2. **Bei jedem Deploy (GitHub Action, WP3):**
   - `npm ci && npm run build` → `dist/` in den Web-Root
   - `composer install --no-dev --optimize-autoloader --working-dir=server` → `server/vendor/` nach
     `private/vendor/`
   - `private/anmeldung-config.php` und `private/ratelimit/` beim Sync **ausschließen** (bei rsync mit
     `--delete` z. B. nur `private/vendor/` als Ziel verwenden, nie `private/` selbst).
3. PHPMailer ein- bis zweimal im Jahr aktualisieren: `composer update --working-dir=server`, committen,
   deployen.

### Lokal testen

Voraussetzung: PHP 8.3+, Composer, [Mailpit](https://mailpit.axllent.org) als Fake-SMTP-Server.

```bash
composer install --working-dir=server
```

Ein lokales `private/` außerhalb des Repos anlegen, z. B. `/tmp/kangaroos-private/`, darin
`vendor` als Symlink auf `server/vendor` und eine `anmeldung-config.php` mit `smtp_host` `127.0.0.1`,
`smtp_port` `1025`, `smtp_secure` `''`, `smtp_user` `''`. Dann:

```bash
mailpit
```

```bash
npm run build && KANGAROOS_PRIVATE_DIR=/tmp/kangaroos-private php -S 127.0.0.1:8080 -t dist
```

Formular auf http://127.0.0.1:8080/#anmeldung, Mails auf http://127.0.0.1:8025.
