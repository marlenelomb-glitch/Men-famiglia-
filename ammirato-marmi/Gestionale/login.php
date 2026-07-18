<?php
/**
 * Ammirato Marmi - Gestionale
 * login.php - Accesso area interna (admin/staff).
 */
require_once __DIR__ . '/config.php';

// Se gia' loggato come staff/admin, vai alla dashboard.
if (is_logged_in() && current_user() && current_user()['ruolo'] !== 'partner') {
    redirect('index.php');
}

$errore = '';
if (get('err') === 'area') {
    $errore = 'Account partner: usa il portale partner, non il gestionale interno.';
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $email = post('email');
    $pass = isset($_POST['password']) ? $_POST['password'] : '';
    $u = q_one('SELECT * FROM users WHERE email = ? LIMIT 1', array($email));
    if ($u && $u['ruolo'] === 'partner') {
        $errore = 'Questo account e' . "'" . ' un partner. Accedi dal portale partner.';
    } elseif ($u && (int)$u['attivo'] === 1 && password_verify($pass, $u['password'])) {
        session_regenerate_id(true);
        $_SESSION['user_id'] = $u['id'];
        $_SESSION['ultimo_accesso'] = time();
        redirect('index.php');
    } else {
        $errore = 'Credenziali non valide o account disattivato.';
    }
}
?>
<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Accesso - Ammirato Marmi</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/style.css">
</head>
<body>
<div class="login-page">
  <form class="login-box" method="post" action="login.php">
    <div class="nome">AMMIRATO MARMI</div>
    <div class="sotto">Gestionale</div>
    <?php if ($errore): ?>
      <div class="flash flash-err"><?php echo e($errore); ?></div>
    <?php endif; ?>
    <?php echo csrf_field(); ?>
    <div class="form-row">
      <label>Email</label>
      <input type="email" name="email" required autofocus>
    </div>
    <div class="form-row">
      <label>Password</label>
      <input type="password" name="password" required>
    </div>
    <button type="submit" class="btn">Accedi</button>
    <div class="link-partner">
      Sei un partner? <a href="../partner/login.php">Accedi al portale partner</a>
    </div>
  </form>
</div>
</body>
</html>
