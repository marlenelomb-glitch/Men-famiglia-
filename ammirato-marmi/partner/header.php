<?php
/**
 * Ammirato Marmi - Portale Partner
 * header.php
 */
if (!defined('DB_HOST')) { require_once __DIR__ . '/config.php'; }
$p = partner_corrente();
$titolo_pagina = isset($titolo_pagina) ? $titolo_pagina : 'Portale Partner';
$pagina_attiva = isset($pagina_attiva) ? $pagina_attiva : '';
$flash = flash_get();
?>
<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?php echo e($titolo_pagina); ?> - Partner Ammirato Marmi</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="../Gestionale/assets/style.css">
</head>
<body>
<div class="layout">
  <aside class="sidebar" id="sidebar">
    <div class="brand">
      <div class="nome">AMMIRATO</div>
      <div class="sotto">Portale Partner</div>
    </div>
    <nav>
      <a href="index.php" class="<?php echo $pagina_attiva === 'dashboard' ? 'attivo' : ''; ?>">Dashboard</a>
      <a href="catalogo.php" class="<?php echo $pagina_attiva === 'catalogo' ? 'attivo' : ''; ?>">Catalogo materiali</a>
      <a href="richiesta.php" class="<?php echo $pagina_attiva === 'richiesta' ? 'attivo' : ''; ?>">Richiedi preventivo</a>
      <a href="preventivi.php" class="<?php echo $pagina_attiva === 'preventivi' ? 'attivo' : ''; ?>">I miei preventivi</a>
      <a href="ordini.php" class="<?php echo $pagina_attiva === 'ordini' ? 'attivo' : ''; ?>">I miei ordini</a>
    </nav>
    <div class="foot">
      <div class="utente"><?php echo e($p['nome']); ?></div>
      <div class="ruolo"><?php echo partner_approvato() ? 'partner approvato' : 'in attesa'; ?></div>
      <a href="logout.php">Esci</a>
    </div>
  </aside>

  <div class="overlay-mobile" id="overlayMobile" onclick="toggleSidebar()"></div>

  <div class="main">
    <div class="topbar">
      <button class="hamburger" onclick="toggleSidebar()" aria-label="Menu">&#9776;</button>
      <h1><?php echo e($titolo_pagina); ?></h1>
    </div>
    <div class="content">
      <?php if (!partner_approvato()): ?>
        <div class="flash" style="background:#f3eee4;border-color:var(--oro);color:var(--oro);">
          Il tuo account e' in attesa di approvazione. Hai accesso al catalogo (senza prezzi) e puoi inviare richieste di preventivo.
        </div>
      <?php endif; ?>
      <?php if ($flash): ?>
        <div class="flash flash-<?php echo $flash['tipo'] === 'err' ? 'err' : 'ok'; ?>"><?php echo e($flash['msg']); ?></div>
      <?php endif; ?>
