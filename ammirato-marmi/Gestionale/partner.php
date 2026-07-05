<?php
/**
 * Ammirato Marmi - Gestionale
 * partner.php - Gestione partner/mobilieri (area admin)
 */
require_once __DIR__ . '/config.php';
require_permission('partner');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $azione = post('azione');
    $pid = post_int('id');
    if ($azione === 'approva' && $pid > 0) {
        q("UPDATE users SET approvato = 1, attivo = 1 WHERE id = ? AND ruolo = 'partner'", array($pid));
        crea_notifica('partner', 'Partner approvato', 'Il partner e' . "'" . ' stato approvato.', $pid, 'partner');
        flash('Partner approvato.');
    } elseif ($azione === 'rifiuta' && $pid > 0) {
        q("UPDATE users SET approvato = 0 WHERE id = ? AND ruolo = 'partner'", array($pid));
        flash('Approvazione revocata.');
    } elseif ($azione === 'salva_listino' && $pid > 0) {
        $listino = in_array(post('listino'), array('base', 'silver', 'gold'), true) ? post('listino') : 'base';
        q("UPDATE users SET listino = ?, sconto_percent = ? WHERE id = ? AND ruolo = 'partner'",
          array($listino, post_dec('sconto_percent'), $pid));
        flash('Listino aggiornato.');
    }
    redirect('partner.php');
}

$titolo_pagina = 'Partner';
$pagina_attiva = 'partner';

$partner = q_all("SELECT * FROM users WHERE ruolo = 'partner' ORDER BY approvato ASC, nome ASC");

include __DIR__ . '/header.php';
?>

<div class="card">
  <div class="card-header"><h2>Partner registrati</h2><div class="spacer"></div><a class="btn btn-ghost" href="richieste_partner.php">Richieste preventivo</a></div>
  <?php if (!$partner): ?>
    <p class="muted">Nessun partner registrato.</p>
  <?php else: ?>
    <table class="tab">
      <thead><tr><th>Nome</th><th>Ragione sociale</th><th>Contatti</th><th>Listino</th><th>Stato</th><th class="azioni">Azioni</th></tr></thead>
      <tbody>
      <?php foreach ($partner as $p): ?>
        <tr>
          <td><?php echo e($p['nome']); ?><?php if ($p['piva']): ?><div class="muted" style="font-size:12px;">P.IVA <?php echo e($p['piva']); ?></div><?php endif; ?></td>
          <td><?php echo e($p['ragione_sociale'] ? $p['ragione_sociale'] : '-'); ?></td>
          <td class="muted" style="font-size:13px;"><?php echo e($p['email']); ?><br><?php echo e($p['telefono']); ?></td>
          <td>
            <?php if ($p['approvato']): ?>
              <span class="badge badge-oro"><?php echo e($p['listino']); ?></span>
              <?php if ($p['sconto_percent'] > 0): ?><span class="muted" style="font-size:12px;"> -<?php echo number_format($p['sconto_percent'],0); ?>%</span><?php endif; ?>
            <?php else: ?>-<?php endif; ?>
          </td>
          <td>
            <span class="badge <?php echo $p['approvato'] ? 'badge-verde' : 'badge-grigio'; ?>"><?php echo $p['approvato'] ? 'approvato' : 'in attesa'; ?></span>
          </td>
          <td class="azioni">
            <a class="btn-link" href="partner_scheda.php?id=<?php echo (int)$p['id']; ?>">Scheda</a>
            <?php if (!$p['approvato']): ?>
              <form method="post" style="display:inline;"><?php echo csrf_field(); ?><input type="hidden" name="id" value="<?php echo (int)$p['id']; ?>"><button class="btn-link" name="azione" value="approva">Approva</button></form>
            <?php else: ?>
              <button class="btn-link" onclick='apriListino(<?php echo json_encode(array("id"=>$p["id"],"listino"=>$p["listino"],"sconto_percent"=>$p["sconto_percent"]), JSON_HEX_APOS|JSON_HEX_QUOT); ?>)'>Listino</button>
              <form method="post" style="display:inline;" onsubmit="return confirm('Revocare approvazione?')"><?php echo csrf_field(); ?><input type="hidden" name="id" value="<?php echo (int)$p['id']; ?>"><button class="btn-link danger" name="azione" value="rifiuta">Revoca</button></form>
            <?php endif; ?>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  <?php endif; ?>
</div>

<div class="modal-bg" id="modalListino">
  <div class="modal">
    <form method="post" action="partner.php">
      <div class="modal-head"><h3>Listino partner</h3><button type="button" class="chiudi" onclick="chiudiModal('modalListino')">&times;</button></div>
      <div class="modal-body">
        <?php echo csrf_field(); ?>
        <input type="hidden" name="id" value="">
        <div class="form-row"><label>Listino prezzi</label>
          <select name="listino"><option value="base">Base</option><option value="silver">Silver</option><option value="gold">Gold</option></select>
        </div>
        <div class="form-row"><label>Sconto %</label><input type="number" step="0.01" name="sconto_percent" value="0"></div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" onclick="chiudiModal('modalListino')">Annulla</button>
        <button type="submit" class="btn" name="azione" value="salva_listino">Salva</button>
      </div>
    </form>
  </div>
</div>

<script>
function apriListino(d) { apriModalModifica('modalListino', d); }
</script>

<?php include __DIR__ . '/footer.php'; ?>
