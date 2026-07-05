<?php
/**
 * Ammirato Marmi - Gestionale
 * api/notifiche.php - Conteggio e gestione notifiche (polling dashboard).
 */
require_once __DIR__ . '/../config.php';
require_login();

$azione = get('azione');

if ($azione === 'conteggio') {
    header('Content-Type: application/json');
    $nuove = (int) q_val('SELECT COUNT(*) FROM notifiche WHERE letta = 0');
    echo json_encode(array('nuove' => $nuove));
    exit;
}

if ($azione === 'segna_lette') {
    q('UPDATE notifiche SET letta = 1 WHERE letta = 0');
    $ret = get('ret');
    if ($ret === '' || strpos($ret, '/') !== false || strpos($ret, ':') !== false) {
        $ret = 'index.php';
    }
    redirect('../' . $ret);
}

if ($azione === 'lista') {
    header('Content-Type: application/json');
    $ns = q_all('SELECT * FROM notifiche ORDER BY id DESC LIMIT 15');
    echo json_encode($ns);
    exit;
}

http_response_code(400);
echo 'Azione non valida';
