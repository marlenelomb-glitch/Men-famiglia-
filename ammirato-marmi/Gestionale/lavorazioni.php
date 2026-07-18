<?php
/**
 * Ammirato Marmi - Gestionale
 * lavorazioni.php - Elenco e gestione lavorazioni
 */
require_once __DIR__ . '/config.php';
require_permission('lavorazioni');

$stati = array('da_iniziare' => 'Da iniziare', 'in_corso' => 'In corso', 'completata' => 'Completata', 'annullata' => 'Annullata');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $azione = post('azione');
    if ($azione === 'salva') {
        $id = post_int('id');
        $progetto_id = post_int('progetto_id') ?: null;
        $operaio = post_int('assegnato_a') ?: null;
        if (post('titolo') === '') {
            flash('Il titolo e' . "'" . ' obbligatorio.', 'err');
        } elseif ($id > 0) {
            q('UPDATE lavorazioni SET progetto_id=?, titolo=?, descrizione=?, stato=?, assegnato_a=?, data_inizio=?, data_scadenza=?, note=? WHERE id=?',
              array($progetto_id, post('titolo'), post('descrizione'), post('stato'), $operaio,
                    post('data_inizio') ?: null, post('data_scadenza') ?: null, post('note'), $id));
            flash('Lavorazione aggiornata.');
        } else {
            q('INSERT INTO lavorazioni (progetto_id, titolo, descrizione, stato, assegnato_a, data_inizio, data_scadenza, note, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
              array($progetto_id, post('titolo'), post('descrizione'), post('stato'), $operaio,
                    post('data_inizio') ?: null, post('data_scadenza') ?: null, post('note'), adesso()));
            flash('Lavorazione creata.');
        }
    } elseif ($azione === 'cambia_stato') {
        $st = post('stato');
        if (isset($stati[$st])) {
            q('UPDATE lavorazioni SET stato = ? WHERE id = ?', array($st, post_int('id')));
            flash('Stato lavorazione aggiornato.');
        }
    } elseif ($azione === 'elimina') {
        q('DELETE FROM lavorazioni WHERE id = ?', array(post_int('id')));
        flash('Lavorazione eliminata.');
    }
    redirect('lavorazioni.php' . ($_GET ? '?' . http_build_query($_GET) : ''));
}

$titolo_pagina = 'Lavorazioni';
$pagina_attiva = 'lavorazioni';

$filtro = get('vista', 'attive');
$dove = ''; $par = array();
if ($filtro === 'attive') { $dove = "WHERE l.stato IN ('da_iniziare','in_corso')"; }
elseif ($filtro === 'completate') { $dove = "WHERE l.stato = 'completata'"; }

$lavorazioni = q_all(
    "SELECT l.*, p.nome AS progetto_nome, r.nome AS operaio FROM lavorazioni l
     LEFT JOIN progetti p ON p.id = l.progetto_id
     LEFT JOIN risorse r ON r.id = l.assegnato_a
     $dove ORDER BY l.data_scadenza IS NULL, l.data_scadenza ASC", $par);

$progetti = q_all('SELECT id, nome FROM progetti ORDER BY nome');
$operai = q_all("SELECT id, nome FROM risorse WHERE tipo = 'operaio' AND attivo = 1 ORDER BY nome");

include __DIR__ . '/header.php';
?>

<div class="card">
  <div class="card-header">
    <h2>Lavorazioni</h2><div class="spacer"></div>
    <button class="btn btn-oro" onclick="apriLavorazione()">Nuova lavorazione</button>
  </div>

  <div class="filtri">
    <a class="chip <?php echo $filtro === 'attive' ? 'attivo' : ''; ?>" href="lavorazioni.php?vista=attive">Attive</a>
    <a class="chip <?php echo $filtro === 'tutte' ? 'attivo' : ''; ?>" href="lavorazioni.php?vista=tutte">Tutte</a>
    <a class="chip <?php echo $filtro === 'completate' ? 'attivo' : ''; ?>" href="lavorazioni.php?vista=completate">Completate</a>
  </div>

  <?php if (!$lavorazioni): ?>
    <p class="muted">Nessuna lavorazione.</p>
  <?php else: ?>
    <table class="tab">
      <thead><tr><th>Titolo</th><th>Progetto</th><th>Operaio</th><th>Scadenza</th><th>Stato</th><th class="azioni">Azioni</th></tr></thead>
      <tbody>
      <?php foreach ($lavorazioni as $l): ?>
        <?php $scaduta = $l['stato'] !== 'completata' && $l['stato'] !== 'annullata' && $l['data_scadenza'] && $l['data_scadenza'] < oggi(); ?>
        <tr class="<?php echo $scaduta ? 'riga-rossa' : ''; ?>">
          <td><?php echo e($l['titolo']); ?></td>
          <td class="muted"><?php echo e($l['progetto_nome'] ? $l['progetto_nome'] : '-'); ?></td>
          <td><?php echo e($l['operaio'] ? $l['operaio'] : '-'); ?></td>
          <td class="nowrap"><?php echo data_it($l['data_scadenza']); ?></td>
          <td>
            <select class="stato-inline" data-id="<?php echo (int)$l['id']; ?>" onchange="cambiaStato(this,'lavorazioni.php','stato')">
              <?php foreach ($stati as $k => $lbl): ?><option value="<?php echo $k; ?>" <?php echo $l['stato'] === $k ? 'selected' : ''; ?>><?php echo $lbl; ?></option><?php endforeach; ?>
            </select>
          </td>
          <td class="azioni">
            <button class="btn-link" onclick='modificaLavorazione(<?php echo json_encode(array(
              "id"=>$l["id"],"progetto_id"=>$l["progetto_id"],"titolo"=>$l["titolo"],"descrizione"=>$l["descrizione"],
              "stato"=>$l["stato"],"assegnato_a"=>$l["assegnato_a"],"data_inizio"=>$l["data_inizio"],"data_scadenza"=>$l["data_scadenza"],"note"=>$l["note"],
            ), JSON_HEX_APOS|JSON_HEX_QUOT); ?>)'>Modifica</button>
            <form method="post" style="display:inline;" onsubmit="return confirm('Eliminare la lavorazione?')">
              <?php echo csrf_field(); ?><input type="hidden" name="id" value="<?php echo (int)$l['id']; ?>">
              <button class="btn-link danger" name="azione" value="elimina">Elimina</button>
            </form>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  <?php endif; ?>
</div>

<div class="modal-bg" id="modalLavorazione">
  <div class="modal">
    <form method="post" action="lavorazioni.php<?php echo $_GET ? '?' . http_build_query($_GET) : ''; ?>">
      <div class="modal-head"><h3 id="modalLavTitolo">Nuova lavorazione</h3><button type="button" class="chiudi" onclick="chiudiModal('modalLavorazione')">&times;</button></div>
      <div class="modal-body">
        <?php echo csrf_field(); ?>
        <input type="hidden" name="id" value="">
        <div class="form-row"><label>Titolo *</label><input type="text" name="titolo" required></div>
        <div class="form-grid">
          <div class="form-row"><label>Progetto</label>
            <select name="progetto_id"><option value="">- nessuno -</option>
              <?php foreach ($progetti as $pg): ?><option value="<?php echo (int)$pg['id']; ?>"><?php echo e($pg['nome']); ?></option><?php endforeach; ?>
            </select>
          </div>
          <div class="form-row"><label>Assegnato a</label>
            <select name="assegnato_a"><option value="">- nessuno -</option>
              <?php foreach ($operai as $o): ?><option value="<?php echo (int)$o['id']; ?>"><?php echo e($o['nome']); ?></option><?php endforeach; ?>
            </select>
          </div>
        </div>
        <div class="form-grid">
          <div class="form-row"><label>Stato</label>
            <select name="stato"><?php foreach ($stati as $k => $lbl): ?><option value="<?php echo $k; ?>"><?php echo $lbl; ?></option><?php endforeach; ?></select>
          </div>
          <div class="form-row"><label>Scadenza</label><input type="date" name="data_scadenza"></div>
        </div>
        <div class="form-row"><label>Data inizio</label><input type="date" name="data_inizio"></div>
        <div class="form-row"><label>Descrizione</label><textarea name="descrizione"></textarea></div>
        <div class="form-row"><label>Note</label><textarea name="note"></textarea></div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" onclick="chiudiModal('modalLavorazione')">Annulla</button>
        <button type="submit" class="btn" name="azione" value="salva">Salva</button>
      </div>
    </form>
  </div>
</div>

<script>
function apriLavorazione() {
  apriModalModifica('modalLavorazione', {id:'', progetto_id:'', titolo:'', descrizione:'', stato:'da_iniziare', assegnato_a:'', data_inizio:'', data_scadenza:'', note:''});
  document.getElementById('modalLavTitolo').textContent = 'Nuova lavorazione';
}
function modificaLavorazione(d) {
  apriModalModifica('modalLavorazione', d);
  document.getElementById('modalLavTitolo').textContent = 'Modifica lavorazione';
}
</script>

<?php include __DIR__ . '/footer.php'; ?>
