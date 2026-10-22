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
