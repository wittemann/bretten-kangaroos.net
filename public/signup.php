<?php
/**
 * Tournament sign-up: receives the form from the homepage and sends the
 * sign-up as a plain-text mail via SMTP (PHPMailer) to the tournament
 * mailbox. Nothing is stored except hashed IPs for the rate limit.
 *
 *   GET  /signup.php?token  → JSON {"token": "..."} (signed timestamp)
 *   POST /signup.php        → 303 redirect to /?signup=<status>#signup
 *
 * Config, vendor/ and rate-limit files live outside the web root in the
 * "private" directory (see README, section Deployment).
 */

declare(strict_types=1);

use PHPMailer\PHPMailer\Exception as MailException;
use PHPMailer\PHPMailer\PHPMailer;

// Never show errors to visitors (they would reveal server paths), only log them.
ini_set('display_errors', '0');
ini_set('log_errors', '1');

// Default: "private" directory next to the web root. Overridable via env var for local testing.
$privateDir = getenv('KANGAROOS_PRIVATE_DIR') ?: dirname(__DIR__) . '/private';

header_remove('X-Powered-By'); // don't reveal the PHP version
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

// Guard against a broken deployment: if "private" sits inside the web root, config and
// rate-limit files might be reachable from outside – better to do nothing at all.
$realPrivate = realpath($privateDir);
$realDocRoot = realpath((string) ($_SERVER['DOCUMENT_ROOT'] ?? ''));
if ($realPrivate !== false && $realDocRoot !== false && str_starts_with($realPrivate . '/', rtrim($realDocRoot, '/') . '/')) {
    error_log('signup.php: private directory is inside the web root, aborting: ' . $realPrivate);
    respond('error');
}

$configFile = $privateDir . '/signup-config.php';
if (!is_file($configFile)) {
    error_log('signup.php: config missing: ' . $configFile);
    respond('error');
}
$config = require $configFile;

if (!is_string($config['hmac_secret'] ?? null) || strlen($config['hmac_secret']) < 32) {
    error_log('signup.php: hmac_secret missing or too short (min. 32 characters)');
    respond('error');
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

// Every POST counts towards the rate limit, rejected ones too – that slows down bots as well.
if (!rateLimitAllows(
    $privateDir . '/ratelimit',
    'ip-' . hash_hmac('sha256', clientKey(), $config['hmac_secret']),
    (int) ($config['rate_limit_max'] ?? 5),
    (int) ($config['rate_limit_window'] ?? 3600),
)) {
    respond('limit');
}

// Honeypot: humans don't see the field. Bots get "ok" so they learn nothing.
$honeypot = $_POST['website'] ?? '';
if (!is_string($honeypot) || trim($honeypot) !== '') {
    respond('ok');
}

$token = $_POST['token'] ?? '';
$tokenAge = tokenAge(is_string($token) ? $token : '', $config['hmac_secret']);
if ($tokenAge === null || $tokenAge > (int) ($config['max_form_age'] ?? 86400)) {
    respond('expired');
}
if ($tokenAge < (int) ($config['min_fill_seconds'] ?? 5)) {
    respond('too-fast');
}

$team = singleLine($_POST['team'] ?? '', 100);
$name = singleLine($_POST['name'] ?? '', 100);
$email = singleLine($_POST['email'] ?? '', 254);
$phone = singleLine($_POST['phone'] ?? '', 40);
$players = filter_var($_POST['players'] ?? '', FILTER_VALIDATE_INT, [
    'options' => ['min_range' => 1, 'max_range' => 99],
]);
$comment = multiLine($_POST['comment'] ?? '', 2000);

if (
    $team === null || $team === '' ||
    $name === null || $name === '' ||
    $email === null || filter_var($email, FILTER_VALIDATE_EMAIL) === false ||
    $phone === null || ($phone !== '' && !preg_match('/^[0-9+()\/ .-]{3,40}$/', $phone)) ||
    $players === false ||
    $comment === null
) {
    respond('invalid');
}

// Cap across all senders: slows down mail floods from many IPs (botnet) so the
// mailbox and the reputation of the IONOS sender don't suffer.
if (!rateLimitAllows(
    $privateDir . '/ratelimit',
    'global',
    (int) ($config['global_limit_max'] ?? 30),
    (int) ($config['global_limit_window'] ?? 3600),
)) {
    error_log('signup.php: global limit reached, sign-up rejected');
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

    // Sender is always our own mailbox; the address from the form is only used as Reply-To.
    // The mail text is German because the club reads it.
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
    // Log only the PHPMailer message, never form data.
    error_log('signup.php: sending failed: ' . $mail->ErrorInfo);
    respond('error');
}

respond('ok');

// ---------------------------------------------------------------------------

/** Redirects back to the homepage; the component there shows the status. */
function respond(?string $status): never
{
    $target = '/';
    if ($status !== null) {
        $target .= '?signup=' . rawurlencode($status) . '#signup';
    }
    header('Location: ' . $target, true, 303);
    exit;
}

/** Token = timestamp + HMAC over it. Can't be forged without the secret. */
function createToken(string $secret): string
{
    $ts = (string) time();
    return $ts . '.' . hash_hmac('sha256', 'signup|' . $ts, $secret);
}

/** Token age in seconds, or null if malformed/forged/from the future. */
function tokenAge(string $token, string $secret): ?int
{
    if (!preg_match('/^(\d{1,12})\.([0-9a-f]{64})$/', $token, $m)) {
        return null;
    }
    $expected = hash_hmac('sha256', 'signup|' . $m[1], $secret);
    if (!hash_equals($expected, $m[2])) {
        return null;
    }
    $age = time() - (int) $m[1];
    return $age < 0 ? null : $age;
}

/**
 * Visitor IP for the rate limit. IPv6 connections usually get a whole /64
 * network – so for IPv6 the network counts, otherwise an attacker could just
 * switch addresses.
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
 * Simple rate limit: one file per key holding the timestamps of recent
 * requests. For IPs the key is an HMAC, the IP itself is never stored.
 */
function rateLimitAllows(string $dir, string $key, int $max, int $window): bool
{
    if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
        error_log('signup.php: cannot create rate-limit directory: ' . $dir);
        return false;
    }

    $file = $dir . '/' . $key . '.json';
    $now = time();

    $fh = fopen($file, 'c+');
    if ($fh === false || !flock($fh, LOCK_EX)) {
        error_log('signup.php: cannot read rate-limit file: ' . $file);
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

    // Clean up old files now and then.
    if (random_int(1, 50) === 1) {
        foreach (glob($dir . '/ip-*.json') ?: [] as $old) {
            if (filemtime($old) < $now - $window) {
                @unlink($old);
            }
        }
    }

    return $allowed;
}

/** Single-line text: trimmed, no control characters (so no CR/LF either), length-limited. */
function singleLine(mixed $value, int $maxLength): ?string
{
    if (!is_string($value) || !mb_check_encoding($value, 'UTF-8')) {
        return null;
    }
    $value = trim(preg_replace('/[\p{Cc}\p{Cf}]+/u', ' ', $value));
    return mb_strlen($value) <= $maxLength ? $value : null;
}

/** Multi-line text: line breaks stay, other control characters are removed. */
function multiLine(mixed $value, int $maxLength): ?string
{
    if (!is_string($value) || !mb_check_encoding($value, 'UTF-8')) {
        return null;
    }
    $value = str_replace(["\r\n", "\r"], "\n", $value);
    $value = trim(preg_replace('/[^\P{Cc}\n\t]+/u', '', $value));
    return mb_strlen($value) <= $maxLength ? $value : null;
}
