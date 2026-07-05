<?php
/**
 * Ammirato Marmi - Gestionale
 * calendario.php - Vista mensile eventi
 */
require_once __DIR__ . '/config.php';
require_permission('calendario');

$tipi = array('sopralluogo' => 'Sopralluogo', 'riunione' => 'Riunione', 'consegna' => 'Consegna', 'installazione' => 'Installazione', 'altro' => 'Altro');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $azione = post('azione');
    if ($azione === 'salva') {
        $id = post_int('id');
        $tutto = isset($_POST['tutto_il_giorno']) ? 1 : 0;
        $progetto_id = post_int('progetto_id') ?: null;
        $cliente_id = post_int('cliente_id') ?: null;
        $inizio = post('data_inizio');
        $fine = post('data_fine');
        if (post('titolo') === '' || $inizio === '') {
            flash('Titolo e data inizio obbligatori.', 'err');
        } elseif ($id > 0) {
            q('UPDATE eventi SET titolo=?, descrizione=?, data_inizio=?, data_fine=?, tutto_il_giorno=?, progetto_id=?, cliente_id=?, tipo=? WHERE id=?',
              array(post('titolo'), post('descrizione'), $inizio, $fine ?: null, $tutto, $progetto_id, $cliente_id, post('tipo'), $id));
            flash('Evento aggiornato.');
        } else {
            q('INSERT INTO eventi (titolo, descrizione, data_inizio, data_fine, tutto_il_giorno, progetto_id, cliente_id, tipo, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
              array(post('titolo'), post('descrizione'), $inizio, $fine ?: null, $tutto, $progetto_id, $cliente_id, post('tipo'), adesso()));
            flash('Evento creato.');
        }
    } elseif ($azione === 'elimina') {
        q('DELETE FROM eventi WHERE id = ?', array(post_int('id')));
        flash('Evento eliminato.');
    }
    redirect('calendario.php?anno=' . get('anno', date('Y')) . '&mese=' . get('mese', date('n')));
}

$titolo_pagina = 'Calendario';
$pagina_attiva = 'calendario';

$anno = (int) get('anno', date('Y'));
$mese = (int) get('mese', date('n'));
if ($mese < 1) { $mese = 12; $anno--; }
if ($mese > 12) { $mese = 1; $anno++; }

$primo = sprintf('%04d-%02d-01', $anno, $mese);
$ultimo = date('Y-m-t', strtotime($primo));
$giorni_mese = (int) date('t', strtotime($primo));
$giorno_settimana_primo = (int) date('N', strtotime($primo)); // 1=lun

// Eventi del mese, raggruppati per giorno
$eventi = q_all('SELECT * FROM eventi WHERE DATE(data_inizio) BETWEEN ? AND ? ORDER BY data_inizio ASC', array($primo, $ultimo));
$per_giorno = array();
foreach ($eventi as $ev) {
    $g = (int) date('j', strtotime($ev['data_inizio']));
    $per_giorno[$g][] = array('titolo' => $ev['titolo'], 'scadenza' => false, 'id' => $ev['id']);
}
// Scadenze fatture del mese
$scad = q_all("SELECT numero, data_scadenza FROM fatture WHERE data_scadenza BETWEEN ? AND ? AND stato IN ('emessa','scaduta')", array($primo, $ultimo));
foreach ($scad as $s) {
    $g = (int) date('j', strtotime($s['data_scadenza']));
    $per_giorno[$g][] = array('titolo' => 'Scad. ' . $s['numero'], 'scadenza' => true, 'id' => 0);
}

$mesi_it = array(1=>'Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre');
$oggi_giorno = ($anno == date('Y') && $mese == date('n')) ? (int)date('j') : -1;

$clienti = q_all('SELECT id, nome FROM clienti ORDER BY nome');
$progetti = q_all('SELECT id, nome FROM progetti ORDER BY nome');

include __DIR__ . '/header.php';
?>

<div class="card">
  <div class="card-header">
    <a class="btn btn-ghost btn-sm" href="calendario.php?anno=<?php echo $anno; ?>&mese=<?php echo $mese - 1; ?>">&larr;</a>
    <h2 style="margin:0 8px;"><?php echo $mesi_it[$mese] . ' ' . $anno; ?></h2>
    <a class="btn btn-ghost btn-sm" href="calendario.php?anno=<?php echo $anno; ?>&mese=<?php echo $mese + 1; ?>">&rarr;</a>
    <div class="spacer"></div>
    <button class="btn btn-oro" onclick="apriEvento()">Nuovo evento</button>
  </div>

  <table class="cal">
    <thead><tr><th>Lun</th><th>Mar</th><th>Mer</th><th>Gio</th><th>Ven</th><th>Sab</th><th>Dom</th></tr></thead>
    <tbody>
      <tr>
      <?php
      // Celle vuote iniziali
      for ($i = 1; $i < $giorno_settimana_primo; $i++) echo '<td class="vuoto"></td>';
      $col = $giorno_settimana_primo;
      for ($g = 1; $g <= $giorni_mese; $g++):
      ?>
        <td class="<?php echo $g === $oggi_giorno ? 'oggi' : ''; ?>">
          <div class="giorno-num"><?php echo $g; ?></div>
          <?php if (!empty($per_giorno[$g])): foreach ($per_giorno[$g] as $ev): ?>
            <span class="cal-ev <?php echo $ev['scadenza'] ? 'scadenza' : ''; ?>" title="<?php echo e($ev['titolo']); ?>"><?php echo e($ev['titolo']); ?></span>
          <?php endforeach; endif; ?>
        </td>
        <?php
        if ($col % 7 === 0 && $g < $giorni_mese) echo '</tr><tr>';
        $col++;
      endfor;
      // Celle vuote finali
      while (($col - 1) % 7 !== 0) { echo '<td class="vuoto"></td>'; $col++; }
      ?>
      </tr>
    </tbody>
  </table>
</div>

<div class="card">
  <div class="card-header"><h2>Eventi del mese</h2></div>
  <?php if (!$eventi): ?><p class="muted">Nessun evento questo mese.</p><?php else: ?>
    <table class="tab">
      <thead><tr><th>Data</th><th>Titolo</th><th>Tipo</th><th class="azioni"></th></tr></thead>
      <tbody>
      <?php foreach ($eventi as $ev): ?>
        <tr>
          <td class="nowrap"><?php echo datetime_it($ev['data_inizio']); ?></td>
          <td><?php echo e($ev['titolo']); ?></td>
          <td><span class="badge badge-grigio"><?php echo e(isset($tipi[$ev['tipo']]) ? $tipi[$ev['tipo']] : $ev['tipo']); ?></span></td>
          <td class="azioni">
            <button class="btn-link" onclick='modificaEvento(<?php echo json_encode(array(
              "id"=>$ev["id"],"titolo"=>$ev["titolo"],"descrizione"=>$ev["descrizione"],
              "data_inizio"=>str_replace(' ','T',substr($ev["data_inizio"],0,16)),
              "data_fine"=>$ev["data_fine"] ? str_replace(' ','T',substr($ev["data_fine"],0,16)) : '',
              "tutto_il_giorno"=>$ev["tutto_il_giorno"],"progetto_id"=>$ev["progetto_id"],"cliente_id"=>$ev["cliente_id"],"tipo"=>$ev["tipo"],
            ), JSON_HEX_APOS|JSON_HEX_QUOT); ?>)'>Modifica</button>
            <form method="post" style="display:inline;" onsubmit="return confirm('Eliminare evento?')">
              <?php echo csrf_field(); ?><input type="hidden" name="id" value="<?php echo (int)$ev['id']; ?>">
              <button class="btn-link danger" name="azione" value="elimina">Elimina</button>
            </form>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  <?php endif; ?>
</div>

<div class="modal-bg" id="modalEvento">
  <div class="modal">
    <form method="post" action="calendario.php?anno=<?php echo $anno; ?>&mese=<?php echo $mese; ?>">
      <div class="modal-head"><h3 id="modalEvTitolo">Nuovo evento</h3><button type="button" class="chiudi" onclick="chiudiModal('modalEvento')">&times;</button></div>
      <div class="modal-body">
        <?php echo csrf_field(); ?>
        <input type="hidden" name="id" value="">
        <div class="form-row"><label>Titolo *</label><input type="text" name="titolo" required></div>
        <div class="form-grid">
          <div class="form-row"><label>Inizio *</label><input type="datetime-local" name="data_inizio" required></div>
          <div class="form-row"><label>Fine</label><input type="datetime-local" name="data_fine"></div>
        </div>
        <div class="form-grid">
          <div class="form-row"><label>Tipo</label>
            <select name="tipo"><?php foreach ($tipi as $k => $lbl): ?><option value="<?php echo $k; ?>"><?php echo $lbl; ?></option><?php endforeach; ?></select>
          </div>
          <div class="form-row checkbox-row" style="align-items:flex-end;"><label style="margin:0;"><input type="checkbox" name="tutto_il_giorno" value="1"> Tutto il giorno</label></div>
        </div>
        <div class="form-grid">
          <div class="form-row"><label>Progetto</label>
            <select name="progetto_id"><option value="">- nessuno -</option>
              <?php foreach ($progetti as $pg): ?><option value="<?php echo (int)$pg['id']; ?>"><?php echo e($pg['nome']); ?></option><?php endforeach; ?>
            </select>
          </div>
          <div class="form-row"><label>Cliente</label>
            <select name="cliente_id"><option value="">- nessuno -</option>
              <?php foreach ($clienti as $c): ?><option value="<?php echo (int)$c['id']; ?>"><?php echo e($c['nome']); ?></option><?php endforeach; ?>
            </select>
          </div>
        </div>
        <div class="form-row"><label>Descrizione</label><textarea name="descrizione"></textarea></div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" onclick="chiudiModal('modalEvento')">Annulla</button>
        <button type="submit" class="btn" name="azione" value="salva">Salva</button>
      </div>
    </form>
  </div>
</div>

<script>
function apriEvento() {
  apriModalModifica('modalEvento', {id:'', titolo:'', descrizione:'', data_inizio:'', data_fine:'', tutto_il_giorno:0, progetto_id:'', cliente_id:'', tipo:'sopralluogo'});
  document.getElementById('modalEvTitolo').textContent = 'Nuovo evento';
}
function modificaEvento(d) {
  apriModalModifica('modalEvento', d);
  document.getElementById('modalEvTitolo').textContent = 'Modifica evento';
}
</script>

<?php include __DIR__ . '/footer.php'; ?>
