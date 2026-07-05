<?php
/**
 * Ammirato Marmi - Gestionale
 * cliente.php - Scheda singolo cliente
 */
require_once __DIR__ . '/config.php';
require_permission('clienti');

$id = (int) get('id');
$c = q_one('SELECT * FROM clienti WHERE id = ?', array($id));
if (!$c) {
    flash('Cliente non trovato.', 'err');
    redirect('clienti.php');
}

$titolo_pagina = 'Scheda cliente';
$pagina_attiva = 'clienti';

$progetti = q_all('SELECT * FROM progetti WHERE cliente_id = ? ORDER BY created_at DESC', array($id));
$preventivi = q_all('SELECT * FROM preventivi WHERE cliente_id = ? ORDER BY created_at DESC', array($id));
$fatture = q_all('SELECT * FROM fatture WHERE cliente_id = ? ORDER BY created_at DESC', array($id));

include __DIR__ . '/header.php';
?>

<p><a href="clienti.php">&larr; Torna ai clienti</a></p>

<div class="card">
  <div class="card-header">
    <h2><?php echo e($c['nome']); ?></h2>
    <span class="badge <?php echo $c['tipo'] === 'partner' ? 'badge-oro' : ($c['tipo'] === 'azienda' ? 'badge-blu' : 'badge-grigio'); ?>"><?php echo e($c['tipo']); ?></span>
  </div>
  <dl class="dl">
    <dt>Email</dt><dd><?php echo e($c['email'] ? $c['email'] : '-'); ?></dd>
    <dt>Telefono</dt><dd><?php echo e($c['telefono'] ? $c['telefono'] : '-'); ?></dd>
    <dt>Indirizzo</dt><dd><?php echo e(trim($c['indirizzo'] . ' ' . $c['citta'])); ?></dd>
    <dt>P.IVA</dt><dd><?php echo e($c['piva'] ? $c['piva'] : '-'); ?></dd>
    <dt>Note</dt><dd><?php echo nl2br(e($c['note'])); ?></dd>
  </dl>
</div>

<div class="griglia-2">
  <div class="card">
    <div class="card-header"><h2>Progetti</h2></div>
    <?php if (!$progetti): ?><p class="muted">Nessun progetto.</p><?php else: ?>
      <table class="tab"><tbody>
      <?php foreach ($progetti as $p): ?>
        <tr><td><a href="progetto.php?id=<?php echo (int)$p['id']; ?>"><?php echo e($p['nome']); ?></a></td>
        <td><span class="badge badge-grigio"><?php echo e($p['stato']); ?></span></td></tr>
      <?php endforeach; ?>
      </tbody></table>
    <?php endif; ?>
  </div>

  <div class="card">
    <div class="card-header"><h2>Preventivi</h2></div>
    <?php if (!$preventivi): ?><p class="muted">Nessun preventivo.</p><?php else: ?>
      <table class="tab"><tbody>
      <?php foreach ($preventivi as $p): ?>
        <tr><td><?php echo e($p['numero']); ?></td><td class="text-right"><?php echo euro($p['importo']); ?></td>
        <td><span class="badge badge-grigio"><?php echo e($p['stato']); ?></span></td></tr>
      <?php endforeach; ?>
      </tbody></table>
    <?php endif; ?>
  </div>
</div>

<div class="card">
  <div class="card-header"><h2>Fatture</h2></div>
  <?php if (!$fatture): ?><p class="muted">Nessuna fattura.</p><?php else: ?>
    <table class="tab"><thead><tr><th>Numero</th><th>Emissione</th><th class="text-right">Totale</th><th>Stato</th></tr></thead><tbody>
    <?php foreach ($fatture as $f): ?>
      <tr><td><?php echo e($f['numero']); ?></td><td><?php echo data_it($f['data_emissione']); ?></td>
      <td class="text-right"><?php echo euro($f['importo_totale']); ?></td>
      <td><span class="badge badge-grigio"><?php echo e($f['stato']); ?></span></td></tr>
    <?php endforeach; ?>
    </tbody></table>
  <?php endif; ?>
</div>

<?php include __DIR__ . '/footer.php'; ?>
