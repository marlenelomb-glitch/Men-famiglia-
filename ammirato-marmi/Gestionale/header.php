<?php
/**
 * Ammirato Marmi - Gestionale
 * header.php - Intestazione comune (sidebar + topbar).
 * Variabili attese: $titolo_pagina, $pagina_attiva
 */
if (!defined('DB_HOST')) { require_once __DIR__ . '/config.php'; }
$u = current_user();
$titolo_pagina = isset($titolo_pagina) ? $titolo_pagina : 'Gestionale';
$pagina_attiva = isset($pagina_attiva) ? $pagina_attiva : '';

// Voci di menu: chiave => array(etichetta, permesso, file)
$voci = array(
    'dashboard'   => array('Dashboard',   null,          'index.php'),
    'clienti'     => array('Clienti',      'clienti',     'clienti.php'),
    'progetti'    => array('Progetti',     'progetti',    'progetti.php'),
    'preventivi'  => array('Preventivi',   'preventivi',  'preventivi.php'),
    'fatture'     => array('Fatture',      'fatture',     'fatture.php'),
    'lavorazioni' => array('Lavorazioni',  'lavorazioni', 'lavorazioni.php'),
    'inventario'  => array('Inventario',   'inventario',  'inventario.php'),
    'calendario'  => array('Calendario',   'calendario',  'calendario.php'),
    'finanze'     => array('Finanze',      'finanze',     'finanze.php'),
    'risorse'     => array('Risorse',      'risorse',     'risorse.php'),
    'partner'     => array('Partner',      'partner',     'partner.php'),
);

$notif_nuove = (int) q_val('SELECT COUNT(*) FROM notifiche WHERE letta = 0');
$flash = flash_get();
?>
<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?php echo e($titolo_pagina); ?> - Ammirato Marmi</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/style.css">
<script>window.CSRF_TOKEN = <?php echo json_encode(csrf_token()); ?>;</script>
</head>
<body>
<div class="layout">

  <aside class="sidebar" id="sidebar">
    <div class="brand">
      <div class="nome">AMMIRATO</div>
      <div class="sotto">Marmi &middot; dal <?php echo AZIENDA_ANNO; ?></div>
    </div>
    <nav>
      <?php foreach ($voci as $chiave => $v): ?>
        <?php if ($v[1] === null || has_permission($v[1])): ?>
          <a href="<?php echo $v[2]; ?>" class="<?php echo $pagina_attiva === $chiave ? 'attivo' : ''; ?>"><?php echo e($v[0]); ?></a>
        <?php endif; ?>
      <?php endforeach; ?>
      <?php if (is_admin()): ?>
        <a href="utenti.php" class="<?php echo $pagina_attiva === 'utenti' ? 'attivo' : ''; ?>">Gestione Utenti</a>
      <?php endif; ?>
      <a href="impostazioni.php" class="<?php echo $pagina_attiva === 'impostazioni' ? 'attivo' : ''; ?>">Impostazioni</a>
    </nav>
    <div class="foot">
      <div class="utente"><?php echo e($u['nome']); ?></div>
      <div class="ruolo"><?php echo e($u['ruolo']); ?></div>
      <a href="logout.php">Esci</a>
    </div>
  </aside>

  <div class="overlay-mobile" id="overlayMobile" onclick="toggleSidebar()"></div>

  <div class="main">
    <div class="topbar">
      <button class="hamburger" onclick="toggleSidebar()" aria-label="Menu">&#9776;</button>
      <h1><?php echo e($titolo_pagina); ?></h1>
      <div class="spacer"></div>
      <div style="position:relative;">
        <button class="notif-btn" onclick="toggleNotifiche()" aria-label="Notifiche">
          Notifiche
          <span class="notif-badge" id="notifBadge" style="<?php echo $notif_nuove > 0 ? '' : 'display:none;'; ?>"><?php echo $notif_nuove; ?></span>
        </button>
        <div class="notif-panel" id="notifPanel">
          <?php
          $ns = q_all('SELECT * FROM notifiche ORDER BY id DESC LIMIT 15');
          if (!$ns) {
              echo '<div class="notif-item"><div class="m muted">Nessuna notifica</div></div>';
          }
          foreach ($ns as $n):
          ?>
            <div class="notif-item <?php echo $n['letta'] ? '' : 'non-letta'; ?>">
              <div class="t"><?php echo e($n['titolo']); ?></div>
              <div class="m"><?php echo e($n['messaggio']); ?></div>
              <div class="d"><?php echo datetime_it($n['created_at']); ?></div>
            </div>
          <?php endforeach; ?>
          <?php if ($ns): ?>
            <div class="notif-item text-center">
              <a class="btn-link" href="api/notifiche.php?azione=segna_lette&ret=<?php echo urlencode(basename($_SERVER['PHP_SELF'])); ?>">Segna tutte come lette</a>
            </div>
          <?php endif; ?>
        </div>
      </div>
    </div>

    <div class="content">
      <?php if ($flash): ?>
        <div class="flash flash-<?php echo $flash['tipo'] === 'err' ? 'err' : 'ok'; ?>"><?php echo e($flash['msg']); ?></div>
      <?php endif; ?>
