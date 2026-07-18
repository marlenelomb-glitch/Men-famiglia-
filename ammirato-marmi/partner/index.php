<?php
/**
 * Ammirato Marmi - Portale Partner
 * index.php - Dashboard partner
 */
require_once __DIR__ . '/config.php';
require_partner();

$p = partner_corrente();
$titolo_pagina = 'Dashboard';
$pagina_attiva = 'dashboard';

$richieste = q_all('SELECT * FROM partner_richieste WHERE partner_id = ? ORDER BY created_at DESC LIMIT 5', array($p['id']));
$n_preventivi = (int) q_val('SELECT COUNT(*) FROM preventivi WHERE partner_id = ?', array($p['id']));
$n_accettati = (int) q_val("SELECT COUNT(*) FROM preventivi WHERE partner_id = ? AND stato = 'accettato'", array($p['id']));

include __DIR__ . '/header.php';
?>

<div class="stat-grid">
  <div class="stat"><div class="num"><?php echo count(q_all('SELECT id FROM partner_richieste WHERE partner_id = ?', array($p['id']))); ?></div><div class="lbl">Richieste inviate</div></div>
  <div class="stat"><div class="num"><?php echo $n_preventivi; ?></div><div class="lbl">Preventivi ricevuti</div></div>
  <div class="stat"><div class="num"><?php echo $n_accettati; ?></div><div class="lbl">Preventivi accettati</div></div>
</div>

<div class="card">
  <div class="card-header">
    <h2>Benvenuto, <?php echo e($p['nome']); ?></h2>
    <div class="spacer"></div>
    <a class="btn btn-oro" href="richiesta.php">Richiedi un preventivo</a>
  </div>
  <?php if (partner_approvato()): ?>
    <p>Il tuo account e' <strong>approvato</strong>. Puoi consultare il catalogo con i prezzi riservati, ricevere preventivi dettagliati, accettarli e seguire lo stato delle lavorazioni.</p>
  <?php else: ?>
    <p>Il tuo account e' in <strong>attesa di approvazione</strong>. Nel frattempo puoi consultare il catalogo materiali e inviare richieste di preventivo con foto di riferimento.</p>
  <?php endif; ?>
</div>

<div class="card">
  <div class="card-header"><h2>Le tue ultime richieste</h2></div>
  <?php if (!$richieste): ?>
    <p class="muted">Non hai ancora inviato richieste.</p>
  <?php else: ?>
    <table class="tab">
      <thead><tr><th>Data</th><th>Tipo lavoro</th><th>Stato</th></tr></thead>
      <tbody>
      <?php foreach ($richieste as $r): ?>
        <tr>
          <td class="nowrap"><?php echo data_it($r['created_at']); ?></td>
          <td><?php echo e($r['tipo_lavoro']); ?></td>
          <td><span class="badge <?php echo $r['stato'] === 'preventivata' ? 'badge-verde' : 'badge-grigio'; ?>"><?php echo e($r['stato']); ?></span></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  <?php endif; ?>
</div>

<?php include __DIR__ . '/footer.php'; ?>
