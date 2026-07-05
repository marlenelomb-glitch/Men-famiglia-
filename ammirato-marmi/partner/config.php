<?php
/**
 * Ammirato Marmi - Portale Partner
 * config.php - Sessione e autenticazione partner (isolato dal gestionale).
 *
 * Riusa il livello database del gestionale ma con una sessione separata.
 */

require_once __DIR__ . '/../Gestionale/db.php';

if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_httponly', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.gc_maxlifetime', '28800');
    session_name('AMMIRATO_PARTNER');
    session_set_cookie_params(28800);
    session_start();
}

if (isset($_SESSION['ultimo_accesso']) && (time() - $_SESSION['ultimo_accesso']) > 28800) {
    session_unset();
    session_destroy();
} else {
    $_SESSION['ultimo_accesso'] = time();
}

// ------- Autenticazione partner -------
function partner_loggato() {
    return isset($_SESSION['partner_id']) && $_SESSION['partner_id'] > 0;
}

function partner_corrente() {
    static $p = false;
    if ($p === false) {
        if (partner_loggato()) {
            $p = q_one("SELECT * FROM users WHERE id = ? AND ruolo = 'partner' AND attivo = 1", array($_SESSION['partner_id']));
            if (!$p) $p = null;
        } else {
            $p = null;
        }
    }
    return $p;
}

function partner_approvato() {
    $p = partner_corrente();
    return $p && (int)$p['approvato'] === 1;
}

function require_partner() {
    if (!partner_loggato() || !partner_corrente()) {
        redirect('login.php');
    }
}

// ------- CSRF (sessione partner) -------
function csrf_token() {
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}
function csrf_field() {
    return '<input type="hidden" name="csrf" value="' . e(csrf_token()) . '">';
}
function csrf_check() {
    $ok = isset($_POST['csrf']) && hash_equals($_SESSION['csrf'] ? $_SESSION['csrf'] : '', $_POST['csrf']);
    if (!$ok) { http_response_code(400); die('Token di sicurezza non valido.'); }
}

// ------- Flash -------
function flash($msg, $tipo = 'ok') { $_SESSION['flash'] = array('msg' => $msg, 'tipo' => $tipo); }
function flash_get() {
    if (!empty($_SESSION['flash'])) { $f = $_SESSION['flash']; unset($_SESSION['flash']); return $f; }
    return null;
}

// ------- Notifica verso il gestionale -------
function crea_notifica($tipo, $titolo, $messaggio, $entita_id = null, $entita_tipo = null) {
    q('INSERT INTO notifiche (tipo, titolo, messaggio, entita_id, entita_tipo, letta, created_at) VALUES (?,?,?,?,?,0,?)',
      array($tipo, $titolo, $messaggio, $entita_id, $entita_tipo, adesso()));
}

// Upload immagine per il portale partner.
function upload_immagine_partner($campo) {
    $dir = __DIR__ . '/uploads';
    if (empty($_FILES[$campo]) || $_FILES[$campo]['error'] !== UPLOAD_ERR_OK) return null;
    $consentiti = array('image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp');
    $tipo = mime_content_type($_FILES[$campo]['tmp_name']);
    if (!isset($consentiti[$tipo])) return null;
    if ($_FILES[$campo]['size'] > 8 * 1024 * 1024) return null;
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $nome = date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $consentiti[$tipo];
    if (move_uploaded_file($_FILES[$campo]['tmp_name'], $dir . '/' . $nome)) return $nome;
    return null;
}
