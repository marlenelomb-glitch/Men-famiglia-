<?php
/**
 * Ammirato Marmi - Gestionale
 * progetti.php - Elenco e gestione progetti
 */
require_once __DIR__ . '/config.php';
require_permission('progetti');

$stati = array('pianificato' => 'Pianificato', 'in_corso' => 'In corso', 'in_attesa' => 'In attesa', 'completato' => 'Completato', 'annullato' => 'Annullato');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $azione = post('azione');
    if ($azione === 'salva') {
        $id = post_int('id');
        // Gestione foto misure (append al TEXT esistente, lista separata da virgola)
        $foto_esistenti = post('foto_misure_esistenti');
        $nuova = upload_immagine('foto_misure');
        $lista = array_filter(array_map('trim', explode(',', $foto_esistenti)));
        if ($nuova) $lista[] = $nuova;
        $foto = implode(',', $lista);

        $cliente_id = post_int('cliente_id');
        $cliente_id = $cliente_id > 0 ? $cliente_id : null;
        if (post('nome') === '') {
            flash('Il nome progetto e' . "'" . ' obbligatorio.', 'err');
        } elseif ($id > 0) {
            q('UPDATE progetti SET cliente_id=?, nome=?, descrizione=?, stato=?, data_inizio=?, data_consegna=?, note=?, foto_misure=? WHERE id=?',
              array($cliente_id, post('nome'), post('descrizione'), post('stato'),
                    post('data_inizio') ?: null, post('data_consegna') ?: null, post('note'), $foto, $id));
            flash('Progetto aggiornato.');
        } else {
            q('INSERT INTO progetti (cliente_id, nome, descrizione, stato, data_inizio, data_consegna, note, foto_misure, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
              array($cliente_id, post('nome'), post('descrizione'), post('stato'),
                    post('data_inizio') ?: null, post('data_consegna') ?: null, post('note'), $foto, adesso()));
            flash('Progetto creato.');
        }
    } elseif ($azione === 'cambia_stato') {
        $st = post('stato');
        if (isset($stati[$st])) {
            q('UPDATE progetti SET stato = ? WHERE id = ?', array($st, post_int('id')));
            flash('Stato aggiornato.');
        }
    } elseif ($azione === 'elimina') {
        q('DELETE FROM progetti WHERE id = ?', array(post_int('id')));
        flash('Progetto eliminato.');
    }
    redirect('progetti.php' . ($_GET ? '?' . http_build_query($_GET) : ''));
}

$titolo_pagina = 'Progetti';
$pagina_attiva = 'progetti';

$filtro = get('stato', 'tutti');
$dove = ''; $par = array();
if (isset($stati[$filtro])) { $dove = 'WHERE p.stato = ?'; $par[] = $filtro; }

$progetti = q_all(
    "SELECT p.*, c.nome AS cliente_nome FROM progetti p
     LEFT JOIN clienti c ON c.id = p.cliente_id
     $dove ORDER BY p.created_at DESC", $par);
$clienti = q_all('SELECT id, nome FROM clienti ORDER BY nome');

include __DIR__ . '/header.php';
?>

<div class="card">
  <div class="card-header">
    <h2>Progetti</h2><div class="spacer"></div>
    <button class="btn btn-oro" onclick="apriProgetto()">Nuovo progetto</button>
  </div>

  <div class="filtri">
    <a class="chip <?php echo $filtro === 'tutti' ? 'attivo' : ''; ?>" href="progetti.php?stato=tutti">Tutti</a>
    <?php foreach ($stati as $k => $lbl): ?>
      <a class="chip <?php echo $filtro === $k ? 'attivo' : ''; ?>" href="progetti.php?stato=<?php echo $k; ?>"><?php echo $lbl; ?></a>
    <?php endforeach; ?>
  </div>

  <?php if (!$progetti): ?>
    <p class="muted">Nessun progetto.</p>
  <?php else: ?>
    <table class="tab">
      <thead><tr><th>Progetto</th><th>Cliente</th><th>Stato</th><th>Consegna</th><th class="azioni">Azioni</th></tr></thead>
      <tbody>
      <?php foreach ($progetti as $p): ?>
        <tr>
          <td><a href="progetto.php?id=<?php echo (int)$p['id']; ?>"><?php echo e($p['nome']); ?></a></td>
          <td class="muted"><?php echo e($p['cliente_nome'] ? $p['cliente_nome'] : '-'); ?></td>
          <td>
            <select class="stato-inline" data-id="<?php echo (int)$p['id']; ?>" onchange="cambiaStato(this,'progetti.php','stato')">
              <?php foreach ($stati as $k => $lbl): ?>
                <option value="<?php echo $k; ?>" <?php echo $p['stato'] === $k ? 'selected' : ''; ?>><?php echo $lbl; ?></option>
              <?php endforeach; ?>
            </select>
          </td>
          <td class="nowrap"><?php echo data_it($p['data_consegna']); ?></td>
          <td class="azioni">
            <button class="btn-link" onclick='modificaProgetto(<?php echo json_encode(array(
              "id"=>$p["id"],"cliente_id"=>$p["cliente_id"],"nome"=>$p["nome"],"descrizione"=>$p["descrizione"],
              "stato"=>$p["stato"],"data_inizio"=>$p["data_inizio"],"data_consegna"=>$p["data_consegna"],
              "note"=>$p["note"],"foto_misure"=>$p["foto_misure"],
            ), JSON_HEX_APOS|JSON_HEX_QUOT); ?>)'>Modifica</button>
            <form method="post" style="display:inline;" onsubmit="return confirm('Eliminare il progetto?')">
              <?php echo csrf_field(); ?><input type="hidden" name="id" value="<?php echo (int)$p['id']; ?>">
              <button class="btn-link danger" name="azione" value="elimina">Elimina</button>
            </form>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  <?php endif; ?>
</div>

<div class="modal-bg" id="modalProgetto">
  <div class="modal">
    <form method="post" enctype="multipart/form-data" action="progetti.php<?php echo $_GET ? '?' . http_build_query($_GET) : ''; ?>">
      <div class="modal-head"><h3 id="modalProgettoTitolo">Nuovo progetto</h3><button type="button" class="chiudi" onclick="chiudiModal('modalProgetto')">&times;</button></div>
      <div class="modal-body">
        <?php echo csrf_field(); ?>
        <input type="hidden" name="id" value="">
        <input type="hidden" name="foto_misure_esistenti" value="">
        <div class="form-row"><label>Nome progetto *</label><input type="text" name="nome" required></div>
        <div class="form-grid">
          <div class="form-row"><label>Cliente</label>
            <select name="cliente_id"><option value="">- nessuno -</option>
              <?php foreach ($clienti as $c): ?><option value="<?php echo (int)$c['id']; ?>"><?php echo e($c['nome']); ?></option><?php endforeach; ?>
            </select>
          </div>
          <div class="form-row"><label>Stato</label>
            <select name="stato"><?php foreach ($stati as $k => $lbl): ?><option value="<?php echo $k; ?>"><?php echo $lbl; ?></option><?php endforeach; ?></select>
          </div>
        </div>
        <div class="form-grid">
          <div class="form-row"><label>Data inizio</label><input type="date" name="data_inizio"></div>
          <div class="form-row"><label>Data consegna</label><input type="date" name="data_consegna"></div>
        </div>
        <div class="form-row"><label>Descrizione</label><textarea name="descrizione"></textarea></div>
        <div class="form-row"><label>Foto con misure (aggiungi)</label><input type="file" name="foto_misure" accept="image/*"></div>
        <div class="form-row"><label>Note</label><textarea name="note"></textarea></div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" onclick="chiudiModal('modalProgetto')">Annulla</button>
        <button type="submit" class="btn" name="azione" value="salva">Salva</button>
      </div>
    </form>
  </div>
</div>

<script>
function apriProgetto() {
  apriModalModifica('modalProgetto', {id:'', cliente_id:'', nome:'', descrizione:'', stato:'pianificato', data_inizio:'', data_consegna:'', note:'', foto_misure:''});
  document.getElementById('modalProgettoTitolo').textContent = 'Nuovo progetto';
}
function modificaProgetto(d) {
  apriModalModifica('modalProgetto', d);
  document.getElementById('modalProgettoTitolo').textContent = 'Modifica progetto';
}
</script>

<?php include __DIR__ . '/footer.php'; ?>
