<?php
/**
 * Ammirato Marmi - Gestionale
 * risorse.php - Operai e macchinari
 */
require_once __DIR__ . '/config.php';
require_permission('risorse');

$disponibilita = array('full' => 'Full time', 'part' => 'Part time', 'contratto' => 'A contratto');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $azione = post('azione');
    if ($azione === 'salva') {
        $id = post_int('id');
        $tipo = post('tipo') === 'macchinario' ? 'macchinario' : 'operaio';
        $tariffa = $tipo === 'operaio' ? post_dec('tariffa_oraria') : null;
        $disp = $tipo === 'operaio' ? post('disponibilita') : null;
        if (post('nome') === '') {
            flash('Il nome e' . "'" . ' obbligatorio.', 'err');
        } elseif ($id > 0) {
            q('UPDATE risorse SET nome=?, tipo=?, tariffa_oraria=?, disponibilita=?, note=? WHERE id=?',
              array(post('nome'), $tipo, $tariffa, $disp, post('note'), $id));
            flash('Risorsa aggiornata.');
        } else {
            q('INSERT INTO risorse (nome, tipo, tariffa_oraria, disponibilita, note, attivo, created_at) VALUES (?,?,?,?,?,1,?)',
              array(post('nome'), $tipo, $tariffa, $disp, post('note'), adesso()));
            flash('Risorsa aggiunta.');
        }
    } elseif ($azione === 'toggle') {
        q('UPDATE risorse SET attivo = 1 - attivo WHERE id = ?', array(post_int('id')));
        flash('Stato risorsa aggiornato.');
    } elseif ($azione === 'elimina') {
        q('DELETE FROM risorse WHERE id = ?', array(post_int('id')));
        flash('Risorsa eliminata.');
    }
    redirect('risorse.php');
}

$titolo_pagina = 'Risorse';
$pagina_attiva = 'risorse';

$operai = q_all("SELECT * FROM risorse WHERE tipo = 'operaio' ORDER BY nome");
$macchinari = q_all("SELECT * FROM risorse WHERE tipo = 'macchinario' ORDER BY nome");

include __DIR__ . '/header.php';
?>

<div class="card">
  <div class="card-header">
    <h2>Operai</h2><div class="spacer"></div>
    <button class="btn btn-oro" onclick="apriRisorsa('operaio')">Nuovo operaio</button>
  </div>
  <?php if (!$operai): ?><p class="muted">Nessun operaio.</p><?php else: ?>
    <table class="tab">
      <thead><tr><th>Nome</th><th>Disponibilita'</th><th class="text-right">Tariffa/h</th><th>Stato</th><th class="azioni">Azioni</th></tr></thead>
      <tbody>
      <?php foreach ($operai as $o): ?>
        <tr>
          <td><?php echo e($o['nome']); ?></td>
          <td><?php echo e(isset($disponibilita[$o['disponibilita']]) ? $disponibilita[$o['disponibilita']] : '-'); ?></td>
          <td class="text-right"><?php echo $o['tariffa_oraria'] > 0 ? euro($o['tariffa_oraria']) : '-'; ?></td>
          <td><span class="badge <?php echo $o['attivo'] ? 'badge-verde' : 'badge-grigio'; ?>"><?php echo $o['attivo'] ? 'attivo' : 'inattivo'; ?></span></td>
          <td class="azioni">
            <button class="btn-link" onclick='modificaRisorsa(<?php echo json_encode(array("id"=>$o["id"],"nome"=>$o["nome"],"tipo"=>$o["tipo"],"tariffa_oraria"=>$o["tariffa_oraria"],"disponibilita"=>$o["disponibilita"],"note"=>$o["note"]), JSON_HEX_APOS|JSON_HEX_QUOT); ?>)'>Modifica</button>
            <form method="post" style="display:inline;"><?php echo csrf_field(); ?><input type="hidden" name="id" value="<?php echo (int)$o['id']; ?>"><button class="btn-link" name="azione" value="toggle"><?php echo $o['attivo'] ? 'Disattiva' : 'Attiva'; ?></button></form>
            <form method="post" style="display:inline;" onsubmit="return confirm('Eliminare?')"><?php echo csrf_field(); ?><input type="hidden" name="id" value="<?php echo (int)$o['id']; ?>"><button class="btn-link danger" name="azione" value="elimina">Elimina</button></form>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  <?php endif; ?>
</div>

<div class="card">
  <div class="card-header">
    <h2>Macchinari</h2><div class="spacer"></div>
    <button class="btn btn-oro" onclick="apriRisorsa('macchinario')">Nuovo macchinario</button>
  </div>
  <?php if (!$macchinari): ?><p class="muted">Nessun macchinario.</p><?php else: ?>
    <table class="tab">
      <thead><tr><th>Nome</th><th>Note</th><th>Stato</th><th class="azioni">Azioni</th></tr></thead>
      <tbody>
      <?php foreach ($macchinari as $mc): ?>
        <tr>
          <td><?php echo e($mc['nome']); ?></td>
          <td class="muted"><?php echo e($mc['note']); ?></td>
          <td><span class="badge <?php echo $mc['attivo'] ? 'badge-verde' : 'badge-grigio'; ?>"><?php echo $mc['attivo'] ? 'attivo' : 'inattivo'; ?></span></td>
          <td class="azioni">
            <button class="btn-link" onclick='modificaRisorsa(<?php echo json_encode(array("id"=>$mc["id"],"nome"=>$mc["nome"],"tipo"=>$mc["tipo"],"tariffa_oraria"=>$mc["tariffa_oraria"],"disponibilita"=>$mc["disponibilita"],"note"=>$mc["note"]), JSON_HEX_APOS|JSON_HEX_QUOT); ?>)'>Modifica</button>
            <form method="post" style="display:inline;"><?php echo csrf_field(); ?><input type="hidden" name="id" value="<?php echo (int)$mc['id']; ?>"><button class="btn-link" name="azione" value="toggle"><?php echo $mc['attivo'] ? 'Disattiva' : 'Attiva'; ?></button></form>
            <form method="post" style="display:inline;" onsubmit="return confirm('Eliminare?')"><?php echo csrf_field(); ?><input type="hidden" name="id" value="<?php echo (int)$mc['id']; ?>"><button class="btn-link danger" name="azione" value="elimina">Elimina</button></form>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  <?php endif; ?>
</div>

<div class="modal-bg" id="modalRisorsa">
  <div class="modal">
    <form method="post" action="risorse.php">
      <div class="modal-head"><h3 id="modalRisTitolo">Nuova risorsa</h3><button type="button" class="chiudi" onclick="chiudiModal('modalRisorsa')">&times;</button></div>
      <div class="modal-body">
        <?php echo csrf_field(); ?>
        <input type="hidden" name="id" value="">
        <input type="hidden" name="tipo" value="operaio">
        <div class="form-row"><label>Nome *</label><input type="text" name="nome" required></div>
        <div id="campiOperaio">
          <div class="form-grid">
            <div class="form-row"><label>Disponibilita'</label>
              <select name="disponibilita"><?php foreach ($disponibilita as $k => $lbl): ?><option value="<?php echo $k; ?>"><?php echo $lbl; ?></option><?php endforeach; ?></select>
            </div>
            <div class="form-row"><label>Tariffa oraria &euro;</label><input type="number" step="0.01" name="tariffa_oraria" value="0"></div>
          </div>
        </div>
        <div class="form-row"><label>Note</label><textarea name="note"></textarea></div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" onclick="chiudiModal('modalRisorsa')">Annulla</button>
        <button type="submit" class="btn" name="azione" value="salva">Salva</button>
      </div>
    </form>
  </div>
</div>

<script>
function aggiornaCampiTipo(tipo) {
  var box = document.getElementById('campiOperaio');
  box.style.display = tipo === 'macchinario' ? 'none' : 'block';
}
function apriRisorsa(tipo) {
  apriModalModifica('modalRisorsa', {id:'', nome:'', tipo:tipo, tariffa_oraria:'0', disponibilita:'full', note:''});
  document.getElementById('modalRisTitolo').textContent = tipo === 'macchinario' ? 'Nuovo macchinario' : 'Nuovo operaio';
  aggiornaCampiTipo(tipo);
}
function modificaRisorsa(d) {
  apriModalModifica('modalRisorsa', d);
  document.getElementById('modalRisTitolo').textContent = d.tipo === 'macchinario' ? 'Modifica macchinario' : 'Modifica operaio';
  aggiornaCampiTipo(d.tipo);
}
</script>

<?php include __DIR__ . '/footer.php'; ?>
