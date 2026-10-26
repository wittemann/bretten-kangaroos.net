# Datenschutzerklärung: Prüfliste für den Verein

> **Umgesetzt am 26.10.2026** in `content/pages/datenschutz.md`. Offen bleiben nur die Punkte in `todo.md` (OK des VfB-Vorstands, Löschung der Anmelde-Mails); AVV mit IONOS am 26.10.2026 abgeschlossen.

Grundlage ist `content/pages/datenschutz.md` (vom alten WordPress-Auftritt kopiert, Texte von e-recht24).
Diese Liste ändert nichts am Text. Sie zeigt, was zur neuen Seite nicht mehr passt und was fehlt.
Die Verantwortung für die Erklärung liegt beim Verein; die Formulierungsvorschläge sind nur Entwürfe.
Bei Unsicherheit: Datenschutz-Generator (z. B. e-recht24) neu durchlaufen lassen oder den Datenschutzbeauftragten / Verband fragen.

## Was die neue Seite tatsächlich tut

- Kein WordPress, keine Plugins, **keine Cookies**, kein Cookie-Banner, keine Analyse- oder Tracking-Tools.
- Kein Kontaktformular, keine Kommentare, kein Newsletter, keine Benutzerkonten auf der Website.
- Schriften sind selbst gehostet. Die Astro Font API (`astro.config.mjs`, Anbieter „google“) lädt sie nur beim
  Build herunter. Besucher fragen **nicht** bei Google an.
- Keine eingebetteten Karten, Videos oder Social-Media-Widgets, keine Fremd-Skripte oder Fremd-URLs im Quellcode (`src/` geprüft).
- Hosting nur bei IONOS (statische Dateien plus ein PHP-Skript).
- Spielplan und Tabellen aus dem BSM werden beim Build abgerufen (`scripts/fetch-bsm.mjs`). Besucher
  haben keinen Kontakt zum BSM. Die BSM-Daten sind Spielergebnisse und Termine, keine Teilnehmerdaten.
- Anmeldeformular auf `/xmas-ball` (`public/signup.php`), nur sichtbar, solange das Turnier aktiv ist:
  verschickt eine Text-Mail über das IONOS-Postfach des Vereins mit Team, Name der Kontaktperson,
  E-Mail, Mannschaftszahlen je Kategorie. Gespeichert werden nur HMAC-gehashte IP-Adressen mit
  Zeitstempel für die Missbrauchsbremse; sie werden nach Ablauf des Zeitfensters gelöscht.
- Bearbeitung der Inhalte über Pages CMS und GitHub (betrifft nur Redakteure, nicht Besucher).

## A. Passagen, die nicht mehr passen

| Abschnitt | Auszug | Problem / Vorschlag |
|---|---|---|
| **1. Datenschutz auf einen Blick → Datenerfassung auf dieser Website → Wie erfassen wir Ihre Daten?** | „Daten, die Sie in ein Kontaktformular eingeben“ und „oder nach Ihrer Einwilligung“ | Es gibt kein Kontaktformular, sondern das Turnier-Anmeldeformular. Es gibt keine Einwilligungsabfrage (kein Banner). **Vorschlag:** „…z. B. um Daten, die Sie in unser Turnier-Anmeldeformular eingeben.“ „oder nach Ihrer Einwilligung“ streichen. |
| **1. … → Wofür nutzen wir Ihre Daten?** | „Andere Daten können zur Analyse Ihres Nutzerverhaltens verwendet werden.“ | Es gibt keine Analyse. **Streichen**, z. B.: „Ein Teil der Daten wird erhoben, um eine fehlerfreie Bereitstellung der Website zu gewährleisten. Daten aus dem Anmeldeformular nutzen wir ausschließlich zur Bearbeitung Ihrer Turnieranmeldung.“ |
| **1. → Analyse-Tools und Tools von Drittanbietern** | „Beim Besuch dieser Website kann Ihr Surf-Verhalten statistisch ausgewertet werden…“ | Ganzer Abschnitt trifft nicht zu. **Entweder streichen oder ersetzen:** „Wir setzen keine Analyse- oder Tracking-Tools ein und binden keine Inhalte von Drittanbietern ein.“ (nur so lassen, solange das stimmt). |
| **2. Hosting → IONOS** (2. Absatz) | „Sofern eine entsprechende Einwilligung abgefragt wurde, erfolgt die Verarbeitung ausschließlich auf Grundlage von Art. 6 Abs. 1 lit. a DSGVO und § 25 Abs. 1 TTDSG…“ | Es wird keine Einwilligung abgefragt, es werden keine Cookies oder Endgeräte-Zugriffe genutzt. Satz kann gestrichen werden. Außerdem heißt das Gesetz seit 2024 **TDDDG** (früher TTDSG). |
| **3. Allgemeine Hinweise → Rechtsgrundlagen der Datenverarbeitung** | „Sofern Sie in die Speicherung von Cookies … eingewilligt haben … § 25 Abs. 1 TTDSG“ | Cookie-Bezug entfällt, TTDSG → TDDDG. Die übrigen Rechtsgrundlagen (lit. a/b/c/f) sind Standardtext und dürfen bleiben; lit. b passt zur Turnieranmeldung (vorvertragliche Maßnahme). |
| **3. → Widerruf Ihrer Einwilligung zur Datenverarbeitung** | „Viele Datenverarbeitungsvorgänge sind nur mit Ihrer ausdrücklichen Einwilligung möglich.“ | Auf der neuen Seite gibt es keine einwilligungsbasierte Verarbeitung. Abschnitt kann bleiben (schadet nicht), ist aber ohne Funktion. Club entscheidet. |
| **3. → Recht auf Datenübertragbarkeit** | „…auf Grundlage Ihrer Einwilligung oder in Erfüllung eines Vertrags…“ | Wie oben: Standardtext, passt nur eingeschränkt. Kann bleiben. |
| **3. → Empfänger von personenbezogenen Daten** | „…Daten unserer Kunden…“ | Der Verein hat keine „Kunden“; Standardtext. Empfänger sind hier nur IONOS (Hosting und Mailpostfach). Evtl. sprachlich anpassen. |
| **4. Plugins und Tools → Google Fonts** (kompletter Abschnitt inkl. DPF-Absatz und Quelle) | „Beim Aufruf einer Seite lädt Ihr Browser die benötigten Fonts … Verbindung zu den Servern von Google“ | **Falsch für die neue Seite**: Schriften liegen auf dem eigenen Server, kein Google-Kontakt. **Abschnitt 4 entfernen** (oder ersetzen, s. u.). Auch der Absatz zum „EU-US Data Privacy Framework“ gehört nur zu Google und entfällt mit. |
| **Gesamtstruktur** | Abschnitt „4. Plugins und Tools“ | Ohne Google Fonts bleibt der Abschnitt leer. **Vorschlag:** Abschnitt streichen und den neuen Abschnitt „Anmeldung zum Turnier“ (s. B2) als Nr. 4 verwenden. |

Nicht verändern, ohne den Verein zu fragen: „Hinweis zur verantwortlichen Stelle“ (Bryan Schaffer, Häringsäcker 1). Bitte prüfen, ob das noch die richtige Person/Adresse ist und ob der Verein (Name, Rechtsform, Vertretung) statt einer Einzelperson genannt werden soll. Das sollte mit dem Impressum übereinstimmen.

Außerdem prüfen: Der Abschnitt „Auftragsverarbeitung“ behauptet einen **AVV mit IONOS**. Bitte bestätigen, dass der Vertrag im IONOS-Kundenbereich abgeschlossen ist (gilt für Hosting und das Mail-Postfach).

## B. Was fehlt für die neue Seite

### B1. Server-Logfiles bei IONOS

Der IONOS-Abschnitt sagt nur „Logfiles inklusive Ihrer IP-Adressen“. Besser konkreter (Entwurf):

> **Server-Logfiles.** Beim Aufruf unserer Seiten erfasst der Webserver automatisch Informationen, die Ihr Browser übermittelt: IP-Adresse, Datum und Uhrzeit, aufgerufene Seite, Browsertyp und -version, verwendetes Betriebssystem, Referrer-URL. Diese Daten werden nicht mit anderen Datenquellen zusammengeführt. Die Erfassung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO; wir haben ein berechtigtes Interesse an der technisch fehlerfreien Darstellung und Sicherheit der Website. Die Speicherdauer richtet sich nach den Einstellungen von IONOS (laut IONOS aktuell **[Dauer im IONOS-Kundenbereich/Datenschutzerklärung prüfen]**).

Offen: Wie lange speichert IONOS die Logs tatsächlich? Bitte bei IONOS nachsehen und eintragen.

### B2. Turnier-Anmeldung (`/xmas-ball`, `signup.php`)

Entwurf zum Anpassen:

> **Anmeldung zum Turnier.** Wenn Sie sich über unser Formular zu einem Turnier anmelden, verarbeiten wir Ihre Angaben zu Mannschaft/Verein, Name der Kontaktperson, E-Mail-Adresse und die Zahl der gemeldeten Mannschaften je Kategorie, um Ihre Anmeldung zu bearbeiten und Sie zu kontaktieren. Die Angaben werden per E-Mail an das Turnier-Postfach des Vereins gesendet (Versand über unseren E-Mail-Anbieter IONOS). **Auf der Website selbst werden die Angaben nicht gespeichert.** Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Durchführung vorvertraglicher Maßnahmen). Die Mails löschen wir **[Zeitpunkt festlegen, z. B. „drei Monate nach dem Turnier“]**, sofern keine gesetzlichen Aufbewahrungspflichten entgegenstehen.

> **Schutz vor Missbrauch.** Zum Schutz vor automatisierten Massenanfragen speichert das Anmeldeformular kurzzeitig eine verschlüsselt (gehasht) abgelegte Form Ihrer IP-Adresse zusammen mit einem Zeitstempel auf dem Server. Eine Rückrechnung auf die IP-Adresse ist ohne unseren geheimen Schlüssel nicht möglich. Die Einträge werden automatisch gelöscht, sobald das Zeitfenster der Begrenzung abgelaufen ist **[Dauer aus der Konfiguration eintragen, siehe `server/config.php`]**. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Sicherheit und Funktionsfähigkeit des Formulars).

Offen für den Verein:
- Wann werden die Anmelde-Mails gelöscht (Postfach aufräumen)? Wer hat Zugriff auf das Postfach?
- Hinweis am Formular selbst („Mit dem Absenden stimmen Sie der Verarbeitung gemäß Datenschutzerklärung zu“ + Link) gewünscht? Das wäre eine Anpassung am Formular, nicht am Text.
- Es werden Daten von Personen aus **anderen** Vereinen verarbeitet (Kontaktpersonen). Der Hinweis in der Erklärung genügt in der Regel; der Verein entscheidet, ob er mehr will.

### B3. BSM-Daten (Spielplan/Tabellen)

Besucher haben keinen Kontakt zum BSM, der Abruf passiert beim Build durch den Verein. Eine Pflichtangabe ist das nicht. Falls der Verein trotzdem transparent sein möchte (Entwurf):

> **Spielplan und Tabellen.** Spielpläne, Ergebnisse und Tabellen stammen aus dem Baseball-Softball-Manager (BSM) des Deutschen Baseball und Softball Verbandes. Wir rufen diese Daten regelmäßig ab und veröffentlichen sie auf unserer Website. Ihr Browser baut dabei keine Verbindung zum BSM auf. Es werden nur Spieltermine, Ergebnisse und Mannschaften veröffentlicht, keine Spielerdaten.

Offen: Zeigen die BSM-Daten irgendwo Spielernamen (Boxscores, Statistiken)? Dann ist ein Hinweis auf die Rechtsgrundlage sinnvoll.

### B4. Keine Cookies / keine Drittanbieter (optional, klarstellend)

> **Cookies.** Unsere Website setzt keine Cookies und bindet keine Inhalte von Drittanbietern (z. B. Schriftarten, Karten, Videos, Statistik-Dienste) ein.

Nur aufnehmen, solange es stimmt. Sobald später z. B. ein YouTube-Video, eine Karte oder Statistik hinzukommt, muss die Erklärung geändert werden.

### B5. Verlinkungen und Social Media

Die neue Seite hat laut Quellcode nur normale Links (z. B. auf Sponsoren-Webseiten, Facebook/Instagram als Link, falls im Footer). Reine Links sind kein Datenschutzproblem. Wenn Social-Media-Links vorhanden sind, ggf. kurz erwähnen: „Beim Anklicken verlassen Sie unsere Seite; für die Datenverarbeitung auf der Zielseite gilt deren Datenschutzerklärung.“

## C. Was der Verein entscheiden muss

1. Wer ist verantwortliche Stelle (Person oder Verein), und stimmt das mit dem Impressum überein?
2. Wie lange werden Server-Logs bei IONOS und die Anmelde-Mails im Postfach gespeichert (Löschfrist festlegen)?
3. Ist der AVV mit IONOS abgeschlossen (Hosting und Postfach)?
4. Welche überholten Standardpassagen (Einwilligung, Datenübertragbarkeit, „Kunden“) bleiben, welche fliegen raus?
5. Soll am Anmeldeformular ein Datenschutz-Hinweis mit Link stehen?
