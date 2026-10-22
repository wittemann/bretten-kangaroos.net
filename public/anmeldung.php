<?php
/**
 * Turnier-Anmeldung: nimmt das Formular von der Startseite entgegen und
 * schickt die Anmeldung als Text-Mail über SMTP (PHPMailer) an das
 * Turnier-Postfach. Es wird nichts gespeichert außer gehashten IPs für das
 * Rate-Limit.
 *
 *   GET  /anmeldung.php?token  → JSON {"token": "..."} (signierter Zeitstempel)
 *   POST /anmeldung.php        → 303-Redirect auf /?anmeldung=<status>#anmeldung
 *
 * Konfiguration, vendor/ und Rate-Limit-Dateien liegen außerhalb des
 * Web-Roots im Verzeichnis „private“ (siehe README, Abschnitt Deployment).
 */

declare(strict_types=1);

use PHPMailer\PHPMailer\Exception as MailException;
use PHPMailer\PHPMailer\PHPMailer;

// Fehlermeldungen nie an Besucher ausgeben (würden Server-Pfade verraten), nur ins Log.
ini_set('display_errors', '0');
ini_set('log_errors', '1');

// Standard: Ordner „private“ neben dem Web-Root. Lokal per Umgebungsvariable überschreibbar.
$privateDir = getenv('KANGAROOS_PRIVATE_DIR') ?: dirname(__DIR__) . '/private';

header_remove('X-Powered-By'); // PHP-Version nicht verraten
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

// Schutz gegen ein falsches Deployment: liegt „private“ im Web-Root, wären Konfiguration
// und Rate-Limit-Dateien womöglich von außen erreichbar – dann lieber gar nichts tun.
$realPrivate = realpath($privateDir);
$realDocRoot = realpath((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''));
if ($realPrivate !== false && $realDocRoot !== false && str_starts_with($realPrivate . '/', rtrim($realDocRoot, '/') . '/')) {
    error_log('anmeldung.php: private-Verzeichnis liegt im Web-Root – Abbruch: ' . $realPrivate);
    respond('fehler');
}

$configFile = $privateDir . '/anmeldung-config.php';
if (!is_file($configFile)) {
    error_log('anmeldung.php: Konfiguration fehlt: ' . $configFile);
    respond('fehler');
}
$config = require $configFile;

if (!is_string($config['hmac_secret'] ?? null) || strlen($config['hmac_secret']) < 32) {
    error_log('anmeldung.php: hmac_secret fehlt oder ist zu kurz (mind. 32 Zeichen)');
    respond('fehler');
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET' && isset($_GET['token'])) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['token' => createToken($config['hmac_secret'])]);
    exit;
}

if ($method !== 'POST') {
    respond(null);
}

// Jeder POST zählt für das Rate-Limit, auch abgewiesene – so bremst es auch Bots.
if (!rateLimitAllows(
    $privateDir . '/ratelimit',
    'ip-' . hash_hmac('sha256', clientKey(), $config['hmac_secret']),
    (int) ($config['rate_limit_max'] ?? 5),
    (int) ($config['rate_limit_window'] ?? 3600),
)) {
    respond('limit');
}

// Honeypot: Menschen sehen das Feld nicht. Bots bekommen „ok“, damit sie nichts lernen.
$honeypot = $_POST['website'] ?? '';
if (!is_string($honeypot) || trim($honeypot) !== '') {
    respond('ok');
}

$token = $_POST['token'] ?? '';
$tokenAge = tokenAge(is_string($token) ? $token : '', $config['hmac_secret']);
if ($tokenAge === null || $tokenAge > (int) ($config['max_form_age'] ?? 86400)) {
    respond('abgelaufen');
}
if ($tokenAge < (int) ($config['min_fill_seconds'] ?? 5)) {
    respond('zu-schnell');
}

$team = singleLine($_POST['team'] ?? '', 100);
$name = singleLine($_POST['name'] ?? '', 100);
$email = singleLine($_POST['email'] ?? '', 254);
$phone = singleLine($_POST['telefon'] ?? '', 40);
$players = filter_var($_POST['spieler'] ?? '', FILTER_VALIDATE_INT, [
    'options' => ['min_range' => 1, 'max_range' => 99],
]);
$comment = multiLine($_POST['kommentar'] ?? '', 2000);

if (
    $team === null || $team === '' ||
    $name === null || $name === '' ||
    $email === null || filter_var($email, FILTER_VALIDATE_EMAIL) === false ||
    $phone === null || ($phone !== '' && !preg_match('/^[0-9+()\/ .-]{3,40}$/', $phone)) ||
    $players === false ||
    $comment === null
) {
    respond('ungueltig');
}

// Obergrenze für alle Absender zusammen: bremst Mail-Fluten von vielen IPs (Botnetz),
// damit das Postfach und der Ruf des IONOS-Absenders keinen Schaden nehmen.
if (!rateLimitAllows(
    $privateDir . '/ratelimit',
    'global',
    (int) ($config['global_limit_max'] ?? 30),
    (int) ($config['global_limit_window'] ?? 3600),
)) {
    error_log('anmeldung.php: globales Limit erreicht, Anmeldung abgewiesen');
    respond('limit');
}

require $privateDir . '/vendor/autoload.php';

$mail = new PHPMailer(true);
try {
    $mail->isSMTP();
    $mail->Host = $config['smtp_host'];
    $mail->Port = (int) $config['smtp_port'];
    $mail->SMTPSecure = $config['smtp_secure'] ?? PHPMailer::ENCRYPTION_STARTTLS;
    $mail->SMTPAutoTLS = $mail->SMTPSecure !== '';
    $mail->SMTPAuth = ($config['smtp_user'] ?? '') !== '';
    $mail->Username = $config['smtp_user'] ?? '';
    $mail->Password = $config['smtp_pass'] ?? '';
    $mail->Timeout = 15;
    $mail->CharSet = PHPMailer::CHARSET_UTF8;
    $mail->isHTML(false);

    // Absender ist immer das eigene Postfach; die Adresse aus dem Formular nur als Reply-To.
    $mail->setFrom($config['from_address'], $config['from_name'] ?? 'Turnier-Anmeldung');
    foreach ((array) $config['to_addresses'] as $to) {
        $mail->addAddress($to);
    }
    $mail->addReplyTo($email, $name);

    $mail->Subject = 'Turnier-Anmeldung: ' . $team;
    $mail->Body = implode("\n", [
        'Neue Anmeldung über das Formular auf der Website.',
        '',
        'Team:            ' . $team,
        'Ansprechpartner: ' . $name,
        'E-Mail:          ' . $email,
        'Telefon:         ' . ($phone !== '' ? $phone : '–'),
        'Anzahl Spieler:  ' . $players,
        '',
        'Kommentar:',
        $comment !== '' ? $comment : '–',
        '',
        '-- ',
        'Mit „Antworten“ geht die Mail direkt an ' . $email . '.',
    ]);

    $mail->send();
} catch (MailException $e) {
    // Nur die PHPMailer-Meldung loggen, keine Formulardaten.
    error_log('anmeldung.php: Versand fehlgeschlagen: ' . $mail->ErrorInfo);
    respond('fehler');
}

respond('ok');

// ---------------------------------------------------------------------------

/** Leitet zurück auf die Startseite; der Status wird dort von der Komponente angezeigt. */
function respond(?string $status): never
{
    $target = '/';
    if ($status !== null) {
        $target .= '?anmeldung=' . rawurlencode($status) . '#anmeldung';
    }
    header('Location: ' . $target, true, 303);
    exit;
}

/** Token = Zeitstempel + HMAC darüber. Ohne Secret nicht fälschbar. */
function createToken(string $secret): string
{
    $ts = (string) time();
    return $ts . '.' . hash_hmac('sha256', 'anmeldung|' . $ts, $secret);
}

/** Alter des Tokens in Sekunden, oder null wenn ungültig/gefälscht/aus der Zukunft. */
function tokenAge(string $token, string $secret): ?int
{
    if (!preg_match('/^(\d{1,12})\.([0-9a-f]{64})$/', $token, $m)) {
        return null;
    }
    $expected = hash_hmac('sha256', 'anmeldung|' . $m[1], $secret);
    if (!hash_equals($expected, $m[2])) {
        return null;
    }
    $age = time() - (int) $m[1];
    return $age < 0 ? null : $age;
}

/**
 * IP des Besuchers für das Rate-Limit. IPv6-Anschlüsse bekommen meist ein
 * ganzes /64-Netz – darum zählt bei IPv6 das Netz, sonst könnte ein Angreifer
 * einfach die Adresse wechseln.
 */
function clientKey(): string
{
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
        $bin = inet_pton($ip);
        if ($bin !== false && !str_starts_with($bin, "\0\0\0\0\0\0\0\0\0\0\xff\xff")) {
            return bin2hex(substr($bin, 0, 8)) . '::/64';
        }
    }
    return $ip;
}

/**
 * Einfaches Rate-Limit: eine Datei pro Schlüssel mit den Zeitstempeln der
 * letzten Anfragen. Für IPs ist der Schlüssel ein HMAC, die IP selbst wird
 * nicht gespeichert.
 */
function rateLimitAllows(string $dir, string $key, int $max, int $window): bool
{
    if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
        error_log('anmeldung.php: Rate-Limit-Verzeichnis nicht anlegbar: ' . $dir);
        return false;
    }

    $file = $dir . '/' . $key . '.json';
    $now = time();

    $fh = fopen($file, 'c+');
    if ($fh === false || !flock($fh, LOCK_EX)) {
        error_log('anmeldung.php: Rate-Limit-Datei nicht lesbar: ' . $file);
        return false;
    }
    $hits = json_decode(stream_get_contents($fh) ?: '[]', true);
    $hits = array_values(array_filter(
        is_array($hits) ? $hits : [],
        fn($t) => is_int($t) && $t > $now - $window
    ));
    $allowed = count($hits) < $max;
    if ($allowed) {
        $hits[] = $now;
    }
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($hits));
    flock($fh, LOCK_UN);
    fclose($fh);

    // Gelegentlich alte Dateien wegräumen.
    if (random_int(1, 50) === 1) {
        foreach (glob($dir . '/ip-*.json') ?: [] as $old) {
            if (filemtime($old) < $now - $window) {
                @unlink($old);
            }
        }
    }

    return $allowed;
}

/** Einzeiliger Text: getrimmt, ohne Steuerzeichen (also auch ohne CR/LF), mit Längenlimit. */
function singleLine(mixed $value, int $maxLength): ?string
{
    if (!is_string($value) || !mb_check_encoding($value, 'UTF-8')) {
        return null;
    }
    $value = trim(preg_replace('/[\p{Cc}\p{Cf}]+/u', ' ', $value));
    return mb_strlen($value) <= $maxLength ? $value : null;
}

/** Mehrzeiliger Text: Zeilenumbrüche bleiben, andere Steuerzeichen fliegen raus. */
function multiLine(mixed $value, int $maxLength): ?string
{
    if (!is_string($value) || !mb_check_encoding($value, 'UTF-8')) {
        return null;
    }
    $value = str_replace(["\r\n", "\r"], "\n", $value);
    $value = trim(preg_replace('/[^\P{Cc}\n\t]+/u', '', $value));
    return mb_strlen($value) <= $maxLength ? $value : null;
}
