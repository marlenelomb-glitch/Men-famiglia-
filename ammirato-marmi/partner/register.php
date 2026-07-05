<?php
/**
 * Ammirato Marmi - Portale Partner
 * register.php - Registrazione nuovo partner
 */
require_once __DIR__ . '/config.php';

if (partner_loggato()) redirect('index.php');

$errore = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $nome = trim(post('nome') . ' ' . post('cognome'));
    $ragione = post('ragione_sociale');
    $piva = post('piva');
    $email = post('email');
    $telefono = post('telefono');
    $password = isset($_POST['password']) ? $_POST['password'] : '';

    if (post('nome') === '' || $email === '' || $password === '') {
        $errore = 'Nome, email e password sono obbligatori.';
    } elseif (strlen($password) < 6) {
        $errore = 'La password deve avere almeno 6 caratteri.';
    } elseif (q_val('SELECT COUNT(*) FROM users WHERE email = ?', array($email))) {
        $errore = 'Email gia' . "'" . ' registrata. Prova ad accedere.';
    } else {
        $hash = password_hash($password, PASSWORD_BCRYPT);
        // Registrazione con accesso base immediato (approvato = 0)
        q('INSERT INTO users (nome, email, password, ruolo, permessi, attivo, approvato, ragione_sociale, piva, telefono, listino, sconto_percent, created_at)
           VALUES (?,?,?,?,?,1,0,?,?,?,?,0,?)',
          array($nome, $email, $hash, 'partner', '[]', $ragione, $piva, $telefono, 'base', adesso()));
        $nuovo_id = last_id();
        crea_notifica('registrazione', 'Nuovo partner registrato', $nome . ' si e' . "'" . ' registrato al portale partner.', $nuovo_id, 'partner');
        $_SESSION['partner_id'] = $nuovo_id;
        $_SESSION['ultimo_accesso'] = time();
        redirect('index.php');
    }
}
?>
<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Registrazione Partner - Ammirato Marmi</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../Gestionale/assets/style.css">
</head>
<body>
<div class="login-page">
  <form class="login-box" method="post" action="register.php" style="max-width:460px;">
    <div class="nome">AMMIRATO MARMI</div>
    <div class="sotto">Registrazione Partner</div>
    <?php if ($errore): ?><div class="flash flash-err"><?php echo e($errore); ?></div><?php endif; ?>
    <?php echo csrf_field(); ?>
    <div class="form-grid">
      <div class="form-row"><label>Nome *</label><input type="text" name="nome" required></div>
      <div class="form-row"><label>Cognome</label><input type="text" name="cognome"></div>
    </div>
    <div class="form-row"><label>Ragione sociale</label><input type="text" name="ragione_sociale"></div>
    <div class="form-grid">
      <div class="form-row"><label>P.IVA</label><input type="text" name="piva"></div>
      <div class="form-row"><label>Telefono</label><input type="tel" name="telefono"></div>
    </div>
    <div class="form-row"><label>Email *</label><input type="email" name="email" required></div>
    <div class="form-row"><label>Password *</label><input type="password" name="password" required></div>
    <button type="submit" class="btn">Registrati</button>
    <div class="link-partner">Hai gia' un account? <a href="login.php">Accedi</a></div>
  </form>
</div>
</body>
</html>
