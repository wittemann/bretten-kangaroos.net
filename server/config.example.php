<?php
/**
 * Config template for the tournament sign-up.
 *
 * Copy to  private/signup-config.php  (next to the web root, NOT inside it)
 * and fill in the values. The real file never goes into Git and is never
 * uploaded by the deploy (see README, section Deployment).
 */

return [
    // IONOS mailbox used for sending
    'smtp_host'   => 'smtp.ionos.de',
    'smtp_port'   => 587,
    'smtp_secure' => 'tls',          // 'tls' (STARTTLS, port 587) or 'ssl' (port 465); '' only for local testing
    'smtp_user'   => 'xmasball@bretten-kangaroos.net',
    'smtp_pass'   => 'ENTER-PASSWORD-HERE',

    'from_address' => 'xmasball@bretten-kangaroos.net',
    'from_name'    => 'Bretten Kangaroos – Turnier-Anmeldung', // shown to the recipient, so German
    'to_addresses' => ['xmasball@bretten-kangaroos.net'],

    // At least 32 random characters, e.g.:  php -r 'echo bin2hex(random_bytes(32)), "\n";'
    'hmac_secret' => 'ENTER-RANDOM-VALUE-HERE',

    'min_fill_seconds'    => 5,     // forms submitted faster count as bots
    'max_form_age'        => 86400, // how long a form token stays valid (seconds)
    'rate_limit_max'      => 5,     // requests per IP …
    'rate_limit_window'   => 3600,  // … in this time window (seconds)
    'global_limit_max'    => 30,    // mails in total (all senders together) …
    'global_limit_window' => 3600,  // … in this time window (seconds)
];
