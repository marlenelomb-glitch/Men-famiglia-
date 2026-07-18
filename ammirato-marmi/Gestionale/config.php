<?php
/**
 * Ammirato Marmi - Gestionale
 * config.php - Sessione + autenticazione + permessi (area interna)
 *
 * Includere questo file in cima ad ogni pagina del gestionale.
 */

require_once __DIR__ . '/db.php';

// ---------------------------------------------------------------------------
// Sessione (8 ore, cookie httponly)
// ---------------------------------------------------------------------------
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.cookie_httponly', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.gc_maxlifetime', '28800'); // 8 ore
    session_name('AMMIRATO_GEST');
    session_set_cookie_params(28800);
    session_start();
}

// Scadenza sessione dopo 8 ore di inattivita'.
if (isset($_SESSION['ultimo_accesso']) && (time() - $_SESSION['ultimo_accesso']) > 28800) {
    session_unset();
    session_destroy();
} else {
    $_SESSION['ultimo_accesso'] = time();
}

// ---------------------------------------------------------------------------
// Elenco permessi disponibili
// ---------------------------------------------------------------------------
function permessi_disponibili() {
    return array(
        'clienti'     => 'Clienti',
        'progetti'    => 'Progetti',
        'preventivi'  => 'Preventivi',
        'fatture'     => 'Fatture',
        'lavorazioni' => 'Lavorazioni',
        'inventario'  => 'Inventario',
        'calendario'  => 'Calendario',
        'finanze'     => 'Finanze',
        'risorse'     => 'Risorse',
        'partner'     => 'Partner',
    );
}

// ---------------------------------------------------------------------------
// Autenticazione
// ---------------------------------------------------------------------------

function is_logged_in() {
    return isset($_SESSION['user_id']) && $_SESSION['user_id'] > 0;
}

// Utente corrente (array) o null.
function current_user() {
    static $u = false;
    if ($u === false) {
        if (is_logged_in()) {
            $u = q_one('SELECT * FROM users WHERE id = ? AND attivo = 1', array($_SESSION['user_id']));
            if (!$u) $u = null;
        } else {
            $u = null;
        }
    }
    return $u;
}

function is_admin() {
    $u = current_user();
    return $u && $u['ruolo'] === 'admin';
}

// Verifica un permesso specifico per l'utente corrente.
function has_permission($perm) {
    $u = current_user();
    if (!$u) return false;
    if ($u['ruolo'] === 'admin') return true; // l'admin vede tutto
    $lista = json_decode($u['permessi'] ? $u['permessi'] : '[]', true);
    if (!is_array($lista)) $lista = array();
    return in_array($perm, $lista, true);
}

// Blocca l'accesso se non autenticato.
function require_login() {
    if (!is_logged_in() || !current_user()) {
        redirect('login.php');
    }
    // Un partner non deve mai entrare nel gestionale interno.
    $u = current_user();
    if ($u && $u['ruolo'] === 'partner') {
        session_unset();
        redirect('login.php?err=area');
    }
}

// Blocca l'accesso se manca il permesso.
function require_permission($perm) {
    require_login();
    if (!has_permission($perm)) {
        http_response_code(403);
        include __DIR__ . '/header.php';
        echo '<div class="card"><h2>Accesso negato</h2><p class="muted">Non hai i permessi per accedere a questa sezione.</p></div>';
        include __DIR__ . '/footer.php';
        exit;
    }
}

// ---------------------------------------------------------------------------
// CSRF
// ---------------------------------------------------------------------------
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
    if (!$ok) {
        http_response_code(400);
        die('Token di sicurezza non valido. Ricarica la pagina e riprova.');
    }
}

// ---------------------------------------------------------------------------
// Messaggi flash
// ---------------------------------------------------------------------------
function flash($msg, $tipo = 'ok') {
    $_SESSION['flash'] = array('msg' => $msg, 'tipo' => $tipo);
}

function flash_get() {
    if (!empty($_SESSION['flash'])) {
        $f = $_SESSION['flash'];
        unset($_SESSION['flash']);
        return $f;
    }
    return null;
}

// ---------------------------------------------------------------------------
// Notifiche
// ---------------------------------------------------------------------------
function crea_notifica($tipo, $titolo, $messaggio, $entita_id = null, $entita_tipo = null) {
    q('INSERT INTO notifiche (tipo, titolo, messaggio, entita_id, entita_tipo, letta, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)',
       array($tipo, $titolo, $messaggio, $entita_id, $entita_tipo, adesso()));
}

// ---------------------------------------------------------------------------
// Numerazione automatica documenti
// ---------------------------------------------------------------------------
function prossimo_numero($tabella, $prefisso) {
    $anno = date('Y');
    $like = $prefisso . '-' . $anno . '-%';
    $ultimo = q_val(
        "SELECT numero FROM $tabella WHERE numero LIKE ? ORDER BY id DESC LIMIT 1",
        array($like)
    );
    $prog = 1;
    if ($ultimo) {
        $parti = explode('-', $ultimo);
        $prog = (int)end($parti) + 1;
    }
    return sprintf('%s-%s-%04d', $prefisso, $anno, $prog);
}

// Upload di un file immagine, restituisce il nome salvato o null.
function upload_immagine($campo, $dir = null) {
    if ($dir === null) $dir = __DIR__ . '/uploads';
    if (empty($_FILES[$campo]) || $_FILES[$campo]['error'] !== UPLOAD_ERR_OK) {
        return null;
    }
    $consentiti = array('image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif');
    $tipo = mime_content_type($_FILES[$campo]['tmp_name']);
    if (!isset($consentiti[$tipo])) return null;
    if ($_FILES[$campo]['size'] > 8 * 1024 * 1024) return null; // max 8MB
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    $nome = date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $consentiti[$tipo];
    if (move_uploaded_file($_FILES[$campo]['tmp_name'], $dir . '/' . $nome)) {
        return $nome;
    }
    return null;
}
