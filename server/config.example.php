<?php
/**
 * Vorlage für die Konfiguration der Turnier-Anmeldung.
 *
 * Kopieren nach  private/anmeldung-config.php  (neben dem Web-Root, NICHT
 * hinein) und die Werte eintragen. Die echte Datei gehört nicht ins Git und
 * wird vom Deploy nie hochgeladen (siehe README, Abschnitt Deployment).
 */

return [
    // IONOS-Postfach, über das gesendet wird
    'smtp_host'   => 'smtp.ionos.de',
    'smtp_port'   => 587,
    'smtp_secure' => 'tls',          // 'tls' (STARTTLS, Port 587) oder 'ssl' (Port 465); '' nur lokal zum Testen
    'smtp_user'   => 'turnier@bretten-kangaroos.net',
    'smtp_pass'   => 'HIER-PASSWORT-EINTRAGEN',

    'from_address' => 'turnier@bretten-kangaroos.net',
    'from_name'    => 'Bretten Kangaroos – Turnier-Anmeldung',
    'to_addresses' => ['turnier@bretten-kangaroos.net'],

    // Mindestens 32 zufällige Zeichen, z. B.:  php -r 'echo bin2hex(random_bytes(32)), "\n";'
    'hmac_secret' => 'HIER-ZUFALLSWERT-EINTRAGEN',

    'min_fill_seconds'  => 5,       // schneller abgeschickte Formulare gelten als Bot
    'max_form_age'      => 86400,   // Formular-Token gilt so lange (Sekunden)
    'rate_limit_max'    => 5,       // Anfragen pro IP …
    'rate_limit_window' => 3600,    // … in diesem Zeitfenster (Sekunden)
];
