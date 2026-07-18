<?php
/**
 * Ammirato Marmi - Gestionale
 * install.php - Crea le tabelle e l'utente admin di default.
 *
 * ISTRUZIONI:
 *  1. Caricare tutta la cartella su Aruba e impostare la password DB in db.php
 *  2. Aprire ammirato.it/Gestionale/install.php nel browser
 *  3. Al termine ELIMINARE questo file dal server.
 */

require_once __DIR__ . '/db.php';

$messaggi = array();
$errore = null;

try {
    $sql = file_get_contents(__DIR__ . '/schema.sql');
    if ($sql === false) {
        throw new Exception('File schema.sql non trovato.');
    }

    // Esegue ogni statement separatamente (compatibilita' Aruba).
    $stmts = array_filter(array_map('trim', explode(';', $sql)));
    foreach ($stmts as $s) {
        if ($s === '' || stripos($s, '--') === 0) continue;
        db()->exec($s);
    }
    $messaggi[] = 'Tabelle create/verificate correttamente.';

    // Crea l'admin di default se non esiste.
    $esiste = q_val('SELECT COUNT(*) FROM users WHERE email = ?', array('info@ammirato.it'));
    if (!$esiste) {
        $hash = password_hash('Ammirato2024!', PASSWORD_BCRYPT);
        q('INSERT INTO users (nome, email, password, ruolo, permessi, attivo, approvato, created_at)
           VALUES (?, ?, ?, ?, ?, 1, 1, ?)',
           array('Amministratore', 'info@ammirato.it', $hash, 'admin', '[]', adesso()));
        $messaggi[] = 'Utente admin creato: info@ammirato.it / Ammirato2024!';
    } else {
        $messaggi[] = 'Utente admin gia' . "'" . ' presente (non modificato).';
    }
} catch (Exception $ex) {
    $errore = $ex->getMessage();
}
?>
<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Installazione - Ammirato Marmi</title>
<style>
  body { font-family: system-ui, sans-serif; background:#FAF8F5; color:#1C1916; max-width:640px; margin:60px auto; padding:0 20px; }
  h1 { font-weight:600; }
  .box { border:1px solid #B5AFA7; border-radius:8px; padding:24px; background:#fff; }
  .ok { color:#2e7d32; }
  .err { color:#c62828; }
  code { background:#f0ede8; padding:2px 6px; border-radius:4px; }
  .attenzione { margin-top:20px; padding:14px; background:#fdf6e3; border:1px solid #8C7B5E; border-radius:6px; }
</style>
</head>
<body>
<h1>Installazione Gestionale</h1>
<div class="box">
<?php if ($errore): ?>
  <p class="err"><strong>Errore:</strong> <?php echo e($errore); ?></p>
  <p>Verificare le credenziali del database in <code>db.php</code>.</p>
<?php else: ?>
  <?php foreach ($messaggi as $m): ?>
    <p class="ok">&#10003; <?php echo $m; ?></p>
  <?php endforeach; ?>
  <div class="attenzione">
    <strong>Importante:</strong> per sicurezza, elimina ora il file
    <code>install.php</code> dal server. Poi vai al
    <a href="login.php">login del gestionale</a>.
  </div>
<?php endif; ?>
</div>
</body>
</html>
