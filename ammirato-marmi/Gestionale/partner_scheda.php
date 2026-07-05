<?php
/**
 * Ammirato Marmi - Gestionale
 * partner_scheda.php - Scheda partner con richieste e preventivi
 */
require_once __DIR__ . '/config.php';
require_permission('partner');

$id = (int) get('id');
$p = q_one("SELECT * FROM users WHERE id = ? AND ruolo = 'partner'", array($id));
if (!$p) { flash('Partner non trovato.', 'err'); redirect('partner.php'); }

$titolo_pagina = 'Scheda partner';
$pagina_attiva = 'partner';

$richieste = q_all('SELECT * FROM partner_richieste WHERE partner_id = ? ORDER BY created_at DESC', array($id));
$preventivi = q_all('SELECT * FROM preventivi WHERE partner_id = ? ORDER BY created_at DESC', array($id));

include __DIR__ . '/header.php';
?>

<p><a href="partner.php">&larr; Torna ai partner</a></p>

<div class="card">
  <div class="card-header">
    <h2><?php echo e($p['nome']); ?></h2>
    <span class="badge <?php echo $p['approvato'] ? 'badge-verde' : 'badge-grigio'; ?>"><?php echo $p['approvato'] ? 'approvato' : 'in attesa'; ?></span>
  </div>
  <dl class="dl">
    <dt>Ragione sociale</dt><dd><?php echo e($p['ragione_sociale'] ? $p['ragione_sociale'] : '-'); ?></dd>
    <dt>P.IVA</dt><dd><?php echo e($p['piva'] ? $p['piva'] : '-'); ?></dd>
    <dt>Email</dt><dd><?php echo e($p['email']); ?></dd>
    <dt>Telefono</dt><dd><?php echo e($p['telefono'] ? $p['telefono'] : '-'); ?></dd>
    <dt>Listino</dt><dd><?php echo e($p['listino']); ?> <?php if ($p['sconto_percent'] > 0) echo '(-' . number_format($p['sconto_percent'],0) . '%)'; ?></dd>
  </dl>
</div>

<div class="card">
  <div class="card-header"><h2>Richieste preventivo</h2></div>
  <?php if (!$richieste): ?><p class="muted">Nessuna richiesta.</p><?php else: ?>
    <table class="tab">
      <thead><tr><th>Data</th><th>Tipo lavoro</th><th>Descrizione</th><th>Stato</th></tr></thead>
      <tbody>
      <?php foreach ($richieste as $r): ?>
        <tr>
          <td class="nowrap"><?php echo data_it($r['created_at']); ?></td>
          <td><?php echo e($r['tipo_lavoro']); ?></td>
          <td class="muted"><?php echo e($r['descrizione']); ?></td>
          <td><span class="badge badge-grigio"><?php echo e($r['stato']); ?></span></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  <?php endif; ?>
</div>

<div class="card">
  <div class="card-header"><h2>Preventivi</h2></div>
  <?php if (!$preventivi): ?><p class="muted">Nessun preventivo.</p><?php else: ?>
    <table class="tab">
      <thead><tr><th>Numero</th><th class="text-right">Importo</th><th>Stato</th></tr></thead>
      <tbody>
      <?php foreach ($preventivi as $pr): ?>
        <tr><td><a href="preventivo.php?id=<?php echo (int)$pr['id']; ?>"><?php echo e($pr['numero']); ?></a></td>
        <td class="text-right"><?php echo euro($pr['importo']); ?></td>
        <td><span class="badge badge-grigio"><?php echo e($pr['stato']); ?></span></td></tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  <?php endif; ?>
</div>

<?php include __DIR__ . '/footer.php'; ?>
