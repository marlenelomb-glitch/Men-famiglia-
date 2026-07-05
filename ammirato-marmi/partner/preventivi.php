<?php
/**
 * Ammirato Marmi - Portale Partner
 * preventivi.php - Preventivi ricevuti, con accettazione/rifiuto
 */
require_once __DIR__ . '/config.php';
require_partner();

$p = partner_corrente();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    if (!partner_approvato()) {
        flash('Solo i partner approvati possono accettare i preventivi.', 'err');
        redirect('preventivi.php');
    }
    $azione = post('azione');
    $prid = post_int('preventivo_id');
    // Verifica che il preventivo appartenga a questo partner e sia in stato inviato
    $pr = q_one("SELECT * FROM preventivi WHERE id = ? AND partner_id = ?", array($prid, $p['id']));
    if (!$pr) {
        flash('Preventivo non trovato.', 'err');
    } elseif ($pr['stato'] !== 'inviato') {
        flash('Questo preventivo non e' . "'" . ' piu' . "'" . ' modificabile.', 'err');
    } elseif ($azione === 'accetta') {
        q("UPDATE preventivi SET stato = 'accettato', data_accettazione = ? WHERE id = ?", array(adesso(), $prid));
        crea_notifica('accettazione', 'Preventivo accettato', $p['nome'] . ' ha accettato il preventivo ' . $pr['numero'] . '.', $prid, 'preventivo');
        flash('Preventivo accettato. Ora puoi procedere con l\'ordine.');
    } elseif ($azione === 'rifiuta') {
        q("UPDATE preventivi SET stato = 'rifiutato' WHERE id = ?", array($prid));
        crea_notifica('rifiuto', 'Preventivo rifiutato', $p['nome'] . ' ha rifiutato il preventivo ' . $pr['numero'] . '.', $prid, 'preventivo');
        flash('Preventivo rifiutato.');
    }
    redirect('preventivi.php');
}

$titolo_pagina = 'I miei preventivi';
$pagina_attiva = 'preventivi';

$approvato = partner_approvato();
$preventivi = q_all('SELECT * FROM preventivi WHERE partner_id = ? ORDER BY created_at DESC', array($p['id']));

include __DIR__ . '/header.php';
?>

<?php if (!$approvato): ?>
  <div class="card"><p class="muted">I preventivi dettagliati con i prezzi sono disponibili dopo l'approvazione del tuo account.</p></div>
<?php elseif (!$preventivi): ?>
  <div class="card"><p class="muted">Non hai ancora ricevuto preventivi. Invia una <a href="richiesta.php">richiesta di preventivo</a>.</p></div>
<?php else: ?>
  <?php foreach ($preventivi as $pr): ?>
    <?php $voci = q_all('SELECT * FROM preventivo_voci WHERE preventivo_id = ? ORDER BY posizione ASC, id ASC', array($pr['id'])); ?>
    <div class="card">
      <div class="card-header">
        <h2><?php echo e($pr['numero']); ?></h2>
        <div class="spacer"></div>
        <span class="badge <?php
          echo $pr['stato'] === 'accettato' ? 'badge-verde' : ($pr['stato'] === 'rifiutato' ? 'badge-rosso' : 'badge-grigio');
        ?>"><?php echo e($pr['stato']); ?></span>
      </div>
      <dl class="dl">
        <dt>Emissione</dt><dd><?php echo data_it($pr['data_emissione']); ?></dd>
        <dt>Validita'</dt><dd><?php echo data_it($pr['data_validita']); ?></dd>
        <dt>Descrizione</dt><dd><?php echo nl2br(e($pr['descrizione'])); ?></dd>
      </dl>

      <?php if ($voci): ?>
        <table class="tab" style="margin-top:14px;">
          <thead><tr><th>Voce</th><th class="text-right">Q.ta'</th><th>Unita'</th><th class="text-right">Prezzo un.</th><th class="text-right">Totale</th></tr></thead>
          <tbody>
          <?php foreach ($voci as $v): ?>
            <tr><td><?php echo e($v['descrizione']); ?></td>
            <td class="text-right"><?php echo number_format($v['quantita'], 2, ',', '.'); ?></td>
            <td><?php echo e($v['unita']); ?></td>
            <td class="text-right"><?php echo euro($v['prezzo_unitario']); ?></td>
            <td class="text-right"><?php echo euro($v['prezzo_totale']); ?></td></tr>
          <?php endforeach; ?>
          </tbody>
        </table>
      <?php endif; ?>

      <div class="totale-box" style="margin-top:14px;">Totale: <?php echo euro($pr['importo']); ?></div>

      <?php if ($pr['stato'] === 'inviato'): ?>
        <div style="margin-top:16px;display:flex;gap:10px;">
          <form method="post"><?php echo csrf_field(); ?><input type="hidden" name="preventivo_id" value="<?php echo (int)$pr['id']; ?>"><button class="btn btn-oro" name="azione" value="accetta">Accetta preventivo</button></form>
          <form method="post" onsubmit="return confirm('Rifiutare il preventivo?')"><?php echo csrf_field(); ?><input type="hidden" name="preventivo_id" value="<?php echo (int)$pr['id']; ?>"><button class="btn btn-ghost" name="azione" value="rifiuta">Rifiuta</button></form>
        </div>
      <?php elseif ($pr['stato'] === 'accettato'): ?>
        <p style="margin-top:14px;color:var(--verde);">Preventivo accettato il <?php echo data_it($pr['data_accettazione']); ?>. Vai a <a href="ordini.php">I miei ordini</a> per procedere.</p>
      <?php endif; ?>
    </div>
  <?php endforeach; ?>
<?php endif; ?>

<?php include __DIR__ . '/footer.php'; ?>
