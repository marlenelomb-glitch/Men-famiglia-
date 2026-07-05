<?php
/**
 * Ammirato Marmi - Gestionale
 * preventivi.php - Elenco e gestione preventivi
 */
require_once __DIR__ . '/config.php';
require_permission('preventivi');

$stati = array('bozza' => 'Bozza', 'inviato' => 'Inviato', 'accettato' => 'Accettato', 'rifiutato' => 'Rifiutato', 'scaduto' => 'Scaduto');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $azione = post('azione');
    if ($azione === 'salva') {
        $id = post_int('id');
        $mano = post_dec('costo_manodopera');
        $mat = post_dec('costo_materiali');
        $trasp = post_dec('costo_trasporto');
        $sconto = post_dec('sconto_percent');
        $subtot = $mano + $mat + $trasp;
        $importo = $subtot - ($subtot * $sconto / 100);
        $cliente_id = post_int('cliente_id') ?: null;
        $progetto_id = post_int('progetto_id') ?: null;

        if ($id > 0) {
            q('UPDATE preventivi SET cliente_id=?, progetto_id=?, data_emissione=?, data_validita=?, descrizione=?, note=?, costo_manodopera=?, costo_materiali=?, costo_trasporto=?, sconto_percent=?, importo=? WHERE id=?',
              array($cliente_id, $progetto_id, post('data_emissione') ?: null, post('data_validita') ?: null,
                    post('descrizione'), post('note'), $mano, $mat, $trasp, $sconto, $importo, $id));
            flash('Preventivo aggiornato.');
        } else {
            $numero = prossimo_numero('preventivi', 'PRE');
            q('INSERT INTO preventivi (numero, cliente_id, progetto_id, data_emissione, data_validita, importo, stato, descrizione, note, costo_manodopera, costo_materiali, costo_trasporto, sconto_percent, created_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
              array($numero, $cliente_id, $progetto_id, post('data_emissione') ?: oggi(), post('data_validita') ?: null,
                    $importo, 'bozza', post('descrizione'), post('note'), $mano, $mat, $trasp, $sconto, adesso()));
            flash('Preventivo ' . $numero . ' creato.');
        }
    } elseif ($azione === 'cambia_stato') {
        $st = post('stato');
        if (isset($stati[$st])) {
            q('UPDATE preventivi SET stato = ? WHERE id = ?', array($st, post_int('id')));
            flash('Stato preventivo aggiornato.');
        }
    } elseif ($azione === 'elimina') {
        $pid = post_int('id');
        q('DELETE FROM preventivo_voci WHERE preventivo_id = ?', array($pid));
        q('DELETE FROM preventivi WHERE id = ?', array($pid));
        flash('Preventivo eliminato.');
    }
    redirect('preventivi.php' . ($_GET ? '?' . http_build_query($_GET) : ''));
}

$titolo_pagina = 'Preventivi';
$pagina_attiva = 'preventivi';

$filtro = get('stato', 'tutti');
$dove = ''; $par = array();
if (isset($stati[$filtro])) { $dove = 'WHERE pr.stato = ?'; $par[] = $filtro; }

$preventivi = q_all(
    "SELECT pr.*, c.nome AS cliente_nome FROM preventivi pr
     LEFT JOIN clienti c ON c.id = pr.cliente_id
     $dove ORDER BY pr.created_at DESC", $par);
$clienti = q_all('SELECT id, nome FROM clienti ORDER BY nome');
$progetti = q_all('SELECT id, nome FROM progetti ORDER BY nome');

include __DIR__ . '/header.php';
?>

<div class="card">
  <div class="card-header">
    <h2>Preventivi</h2><div class="spacer"></div>
    <button class="btn btn-oro" onclick="apriPreventivo()">Nuovo preventivo</button>
  </div>

  <div class="filtri">
    <a class="chip <?php echo $filtro === 'tutti' ? 'attivo' : ''; ?>" href="preventivi.php?stato=tutti">Tutti</a>
    <?php foreach ($stati as $k => $lbl): ?>
      <a class="chip <?php echo $filtro === $k ? 'attivo' : ''; ?>" href="preventivi.php?stato=<?php echo $k; ?>"><?php echo $lbl; ?></a>
    <?php endforeach; ?>
  </div>

  <?php if (!$preventivi): ?>
    <p class="muted">Nessun preventivo.</p>
  <?php else: ?>
    <table class="tab">
      <thead><tr><th>Numero</th><th>Cliente</th><th>Emissione</th><th class="text-right">Importo</th><th>Stato</th><th class="azioni">Azioni</th></tr></thead>
      <tbody>
      <?php foreach ($preventivi as $pr): ?>
        <tr>
          <td><a href="preventivo.php?id=<?php echo (int)$pr['id']; ?>"><?php echo e($pr['numero']); ?></a></td>
          <td class="muted"><?php echo e($pr['cliente_nome'] ? $pr['cliente_nome'] : '-'); ?></td>
          <td class="nowrap"><?php echo data_it($pr['data_emissione']); ?></td>
          <td class="text-right"><?php echo euro($pr['importo']); ?></td>
          <td>
            <select class="stato-inline" data-id="<?php echo (int)$pr['id']; ?>" onchange="cambiaStato(this,'preventivi.php','stato')">
              <?php foreach ($stati as $k => $lbl): ?><option value="<?php echo $k; ?>" <?php echo $pr['stato'] === $k ? 'selected' : ''; ?>><?php echo $lbl; ?></option><?php endforeach; ?>
            </select>
          </td>
          <td class="azioni">
            <button class="btn-link" onclick='modificaPreventivo(<?php echo json_encode(array(
              "id"=>$pr["id"],"cliente_id"=>$pr["cliente_id"],"progetto_id"=>$pr["progetto_id"],
              "data_emissione"=>$pr["data_emissione"],"data_validita"=>$pr["data_validita"],"descrizione"=>$pr["descrizione"],"note"=>$pr["note"],
              "costo_manodopera"=>$pr["costo_manodopera"],"costo_materiali"=>$pr["costo_materiali"],"costo_trasporto"=>$pr["costo_trasporto"],"sconto_percent"=>$pr["sconto_percent"],
            ), JSON_HEX_APOS|JSON_HEX_QUOT); ?>)'>Modifica</button>
            <form method="post" style="display:inline;" onsubmit="return confirm('Eliminare il preventivo?')">
              <?php echo csrf_field(); ?><input type="hidden" name="id" value="<?php echo (int)$pr['id']; ?>">
              <button class="btn-link danger" name="azione" value="elimina">Elimina</button>
            </form>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  <?php endif; ?>
</div>

<div class="modal-bg" id="modalPreventivo">
  <div class="modal wide">
    <form method="post" action="preventivi.php<?php echo $_GET ? '?' . http_build_query($_GET) : ''; ?>">
      <div class="modal-head"><h3 id="modalPrevTitolo">Nuovo preventivo</h3><button type="button" class="chiudi" onclick="chiudiModal('modalPreventivo')">&times;</button></div>
      <div class="modal-body">
        <?php echo csrf_field(); ?>
        <input type="hidden" name="id" value="">
        <input type="hidden" name="importo_calcolato" id="importo_calcolato" value="">
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
          <div class="form-row"><label>Validita' fino al</label><input type="date" name="data_validita"></div>
        </div>
        <div class="form-row"><label>Descrizione lavoro</label><textarea name="descrizione"></textarea></div>
        <div class="form-grid">
          <div class="form-row"><label>Costo manodopera &euro;</label><input type="number" step="0.01" id="costo_manodopera" name="costo_manodopera" value="0" oninput="calcolaTotalePreventivo()"></div>
          <div class="form-row"><label>Costo materiali &euro;</label><input type="number" step="0.01" id="costo_materiali" name="costo_materiali" value="0" oninput="calcolaTotalePreventivo()"></div>
        </div>
        <div class="form-grid">
          <div class="form-row"><label>Costo trasporto &euro;</label><input type="number" step="0.01" id="costo_trasporto" name="costo_trasporto" value="0" oninput="calcolaTotalePreventivo()"></div>
          <div class="form-row"><label>Sconto %</label><input type="number" step="0.01" id="sconto_percent" name="sconto_percent" value="0" oninput="calcolaTotalePreventivo()"></div>
        </div>
        <div class="form-row"><label>Note</label><textarea name="note"></textarea></div>
        <div class="totale-box">Totale: <span id="totalePreventivo">&euro; 0,00</span></div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" onclick="chiudiModal('modalPreventivo')">Annulla</button>
        <button type="submit" class="btn" name="azione" value="salva">Salva</button>
      </div>
    </form>
  </div>
</div>

<script>
function apriPreventivo() {
  apriModalModifica('modalPreventivo', {id:'', cliente_id:'', progetto_id:'', data_emissione:'', data_validita:'', descrizione:'', note:'', costo_manodopera:'0', costo_materiali:'0', costo_trasporto:'0', sconto_percent:'0'});
  document.getElementById('modalPrevTitolo').textContent = 'Nuovo preventivo';
  calcolaTotalePreventivo();
}
function modificaPreventivo(d) {
  apriModalModifica('modalPreventivo', d);
  document.getElementById('modalPrevTitolo').textContent = 'Modifica preventivo';
  calcolaTotalePreventivo();
}
</script>

<?php include __DIR__ . '/footer.php'; ?>
