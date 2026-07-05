<?php
/**
 * Ammirato Marmi - Gestionale
 * impostazioni.php - Cambio password e dati account
 */
require_once __DIR__ . '/config.php';
require_login();

$u = current_user();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    if (post('azione') === 'cambia_password') {
        $attuale = isset($_POST['password_attuale']) ? $_POST['password_attuale'] : '';
        $nuova = isset($_POST['password_nuova']) ? $_POST['password_nuova'] : '';
        $conferma = isset($_POST['password_conferma']) ? $_POST['password_conferma'] : '';
        if (!password_verify($attuale, $u['password'])) {
            flash('La password attuale non e' . "'" . ' corretta.', 'err');
        } elseif (strlen($nuova) < 6) {
            flash('La nuova password deve avere almeno 6 caratteri.', 'err');
        } elseif ($nuova !== $conferma) {
            flash('Le due password non coincidono.', 'err');
        } else {
            $hash = password_hash($nuova, PASSWORD_BCRYPT);
            q('UPDATE users SET password = ? WHERE id = ?', array($hash, $u['id']));
            flash('Password aggiornata.');
        }
    }
    redirect('impostazioni.php');
}

$titolo_pagina = 'Impostazioni';
$pagina_attiva = 'impostazioni';

include __DIR__ . '/header.php';
?>

<div class="griglia-2">
  <div class="card">
    <div class="card-header"><h2>Dati account</h2></div>
    <dl class="dl">
      <dt>Nome</dt><dd><?php echo e($u['nome']); ?></dd>
      <dt>Email</dt><dd><?php echo e($u['email']); ?></dd>
      <dt>Ruolo</dt><dd><span class="badge badge-grigio"><?php echo e($u['ruolo']); ?></span></dd>
    </dl>
  </div>

  <div class="card">
    <div class="card-header"><h2>Cambia password</h2></div>
    <form method="post" action="impostazioni.php">
      <?php echo csrf_field(); ?>
      <div class="form-row"><label>Password attuale</label><input type="password" name="password_attuale" required></div>
      <div class="form-row"><label>Nuova password</label><input type="password" name="password_nuova" required></div>
      <div class="form-row"><label>Conferma nuova password</label><input type="password" name="password_conferma" required></div>
      <button type="submit" class="btn" name="azione" value="cambia_password">Aggiorna password</button>
    </form>
  </div>
</div>

<?php include __DIR__ . '/footer.php'; ?>
