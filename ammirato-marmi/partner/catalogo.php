<?php
/**
 * Ammirato Marmi - Portale Partner
 * catalogo.php - Catalogo materiali (prezzi solo se approvato)
 */
require_once __DIR__ . '/config.php';
require_partner();

$p = partner_corrente();
$titolo_pagina = 'Catalogo materiali';
$pagina_attiva = 'catalogo';

$approvato = partner_approvato();
$sconto = (float) $p['sconto_percent'];

$materiali = q_all('SELECT * FROM inventario ORDER BY categoria ASC, nome ASC');

include __DIR__ . '/header.php';
?>

<div class="card">
  <div class="card-header">
    <h2>Catalogo materiali</h2>
    <div class="spacer"></div>
    <input type="search" placeholder="Cerca..." onkeyup="filtraTabella(this,'tabCat')" style="max-width:220px;">
  </div>

  <?php if (!$approvato): ?>
    <p class="muted">I prezzi riservati sono visibili dopo l'approvazione del tuo account.</p>
  <?php endif; ?>

  <?php if (!$materiali): ?>
    <p class="muted">Catalogo in aggiornamento.</p>
  <?php else: ?>
    <table class="tab" id="tabCat">
      <thead>
        <tr>
          <th>Materiale</th><th>Categoria</th><th>Spessore</th><th>Unita'</th>
          <?php if ($approvato): ?><th class="text-right">Prezzo riservato</th><?php endif; ?>
        </tr>
      </thead>
      <tbody>
      <?php foreach ($materiali as $m): ?>
        <?php
          $prezzo = (float) $m['prezzo_vendita'];
          if ($sconto > 0) $prezzo = $prezzo - ($prezzo * $sconto / 100);
        ?>
        <tr>
          <td><?php echo e($m['nome']); ?><?php if ($m['descrizione']): ?><div class="muted" style="font-size:12px;"><?php echo e($m['descrizione']); ?></div><?php endif; ?></td>
          <td><span class="badge badge-grigio"><?php echo e($m['categoria']); ?></span></td>
          <td><?php echo $m['spessore'] > 0 ? e($m['spessore']) . ' cm' : '-'; ?></td>
          <td><?php echo e($m['unita']); ?></td>
          <?php if ($approvato): ?>
            <td class="text-right"><?php echo euro($prezzo); ?><?php if ($sconto > 0): ?><div class="muted" style="font-size:11px;">listino <?php echo e($p['listino']); ?></div><?php endif; ?></td>
          <?php endif; ?>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  <?php endif; ?>
</div>

<?php include __DIR__ . '/footer.php'; ?>
