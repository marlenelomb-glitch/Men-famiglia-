<?php
/**
 * Ammirato Marmi - Gestionale
 * inventario.php - Inventario materiali
 */
require_once __DIR__ . '/config.php';
require_permission('inventario');

$categorie = array('Marmo', 'Granito', 'Pietra', 'Altro');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $azione = post('azione');
    if ($azione === 'salva') {
        $id = post_int('id');
        $dati = array(
            post('nome'), post('descrizione'), post('categoria'), post_dec('spessore'),
            post_dec('quantita'), post_dec('quantita_minima'), post('unita'),
            post_dec('costo_unitario'), post_dec('prezzo_vendita'), post('note'),
        );
        if (post('nome') === '') {
            flash('Il nome e' . "'" . ' obbligatorio.', 'err');
        } elseif ($id > 0) {
            $params = $dati; $params[] = $id;
            q('UPDATE inventario SET nome=?, descrizione=?, categoria=?, spessore=?, quantita=?, quantita_minima=?, unita=?, costo_unitario=?, prezzo_vendita=?, note=? WHERE id=?', $params);
            flash('Materiale aggiornato.');
        } else {
            $params = $dati; $params[] = adesso();
            q('INSERT INTO inventario (nome, descrizione, categoria, spessore, quantita, quantita_minima, unita, costo_unitario, prezzo_vendita, note, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)', $params);
            flash('Materiale aggiunto.');
        }
    } elseif ($azione === 'elimina') {
        q('DELETE FROM inventario WHERE id = ?', array(post_int('id')));
        flash('Materiale eliminato.');
    }
    redirect('inventario.php' . ($_GET ? '?' . http_build_query($_GET) : ''));
}

$titolo_pagina = 'Inventario';
$pagina_attiva = 'inventario';

$cat = get('categoria', 'tutte');
$dove = ''; $par = array();
if (in_array($cat, $categorie, true)) { $dove = 'WHERE categoria = ?'; $par[] = $cat; }

$materiali = q_all("SELECT * FROM inventario $dove ORDER BY nome ASC", $par);
$scorte_basse = (int) q_val('SELECT COUNT(*) FROM inventario WHERE quantita <= quantita_minima AND quantita_minima > 0');

include __DIR__ . '/header.php';
?>

<?php if ($scorte_basse > 0): ?>
  <div class="flash flash-err"><?php echo $scorte_basse; ?> material<?php echo $scorte_basse === 1 ? 'e' : 'i'; ?> sotto la scorta minima.</div>
<?php endif; ?>

<div class="card">
  <div class="card-header">
    <h2>Inventario materiali</h2><div class="spacer"></div>
    <button class="btn btn-oro" onclick="apriMateriale()">Nuovo materiale</button>
  </div>

  <div class="filtri">
    <a class="chip <?php echo $cat === 'tutte' ? 'attivo' : ''; ?>" href="inventario.php?categoria=tutte">Tutte</a>
    <?php foreach ($categorie as $c): ?>
      <a class="chip <?php echo $cat === $c ? 'attivo' : ''; ?>" href="inventario.php?categoria=<?php echo urlencode($c); ?>"><?php echo e($c); ?></a>
    <?php endforeach; ?>
    <div class="spacer"></div>
    <input type="search" placeholder="Cerca materiale..." onkeyup="filtraTabella(this,'tabInv')" style="max-width:220px;">
  </div>

  <?php if (!$materiali): ?>
    <p class="muted">Nessun materiale.</p>
  <?php else: ?>
    <table class="tab" id="tabInv">
      <thead><tr><th>Materiale</th><th>Categoria</th><th>Spessore</th><th class="text-right">Quantita'</th><th class="text-right">Costo</th><th class="text-right">Vendita</th><th class="azioni">Azioni</th></tr></thead>
      <tbody>
      <?php foreach ($materiali as $m): ?>
        <?php $basso = $m['quantita_minima'] > 0 && $m['quantita'] <= $m['quantita_minima']; ?>
        <tr class="<?php echo $basso ? 'riga-rossa' : ''; ?>">
          <td><?php echo e($m['nome']); ?><?php if ($basso): ?> <span class="badge badge-rosso">scorta bassa</span><?php endif; ?></td>
          <td><span class="badge badge-grigio"><?php echo e($m['categoria']); ?></span></td>
          <td><?php echo $m['spessore'] > 0 ? e($m['spessore']) . ' cm' : '-'; ?></td>
          <td class="text-right"><?php echo number_format($m['quantita'], 2, ',', '.') . ' ' . e($m['unita']); ?></td>
          <td class="text-right"><?php echo euro($m['costo_unitario']); ?></td>
          <td class="text-right"><?php echo euro($m['prezzo_vendita']); ?></td>
          <td class="azioni">
            <button class="btn-link" onclick='modificaMateriale(<?php echo json_encode(array(
              "id"=>$m["id"],"nome"=>$m["nome"],"descrizione"=>$m["descrizione"],"categoria"=>$m["categoria"],"spessore"=>$m["spessore"],
              "quantita"=>$m["quantita"],"quantita_minima"=>$m["quantita_minima"],"unita"=>$m["unita"],
              "costo_unitario"=>$m["costo_unitario"],"prezzo_vendita"=>$m["prezzo_vendita"],"note"=>$m["note"],
            ), JSON_HEX_APOS|JSON_HEX_QUOT); ?>)'>Modifica</button>
            <form method="post" style="display:inline;" onsubmit="return confirm('Eliminare il materiale?')">
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

<div class="modal-bg" id="modalMateriale">
  <div class="modal">
    <form method="post" action="inventario.php<?php echo $_GET ? '?' . http_build_query($_GET) : ''; ?>">
      <div class="modal-head"><h3 id="modalMatTitolo">Nuovo materiale</h3><button type="button" class="chiudi" onclick="chiudiModal('modalMateriale')">&times;</button></div>
      <div class="modal-body">
        <?php echo csrf_field(); ?>
        <input type="hidden" name="id" value="">
        <div class="form-row"><label>Nome *</label><input type="text" name="nome" required></div>
        <div class="form-grid">
          <div class="form-row"><label>Categoria</label>
            <select name="categoria"><?php foreach ($categorie as $c): ?><option value="<?php echo e($c); ?>"><?php echo e($c); ?></option><?php endforeach; ?></select>
          </div>
          <div class="form-row"><label>Spessore (cm)</label><input type="number" step="0.1" name="spessore" value="0"></div>
        </div>
        <div class="form-grid-3">
          <div class="form-row"><label>Quantita'</label><input type="number" step="0.01" name="quantita" value="0"></div>
          <div class="form-row"><label>Q.ta' minima</label><input type="number" step="0.01" name="quantita_minima" value="0"></div>
          <div class="form-row"><label>Unita'</label>
            <select name="unita"><option value="mq">mq</option><option value="ml">ml</option><option value="pz">pz</option></select>
          </div>
        </div>
        <div class="form-grid">
          <div class="form-row"><label>Costo acquisto &euro;</label><input type="number" step="0.01" name="costo_unitario" value="0"></div>
          <div class="form-row"><label>Prezzo vendita &euro;</label><input type="number" step="0.01" name="prezzo_vendita" value="0"></div>
        </div>
        <div class="form-row"><label>Note</label><textarea name="note"></textarea></div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" onclick="chiudiModal('modalMateriale')">Annulla</button>
        <button type="submit" class="btn" name="azione" value="salva">Salva</button>
      </div>
    </form>
  </div>
</div>

<script>
function apriMateriale() {
  apriModalModifica('modalMateriale', {id:'', nome:'', descrizione:'', categoria:'Marmo', spessore:'0', quantita:'0', quantita_minima:'0', unita:'mq', costo_unitario:'0', prezzo_vendita:'0', note:''});
  document.getElementById('modalMatTitolo').textContent = 'Nuovo materiale';
}
function modificaMateriale(d) {
  apriModalModifica('modalMateriale', d);
  document.getElementById('modalMatTitolo').textContent = 'Modifica materiale';
}
</script>

<?php include __DIR__ . '/footer.php'; ?>
