<?php
/**
 * Ammirato Marmi - Gestionale
 * finanze.php - Entrate/uscite e utile netto mensile
 */
require_once __DIR__ . '/config.php';
require_permission('finanze');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $azione = post('azione');
    if ($azione === 'salva') {
        $id = post_int('id');
        $tipo = post('tipo') === 'uscita' ? 'uscita' : 'entrata';
        $data = post('data') ?: oggi();
        if (post('descrizione') === '') {
            flash('La descrizione e' . "'" . ' obbligatoria.', 'err');
        } elseif ($id > 0) {
            q('UPDATE transazioni SET data=?, tipo=?, categoria=?, importo=?, descrizione=?, note=? WHERE id=?',
              array($data, $tipo, post('categoria'), post_dec('importo'), post('descrizione'), post('note'), $id));
            flash('Movimento aggiornato.');
        } else {
            q('INSERT INTO transazioni (data, tipo, categoria, importo, descrizione, note, created_at) VALUES (?,?,?,?,?,?,?)',
              array($data, $tipo, post('categoria'), post_dec('importo'), post('descrizione'), post('note'), adesso()));
            flash('Movimento registrato.');
        }
    } elseif ($azione === 'elimina') {
        q('DELETE FROM transazioni WHERE id = ?', array(post_int('id')));
        flash('Movimento eliminato.');
    }
    redirect('finanze.php?anno=' . get('anno', date('Y')) . '&mese=' . get('mese', date('n')));
}

$titolo_pagina = 'Finanze';
$pagina_attiva = 'finanze';

$anno = (int) get('anno', date('Y'));
$mese = (int) get('mese', date('n'));
if ($mese < 1) { $mese = 12; $anno--; }
if ($mese > 12) { $mese = 1; $anno++; }

$primo = sprintf('%04d-%02d-01', $anno, $mese);
$ultimo = date('Y-m-t', strtotime($primo));

$movimenti = q_all('SELECT * FROM transazioni WHERE data BETWEEN ? AND ? ORDER BY data DESC, id DESC', array($primo, $ultimo));
$tot_entrate = (float) q_val("SELECT COALESCE(SUM(importo),0) FROM transazioni WHERE tipo='entrata' AND data BETWEEN ? AND ?", array($primo, $ultimo));
$tot_uscite = (float) q_val("SELECT COALESCE(SUM(importo),0) FROM transazioni WHERE tipo='uscita' AND data BETWEEN ? AND ?", array($primo, $ultimo));
$utile = $tot_entrate - $tot_uscite;

$mesi_it = array(1=>'Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre');

include __DIR__ . '/header.php';
?>

<div class="card">
  <div class="card-header">
    <a class="btn btn-ghost btn-sm" href="finanze.php?anno=<?php echo $anno; ?>&mese=<?php echo $mese - 1; ?>">&larr;</a>
    <h2 style="margin:0 8px;"><?php echo $mesi_it[$mese] . ' ' . $anno; ?></h2>
    <a class="btn btn-ghost btn-sm" href="finanze.php?anno=<?php echo $anno; ?>&mese=<?php echo $mese + 1; ?>">&rarr;</a>
    <div class="spacer"></div>
    <button class="btn btn-oro" onclick="apriMovimento()">Nuovo movimento</button>
  </div>

  <div class="stat-grid">
    <div class="stat" style="border-top-color:var(--verde);"><div class="num"><?php echo euro($tot_entrate); ?></div><div class="lbl">Entrate</div></div>
    <div class="stat" style="border-top-color:var(--rosso);"><div class="num"><?php echo euro($tot_uscite); ?></div><div class="lbl">Uscite</div></div>
    <div class="stat" style="border-top-color:var(--oro);"><div class="num"><?php echo euro($utile); ?></div><div class="lbl">Utile netto</div></div>
  </div>

  <?php if (!$movimenti): ?>
    <p class="muted">Nessun movimento in questo mese.</p>
  <?php else: ?>
    <table class="tab">
      <thead><tr><th>Data</th><th>Descrizione</th><th>Categoria</th><th>Tipo</th><th class="text-right">Importo</th><th class="azioni"></th></tr></thead>
      <tbody>
      <?php foreach ($movimenti as $m): ?>
        <tr>
          <td class="nowrap"><?php echo data_it($m['data']); ?></td>
          <td><?php echo e($m['descrizione']); ?></td>
          <td class="muted"><?php echo e($m['categoria']); ?></td>
          <td><span class="badge <?php echo $m['tipo'] === 'entrata' ? 'badge-verde' : 'badge-rosso'; ?>"><?php echo e($m['tipo']); ?></span></td>
          <td class="text-right"><?php echo ($m['tipo'] === 'uscita' ? '- ' : '') . euro($m['importo']); ?></td>
          <td class="azioni">
            <button class="btn-link" onclick='modificaMovimento(<?php echo json_encode(array(
              "id"=>$m["id"],"data"=>$m["data"],"tipo"=>$m["tipo"],"categoria"=>$m["categoria"],"importo"=>$m["importo"],"descrizione"=>$m["descrizione"],"note"=>$m["note"],
            ), JSON_HEX_APOS|JSON_HEX_QUOT); ?>)'>Modifica</button>
            <form method="post" style="display:inline;" onsubmit="return confirm('Eliminare il movimento?')">
              <?php echo csrf_field(); ?><input type="hidden" name="id" value="<?php echo (int)$m['id']; ?>">
              <button class="btn-link danger" name="azione" value="elimina">Elimina</button>
            </form>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  <?php endif; ?>
</div>

<div class="modal-bg" id="modalMovimento">
  <div class="modal">
    <form method="post" action="finanze.php?anno=<?php echo $anno; ?>&mese=<?php echo $mese; ?>">
      <div class="modal-head"><h3 id="modalMovTitolo">Nuovo movimento</h3><button type="button" class="chiudi" onclick="chiudiModal('modalMovimento')">&times;</button></div>
      <div class="modal-body">
        <?php echo csrf_field(); ?>
        <input type="hidden" name="id" value="">
        <div class="form-grid">
          <div class="form-row"><label>Data</label><input type="date" name="data" value="<?php echo oggi(); ?>"></div>
          <div class="form-row"><label>Tipo</label>
            <select name="tipo"><option value="entrata">Entrata</option><option value="uscita">Uscita</option></select>
          </div>
        </div>
        <div class="form-row"><label>Descrizione *</label><input type="text" name="descrizione" required></div>
        <div class="form-grid">
          <div class="form-row"><label>Categoria</label><input type="text" name="categoria" placeholder="es. Pagamento fattura"></div>
          <div class="form-row"><label>Importo &euro;</label><input type="number" step="0.01" name="importo" value="0"></div>
        </div>
        <div class="form-row"><label>Note</label><textarea name="note"></textarea></div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" onclick="chiudiModal('modalMovimento')">Annulla</button>
        <button type="submit" class="btn" name="azione" value="salva">Salva</button>
      </div>
    </form>
  </div>
</div>

<script>
function apriMovimento() {
  apriModalModifica('modalMovimento', {id:'', data:'<?php echo oggi(); ?>', tipo:'entrata', categoria:'', importo:'0', descrizione:'', note:''});
  document.getElementById('modalMovTitolo').textContent = 'Nuovo movimento';
}
function modificaMovimento(d) {
  apriModalModifica('modalMovimento', d);
  document.getElementById('modalMovTitolo').textContent = 'Modifica movimento';
}
</script>

<?php include __DIR__ . '/footer.php'; ?>
