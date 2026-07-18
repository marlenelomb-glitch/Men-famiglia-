<?php
/**
 * Ammirato Marmi - Portale Partner
 * login.php
 */
require_once __DIR__ . '/config.php';

if (partner_loggato() && partner_corrente()) redirect('index.php');

$errore = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $email = post('email');
    $pass = isset($_POST['password']) ? $_POST['password'] : '';
    $p = q_one("SELECT * FROM users WHERE email = ? AND ruolo = 'partner' LIMIT 1", array($email));
    if ($p && (int)$p['attivo'] === 1 && password_verify($pass, $p['password'])) {
        session_regenerate_id(true);
        $_SESSION['partner_id'] = $p['id'];
        $_SESSION['ultimo_accesso'] = time();
        redirect('index.php');
    } else {
        $errore = 'Credenziali non valide o account non attivo.';
    }
}
?>
<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Accesso Partner - Ammirato Marmi</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../Gestionale/assets/style.css">
</head>
<body>
<div class="login-page">
  <form class="login-box" method="post" action="login.php">
    <div class="nome">AMMIRATO MARMI</div>
    <div class="sotto">Portale Partner</div>
    <?php if ($errore): ?><div class="flash flash-err"><?php echo e($errore); ?></div><?php endif; ?>
    <?php echo csrf_field(); ?>
    <div class="form-row"><label>Email</label><input type="email" name="email" required autofocus></div>
    <div class="form-row"><label>Password</label><input type="password" name="password" required></div>
    <button type="submit" class="btn">Accedi</button>
    <div class="link-partner">Non sei ancora partner? <a href="register.php">Registrati</a></div>
  </form>
</div>
</body>
</html>
