<?php
/**
 * Ammirato Marmi - Gestionale
 * clienti.php - Anagrafica clienti
 */
require_once __DIR__ . '/config.php';
require_permission('clienti');

// ------- Azioni -------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $azione = post('azione');
    if ($azione === 'salva') {
        $id = post_int('id');
        $dati = array(
            post('nome'), post('email'), post('telefono'), post('indirizzo'),
            post('citta'), post('piva'), post('note'), post('tipo'),
        );
        if (post('nome') === '') {
            flash('Il nome e' . "'" . ' obbligatorio.', 'err');
        } elseif ($id > 0) {
            $params = $dati; $params[] = $id;
            q('UPDATE clienti SET nome=?, email=?, telefono=?, indirizzo=?, citta=?, piva=?, note=?, tipo=? WHERE id=?', $params);
            flash('Cliente aggiornato.');
        } else {
            $params = $dati; $params[] = adesso();
            q('INSERT INTO clienti (nome, email, telefono, indirizzo, citta, piva, note, tipo, created_at) VALUES (?,?,?,?,?,?,?,?,?)', $params);
            flash('Cliente aggiunto.');
        }
    } elseif ($azione === 'elimina') {
        q('DELETE FROM clienti WHERE id = ?', array(post_int('id')));
        flash('Cliente eliminato.');
    }
    redirect('clienti.php' . ($_GET ? '?' . http_build_query($_GET) : ''));
}

$titolo_pagina = 'Clienti';
$pagina_attiva = 'clienti';

$filtro = get('tipo', 'tutti');
$dove = '';
$par = array();
if ($filtro === 'privato' || $filtro === 'azienda' || $filtro === 'partner') {
    $dove = 'WHERE tipo = ?';
    $par[] = $filtro;
}
$clienti = q_all("SELECT * FROM clienti $dove ORDER BY nome ASC", $par);

include __DIR__ . '/header.php';
?>

<div class="card">
  <div class="card-header">
    <h2>Clienti</h2>
    <div class="spacer"></div>
    <button class="btn btn-oro" onclick="apriModalNuovo()">Nuovo cliente</button>
  </div>

  <div class="filtri">
    <?php
    $tipi = array('tutti' => 'Tutti', 'privato' => 'Privati', 'azienda' => 'Aziende', 'partner' => 'Partner');
    foreach ($tipi as $k => $lbl):
    ?>
      <a class="chip <?php echo $filtro === $k ? 'attivo' : ''; ?>" href="clienti.php?tipo=<?php echo $k; ?>"><?php echo $lbl; ?></a>
    <?php endforeach; ?>
    <div class="spacer"></div>
    <input type="search" placeholder="Cerca..." onkeyup="filtraTabella(this,'tabClienti')" style="max-width:220px;">
  </div>

  <?php if (!$clienti): ?>
    <p class="muted">Nessun cliente in questa categoria.</p>
  <?php else: ?>
    <table class="tab" id="tabClienti">
      <thead><tr><th>Nome</th><th>Tipo</th><th>Telefono</th><th>Email</th><th>Citta'</th><th class="azioni">Azioni</th></tr></thead>
      <tbody>
      <?php foreach ($clienti as $c): ?>
        <tr>
          <td>
            <a href="cliente.php?id=<?php echo (int)$c['id']; ?>"><?php echo e($c['nome']); ?></a>
            <?php if ($c['piva']): ?><div class="muted" style="font-size:12px;">P.IVA <?php echo e($c['piva']); ?></div><?php endif; ?>
          </td>
          <td><span class="badge <?php echo $c['tipo'] === 'partner' ? 'badge-oro' : ($c['tipo'] === 'azienda' ? 'badge-blu' : 'badge-grigio'); ?>"><?php echo e($c['tipo']); ?></span></td>
          <td><?php echo e($c['telefono']); ?></td>
          <td><?php echo e($c['email']); ?></td>
          <td><?php echo e($c['citta']); ?></td>
          <td class="azioni">
            <button class="btn-link" onclick='modificaCliente(<?php echo json_encode(array(
                "id" => $c["id"], "nome" => $c["nome"], "email" => $c["email"], "telefono" => $c["telefono"],
                "indirizzo" => $c["indirizzo"], "citta" => $c["citta"], "piva" => $c["piva"], "note" => $c["note"], "tipo" => $c["tipo"],
            ), JSON_HEX_APOS | JSON_HEX_QUOT); ?>)'>Modifica</button>
            <form method="post" style="display:inline;" onsubmit="return confirm('Eliminare questo cliente?')">
              <?php echo csrf_field(); ?>
              <input type="hidden" name="id" value="<?php echo (int)$c['id']; ?>">
              <button class="btn-link danger" name="azione" value="elimina">Elimina</button>
            </form>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  <?php endif; ?>
</div>

<!-- Modal cliente -->
<div class="modal-bg" id="modalCliente">
  <div class="modal">
    <form method="post" action="clienti.php<?php echo $_GET ? '?' . http_build_query($_GET) : ''; ?>">
      <div class="modal-head"><h3 id="modalClienteTitolo">Nuovo cliente</h3><button type="button" class="chiudi" onclick="chiudiModal('modalCliente')">&times;</button></div>
      <div class="modal-body">
        <?php echo csrf_field(); ?>
        <input type="hidden" name="id" value="">
        <div class="form-row"><label>Nome *</label><input type="text" name="nome" required></div>
        <div class="form-grid">
          <div class="form-row"><label>Tipo</label>
            <select name="tipo">
              <option value="privato">Privato</option>
              <option value="azienda">Azienda</option>
              <option value="partner">Partner</option>
            </select>
          </div>
          <div class="form-row"><label>Telefono</label><input type="tel" name="telefono"></div>
        </div>
        <div class="form-grid">
          <div class="form-row"><label>Email</label><input type="email" name="email"></div>
          <div class="form-row"><label>P.IVA</label><input type="text" name="piva"></div>
        </div>
        <div class="form-row"><label>Indirizzo</label><input type="text" name="indirizzo"></div>
        <div class="form-row"><label>Citta'</label><input type="text" name="citta"></div>
        <div class="form-row"><label>Note</label><textarea name="note"></textarea></div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" onclick="chiudiModal('modalCliente')">Annulla</button>
        <button type="submit" class="btn" name="azione" value="salva">Salva</button>
      </div>
    </form>
  </div>
</div>

<script>
function apriModalNuovo() {
  apriModalModifica('modalCliente', {id:'', nome:'', email:'', telefono:'', indirizzo:'', citta:'', piva:'', note:'', tipo:'privato'});
  document.getElementById('modalClienteTitolo').textContent = 'Nuovo cliente';
}
function modificaCliente(dati) {
  apriModalModifica('modalCliente', dati);
  document.getElementById('modalClienteTitolo').textContent = 'Modifica cliente';
}
</script>

<?php include __DIR__ . '/footer.php'; ?>
