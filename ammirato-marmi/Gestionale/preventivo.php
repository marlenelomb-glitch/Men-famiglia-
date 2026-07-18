<?php
/**
 * Ammirato Marmi - Gestionale
 * preventivo.php - Scheda preventivo con voci dettagliate
 */
require_once __DIR__ . '/config.php';
require_permission('preventivi');

$id = (int) get('id');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $azione = post('azione');
    $pid = post_int('preventivo_id');
    if ($azione === 'aggiungi_voce' && $pid > 0) {
        $qta = post_dec('quantita');
        $pu = post_dec('prezzo_unitario');
        $tot = $qta * $pu;
        $pos = (int) q_val('SELECT COALESCE(MAX(posizione),0)+1 FROM preventivo_voci WHERE preventivo_id = ?', array($pid));
        q('INSERT INTO preventivo_voci (preventivo_id, descrizione, categoria, quantita, unita, prezzo_unitario, prezzo_totale, posizione) VALUES (?,?,?,?,?,?,?,?)',
          array($pid, post('descrizione'), post('categoria'), $qta, post('unita'), $pu, $tot, $pos));
        flash('Voce aggiunta.');
    } elseif ($azione === 'elimina_voce') {
        q('DELETE FROM preventivo_voci WHERE id = ? AND preventivo_id = ?', array(post_int('voce_id'), $pid));
        flash('Voce eliminata.');
    }
    redirect('preventivo.php?id=' . $pid);
}

$pr = q_one('SELECT pr.*, c.nome AS cliente_nome, pg.nome AS progetto_nome
             FROM preventivi pr
             LEFT JOIN clienti c ON c.id = pr.cliente_id
             LEFT JOIN progetti pg ON pg.id = pr.progetto_id
             WHERE pr.id = ?', array($id));
if (!$pr) { flash('Preventivo non trovato.', 'err'); redirect('preventivi.php'); }

$voci = q_all('SELECT * FROM preventivo_voci WHERE preventivo_id = ? ORDER BY posizione ASC, id ASC', array($id));
$tot_voci = 0;
foreach ($voci as $v) $tot_voci += $v['prezzo_totale'];

$titolo_pagina = 'Preventivo ' . $pr['numero'];
$pagina_attiva = 'preventivi';

include __DIR__ . '/header.php';
?>

<p><a href="preventivi.php">&larr; Torna ai preventivi</a></p>

<div class="card">
  <div class="card-header">
    <h2><?php echo e($pr['numero']); ?></h2>
    <span class="badge badge-grigio"><?php echo e($pr['stato']); ?></span>
  </div>
  <dl class="dl">
    <dt>Cliente</dt><dd><?php echo e($pr['cliente_nome'] ? $pr['cliente_nome'] : '-'); ?></dd>
    <dt>Progetto</dt><dd><?php echo e($pr['progetto_nome'] ? $pr['progetto_nome'] : '-'); ?></dd>
    <dt>Emissione</dt><dd><?php echo data_it($pr['data_emissione']); ?></dd>
    <dt>Validita'</dt><dd><?php echo data_it($pr['data_validita']); ?></dd>
    <dt>Descrizione</dt><dd><?php echo nl2br(e($pr['descrizione'])); ?></dd>
  </dl>
  <div style="margin-top:16px;border-top:1px solid var(--pietra-chiara);padding-top:14px;">
    <dl class="dl">
      <dt>Manodopera</dt><dd><?php echo euro($pr['costo_manodopera']); ?></dd>
      <dt>Materiali</dt><dd><?php echo euro($pr['costo_materiali']); ?></dd>
      <dt>Trasporto</dt><dd><?php echo euro($pr['costo_trasporto']); ?></dd>
      <dt>Sconto</dt><dd><?php echo number_format($pr['sconto_percent'], 2, ',', '.'); ?> %</dd>
    </dl>
    <div class="totale-box" style="margin-top:10px;">Totale preventivo: <?php echo euro($pr['importo']); ?></div>
  </div>
</div>

<div class="card">
  <div class="card-header"><h2>Voci dettagliate</h2></div>
  <?php if ($voci): ?>
    <table class="tab">
      <thead><tr><th>Descrizione</th><th>Categoria</th><th class="text-right">Q.ta'</th><th>Unita'</th><th class="text-right">Prezzo un.</th><th class="text-right">Totale</th><th class="azioni"></th></tr></thead>
      <tbody>
      <?php foreach ($voci as $v): ?>
        <tr>
          <td><?php echo e($v['descrizione']); ?></td>
          <td class="muted"><?php echo e($v['categoria']); ?></td>
          <td class="text-right"><?php echo number_format($v['quantita'], 2, ',', '.'); ?></td>
          <td><?php echo e($v['unita']); ?></td>
          <td class="text-right"><?php echo euro($v['prezzo_unitario']); ?></td>
          <td class="text-right"><?php echo euro($v['prezzo_totale']); ?></td>
          <td class="azioni">
            <form method="post" onsubmit="return confirm('Eliminare la voce?')">
              <?php echo csrf_field(); ?>
              <input type="hidden" name="preventivo_id" value="<?php echo (int)$id; ?>">
              <input type="hidden" name="voce_id" value="<?php echo (int)$v['id']; ?>">
              <button class="btn-link danger" name="azione" value="elimina_voce">Elimina</button>
            </form>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody>
      <tfoot><tr><td colspan="5" class="text-right"><strong>Totale voci</strong></td><td class="text-right"><strong><?php echo euro($tot_voci); ?></strong></td><td></td></tr></tfoot>
    </table>
  <?php else: ?>
    <p class="muted">Nessuna voce dettagliata.</p>
  <?php endif; ?>

  <h3 style="margin-top:22px;font-size:15px;">Aggiungi voce</h3>
  <form method="post">
    <?php echo csrf_field(); ?>
    <input type="hidden" name="preventivo_id" value="<?php echo (int)$id; ?>">
    <div class="form-grid-3">
      <div class="form-row"><label>Descrizione</label><input type="text" name="descrizione" required></div>
      <div class="form-row"><label>Categoria</label><input type="text" name="categoria" placeholder="es. Marmo"></div>
      <div class="form-row"><label>Unita'</label>
        <select name="unita"><option value="mq">mq</option><option value="ml">ml</option><option value="pz">pz</option><option value="h">h</option></select>
      </div>
    </div>
    <div class="form-grid-3">
      <div class="form-row"><label>Quantita'</label><input type="number" step="0.01" name="quantita" value="1"></div>
      <div class="form-row"><label>Prezzo unitario &euro;</label><input type="number" step="0.01" name="prezzo_unitario" value="0"></div>
      <div class="form-row" style="display:flex;align-items:flex-end;"><button class="btn btn-oro" name="azione" value="aggiungi_voce">Aggiungi</button></div>
    </div>
  </form>
</div>

<?php include __DIR__ . '/footer.php'; ?>
