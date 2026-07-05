<?php
/**
 * Ammirato Marmi - Gestionale
 * fatture.php - Elenco e gestione fatture
 */
require_once __DIR__ . '/config.php';
require_permission('fatture');

$stati = array('bozza' => 'Bozza', 'emessa' => 'Emessa', 'pagata' => 'Pagata', 'scaduta' => 'Scaduta', 'annullata' => 'Annullata');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $azione = post('azione');
    if ($azione === 'salva') {
        $id = post_int('id');
        $imponibile = post_dec('imponibile');
        $iva = round($imponibile * 0.22, 2);
        $totale = $imponibile + $iva;
        $cliente_id = post_int('cliente_id') ?: null;
        $progetto_id = post_int('progetto_id') ?: null;
        if ($id > 0) {
            q('UPDATE fatture SET cliente_id=?, progetto_id=?, data_emissione=?, data_scadenza=?, importo=?, importo_iva=?, importo_totale=?, descrizione=?, note=? WHERE id=?',
              array($cliente_id, $progetto_id, post('data_emissione') ?: null, post('data_scadenza') ?: null,
                    $imponibile, $iva, $totale, post('descrizione'), post('note'), $id));
            flash('Fattura aggiornata.');
        } else {
            $numero = prossimo_numero('fatture', 'FAT');
            q('INSERT INTO fatture (numero, cliente_id, progetto_id, data_emissione, data_scadenza, importo, importo_iva, importo_totale, stato, descrizione, note, created_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
              array($numero, $cliente_id, $progetto_id, post('data_emissione') ?: oggi(), post('data_scadenza') ?: null,
                    $imponibile, $iva, $totale, 'bozza', post('descrizione'), post('note'), adesso()));
            flash('Fattura ' . $numero . ' creata.');
        }
    } elseif ($azione === 'cambia_stato') {
        $st = post('stato');
        if (isset($stati[$st])) {
            q('UPDATE fatture SET stato = ? WHERE id = ?', array($st, post_int('id')));
            flash('Stato fattura aggiornato.');
        }
    } elseif ($azione === 'elimina') {
        q('DELETE FROM fatture WHERE id = ?', array(post_int('id')));
        flash('Fattura eliminata.');
    }
    redirect('fatture.php' . ($_GET ? '?' . http_build_query($_GET) : ''));
}

$titolo_pagina = 'Fatture';
$pagina_attiva = 'fatture';

// Marca automaticamente come scadute le fatture emesse oltre la scadenza
q("UPDATE fatture SET stato = 'scaduta' WHERE stato = 'emessa' AND data_scadenza IS NOT NULL AND data_scadenza < ?", array(oggi()));

$filtro = get('stato', 'tutti');
$dove = ''; $par = array();
if (isset($stati[$filtro])) { $dove = 'WHERE f.stato = ?'; $par[] = $filtro; }

$fatture = q_all("SELECT f.*, c.nome AS cliente_nome FROM fatture f LEFT JOIN clienti c ON c.id = f.cliente_id $dove ORDER BY f.created_at DESC", $par);

$da_incassare = (float) q_val("SELECT COALESCE(SUM(importo_totale),0) FROM fatture WHERE stato IN ('emessa','scaduta')");
$incassate = (float) q_val("SELECT COALESCE(SUM(importo_totale),0) FROM fatture WHERE stato = 'pagata'");

$clienti = q_all('SELECT id, nome FROM clienti ORDER BY nome');
$progetti = q_all('SELECT id, nome FROM progetti ORDER BY nome');

include __DIR__ . '/header.php';
?>

<div class="stat-grid">
  <div class="stat" style="border-top-color:var(--rosso);"><div class="num"><?php echo euro($da_incassare); ?></div><div class="lbl">Da incassare</div></div>
  <div class="stat" style="border-top-color:var(--verde);"><div class="num"><?php echo euro($incassate); ?></div><div class="lbl">Incassate</div></div>
</div>

<div class="card">
  <div class="card-header">
    <h2>Fatture</h2><div class="spacer"></div>
    <button class="btn btn-oro" onclick="apriFattura()">Nuova fattura</button>
  </div>

  <div class="filtri">
    <a class="chip <?php echo $filtro === 'tutti' ? 'attivo' : ''; ?>" href="fatture.php?stato=tutti">Tutte</a>
    <?php foreach ($stati as $k => $lbl): ?>
      <a class="chip <?php echo $filtro === $k ? 'attivo' : ''; ?>" href="fatture.php?stato=<?php echo $k; ?>"><?php echo $lbl; ?></a>
    <?php endforeach; ?>
  </div>

  <?php if (!$fatture): ?>
    <p class="muted">Nessuna fattura.</p>
  <?php else: ?>
    <table class="tab">
      <thead><tr><th>Numero</th><th>Cliente</th><th>Emissione</th><th>Scadenza</th><th class="text-right">Totale</th><th>Stato</th><th class="azioni">Azioni</th></tr></thead>
      <tbody>
      <?php foreach ($fatture as $f): ?>
        <?php $scaduta = $f['stato'] === 'scaduta' || ($f['stato'] === 'emessa' && $f['data_scadenza'] && $f['data_scadenza'] < oggi()); ?>
        <tr class="<?php echo $scaduta ? 'riga-rossa' : ''; ?>">
          <td><?php echo e($f['numero']); ?></td>
          <td class="muted"><?php echo e($f['cliente_nome'] ? $f['cliente_nome'] : '-'); ?></td>
          <td class="nowrap"><?php echo data_it($f['data_emissione']); ?></td>
          <td class="nowrap"><?php echo data_it($f['data_scadenza']); ?></td>
          <td class="text-right"><?php echo euro($f['importo_totale']); ?></td>
          <td>
            <select class="stato-inline" data-id="<?php echo (int)$f['id']; ?>" onchange="cambiaStato(this,'fatture.php','stato')">
              <?php foreach ($stati as $k => $lbl): ?><option value="<?php echo $k; ?>" <?php echo $f['stato'] === $k ? 'selected' : ''; ?>><?php echo $lbl; ?></option><?php endforeach; ?>
            </select>
          </td>
          <td class="azioni">
            <button class="btn-link" onclick='modificaFattura(<?php echo json_encode(array(
              "id"=>$f["id"],"cliente_id"=>$f["cliente_id"],"progetto_id"=>$f["progetto_id"],
              "data_emissione"=>$f["data_emissione"],"data_scadenza"=>$f["data_scadenza"],"imponibile"=>$f["importo"],
              "descrizione"=>$f["descrizione"],"note"=>$f["note"],
            ), JSON_HEX_APOS|JSON_HEX_QUOT); ?>)'>Modifica</button>
            <form method="post" style="display:inline;" onsubmit="return confirm('Eliminare la fattura?')">
              <?php echo csrf_field(); ?><input type="hidden" name="id" value="<?php echo (int)$f['id']; ?>">
              <button class="btn-link danger" name="azione" value="elimina">Elimina</button>
            </form>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  <?php endif; ?>
</div>

<div class="modal-bg" id="modalFattura">
  <div class="modal">
    <form method="post" action="fatture.php<?php echo $_GET ? '?' . http_build_query($_GET) : ''; ?>">
      <div class="modal-head"><h3 id="modalFatTitolo">Nuova fattura</h3><button type="button" class="chiudi" onclick="chiudiModal('modalFattura')">&times;</button></div>
      <div class="modal-body">
        <?php echo csrf_field(); ?>
        <input type="hidden" name="id" value="">
        <input type="hidden" name="importo_iva" id="importo_iva" value="">
        <input type="hidden" name="importo_totale" id="importo_totale" value="">
        <div class="form-grid">
          <div class="form-row"><label>Cliente</label>
            <select name="cliente_id"><option value="">- nessuno -</option>
              <?php foreach ($clienti as $c): ?><option value="<?php echo (int)$c['id']; ?>"><?php echo e($c['nome']); ?></option><?php endforeach; ?>
            </select>
          </div>
          <div class="form-row"><label>Progetto</label>
            <select name="progetto_id"><option value="">- nessuno -</option>
              <?php foreach ($progetti as $pg): ?><option value="<?php echo (int)$pg['id']; ?>"><?php echo e($pg['nome']); ?></option><?php endforeach; ?>
            </select>
          </div>
        </div>
        <div class="form-grid">
          <div class="form-row"><label>Data emissione</label><input type="date" name="data_emissione"></div>
          <div class="form-row"><label>Scadenza</label><input type="date" name="data_scadenza"></div>
        </div>
        <div class="form-row"><label>Imponibile &euro;</label><input type="number" step="0.01" id="imponibile" name="imponibile" value="0" oninput="calcolaIvaFattura()"></div>
        <div class="dl" style="margin:10px 0;">
          <dt>IVA 22%</dt><dd id="vistaIva">&euro; 0,00</dd>
          <dt>Totale</dt><dd id="vistaTotale" style="font-weight:600;">&euro; 0,00</dd>
        </div>
        <div class="form-row"><label>Descrizione</label><textarea name="descrizione"></textarea></div>
        <div class="form-row"><label>Note</label><textarea name="note"></textarea></div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" onclick="chiudiModal('modalFattura')">Annulla</button>
        <button type="submit" class="btn" name="azione" value="salva">Salva</button>
      </div>
    </form>
  </div>
</div>

<script>
function apriFattura() {
  apriModalModifica('modalFattura', {id:'', cliente_id:'', progetto_id:'', data_emissione:'', data_scadenza:'', imponibile:'0', descrizione:'', note:''});
  document.getElementById('modalFatTitolo').textContent = 'Nuova fattura';
  calcolaIvaFattura();
}
function modificaFattura(d) {
  apriModalModifica('modalFattura', d);
  document.getElementById('modalFatTitolo').textContent = 'Modifica fattura';
  calcolaIvaFattura();
}
</script>

<?php include __DIR__ . '/footer.php'; ?>
