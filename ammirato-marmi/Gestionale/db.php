<?php
/**
 * Ammirato Marmi - Gestionale
 * db.php - Livello database condiviso (Gestionale + Portale Partner)
 *
 * Contiene: costanti DB, connessione PDO, helper di sanitizzazione e utilita'
 * generiche. NON avvia la sessione: ci pensano i config.php specifici.
 */

// ---------------------------------------------------------------------------
// Configurazione database (Aruba MySQL 5.6)
// ---------------------------------------------------------------------------
define('DB_HOST', '89.46.111.59');
define('DB_NAME', 'Sql1182724_2');
define('DB_USER', 'Sql1182724');
// IMPORTANTE: inserire qui la password reale del database su Aruba.
define('DB_PASS', 'INSERISCI_QUI_LA_PASSWORD_DB');
define('DB_CHARSET', 'utf8');

// ---------------------------------------------------------------------------
// Dati azienda (usati in header, footer, documenti)
// ---------------------------------------------------------------------------
define('AZIENDA_NOME', 'Ammirato Marmi');
define('AZIENDA_SEDE', "Via Piani d'Area, 35 - 89037 Ardore (RC) - Calabria");
define('AZIENDA_PIVA', '01383610803');
define('AZIENDA_EMAIL', 'info@ammirato.it');
define('AZIENDA_TEL', '+39 0964 629478');
define('AZIENDA_ANNO', '1974');

// ---------------------------------------------------------------------------
// Connessione PDO (singleton)
// ---------------------------------------------------------------------------
function db() {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
        $opt = array(
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        );
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $opt);
        } catch (PDOException $ex) {
            http_response_code(500);
            die('Errore di connessione al database. Verificare le credenziali in db.php.');
        }
    }
    return $pdo;
}

// Esegue una query preparata e restituisce lo statement.
function q($sql, $params = array()) {
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt;
}

// Restituisce una singola riga (o false).
function q_one($sql, $params = array()) {
    return q($sql, $params)->fetch();
}

// Restituisce tutte le righe.
function q_all($sql, $params = array()) {
    return q($sql, $params)->fetchAll();
}

// Restituisce un singolo valore scalare.
function q_val($sql, $params = array()) {
    return q($sql, $params)->fetchColumn();
}

// Ultimo id inserito.
function last_id() {
    return db()->lastInsertId();
}

// ---------------------------------------------------------------------------
// Sanitizzazione e output
// ---------------------------------------------------------------------------

// Escape per output HTML.
function e($str) {
    return htmlspecialchars((string)$str, ENT_QUOTES, 'UTF-8');
}

// Pulizia input: rimuove tag e normalizza.
function clean($str) {
    return trim(htmlspecialchars(strip_tags((string)$str), ENT_QUOTES, 'UTF-8'));
}

// Recupera un campo POST pulito.
function post($key, $default = '') {
    return isset($_POST[$key]) ? clean($_POST[$key]) : $default;
}

// Recupera un campo GET pulito.
function get($key, $default = '') {
    return isset($_GET[$key]) ? clean($_GET[$key]) : $default;
}

// Recupera un intero POST.
function post_int($key, $default = 0) {
    return isset($_POST[$key]) && $_POST[$key] !== '' ? (int)$_POST[$key] : $default;
}

// Recupera un decimale POST (gestisce virgola).
function post_dec($key, $default = 0) {
    if (!isset($_POST[$key]) || $_POST[$key] === '') return $default;
    return (float)str_replace(',', '.', $_POST[$key]);
}

// ---------------------------------------------------------------------------
// Formattazione
// ---------------------------------------------------------------------------

// Formatta un importo in euro.
function euro($n) {
    return '&euro; ' . number_format((float)$n, 2, ',', '.');
}

// Formatta una data (Y-m-d) in gg/mm/aaaa.
function data_it($d) {
    if (empty($d) || $d === '0000-00-00') return '';
    $ts = strtotime($d);
    if ($ts === false) return e($d);
    return date('d/m/Y', $ts);
}

// Formatta data e ora.
function datetime_it($d) {
    if (empty($d)) return '';
    $ts = strtotime($d);
    if ($ts === false) return e($d);
    return date('d/m/Y H:i', $ts);
}

// Redirect e stop.
function redirect($url) {
    header('Location: ' . $url);
    exit;
}

// Data odierna in formato SQL.
function oggi() {
    return date('Y-m-d');
}

// Timestamp corrente in formato SQL.
function adesso() {
    return date('Y-m-d H:i:s');
}
