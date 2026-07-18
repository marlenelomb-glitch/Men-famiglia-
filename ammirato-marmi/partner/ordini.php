<?php
/**
 * Ammirato Marmi - Portale Partner
 * ordini.php - Ordini (preventivi accettati) e stato lavorazioni
 *
 * Regola: un ordine esiste solo a partire da un preventivo accettato.
 */
require_once __DIR__ . '/config.php';
require_partner();

$p = partner_corrente();
$titolo_pagina = 'I miei ordini';
$pagina_attiva = 'ordini';

$approvato = partner_approvato();

// Gli ordini sono i preventivi accettati dal partner.
$ordini = array();
if ($approvato) {
    $ordini = q_all("SELECT pr.*, pg.nome AS progetto_nome, pg.id AS pg_id
                     FROM preventivi pr
                     LEFT JOIN progetti pg ON pg.id = pr.progetto_id
                     WHERE pr.partner_id = ? AND pr.stato = 'accettato'
                     ORDER BY pr.data_accettazione DESC", array($p['id']));
}

include __DIR__ . '/header.php';
?>

<?php if (!$approvato): ?>
  <div class="card"><p class="muted">Gli ordini sono disponibili dopo l'approvazione del tuo account.</p></div>
<?php elseif (!$ordini): ?>
  <div class="card">
    <p class="muted">Non hai ancora ordini attivi.</p>
    <p>Un ordine nasce quando accetti un preventivo. Vai a <a href="preventivi.php">I miei preventivi</a>.</p>
  </div>
<?php else: ?>
  <?php foreach ($ordini as $o): ?>
    <?php
      $lav = array();
      if ($o['pg_id']) {
          $lav = q_all("SELECT titolo, stato, data_scadenza FROM lavorazioni WHERE progetto_id = ? ORDER BY created_at ASC", array($o['pg_id']));
      }
    ?>
    <div class="card">
      <div class="card-header">
        <h2>Ordine da <?php echo e($o['numero']); ?></h2>
        <div class="spacer"></div>
        <span class="badge badge-verde">confermato</span>
      </div>
      <dl class="dl">
        <dt>Progetto</dt><dd><?php echo e($o['progetto_nome'] ? $o['progetto_nome'] : '-'); ?></dd>
        <dt>Accettato il</dt><dd><?php echo data_it($o['data_accettazione']); ?></dd>
        <dt>Importo</dt><dd><?php echo euro($o['importo']); ?></dd>
      </dl>

      <h3 style="margin-top:16px;font-size:15px;">Stato lavorazioni</h3>
      <?php if (!$lav): ?>
        <p class="muted">Le lavorazioni non sono ancora state pianificate.</p>
      <?php else: ?>
        <table class="tab">
          <thead><tr><th>Lavorazione</th><th>Scadenza</th><th>Stato</th></tr></thead>
          <tbody>
          <?php foreach ($lav as $l): ?>
            <tr>
              <td><?php echo e($l['titolo']); ?></td>
              <td class="nowrap"><?php echo data_it($l['data_scadenza']); ?></td>
              <td><span class="badge <?php echo $l['stato'] === 'completata' ? 'badge-verde' : 'badge-grigio'; ?>"><?php echo e($l['stato']); ?></span></td>
            </tr>
          <?php endforeach; ?>
          </tbody>
        </table>
      <?php endif; ?>
    </div>
  <?php endforeach; ?>
<?php endif; ?>

<?php include __DIR__ . '/footer.php'; ?>
