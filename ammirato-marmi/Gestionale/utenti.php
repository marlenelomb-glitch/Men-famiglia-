<?php
/**
 * Ammirato Marmi - Gestionale
 * utenti.php - Gestione utenti staff (solo admin)
 */
require_once __DIR__ . '/config.php';
require_login();
if (!is_admin()) {
    http_response_code(403);
    $titolo_pagina = 'Accesso negato';
    include __DIR__ . '/header.php';
    echo '<div class="card"><h2>Accesso negato</h2><p class="muted">Solo l\'amministratore puo\' gestire gli utenti.</p></div>';
    include __DIR__ . '/footer.php';
    exit;
}

$permessi = permessi_disponibili();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $azione = post('azione');
    if ($azione === 'salva') {
        $id = post_int('id');
        $nome = post('nome');
        $email = post('email');
        $perm_sel = array();
        if (isset($_POST['permessi']) && is_array($_POST['permessi'])) {
            foreach ($_POST['permessi'] as $pk) {
                if (isset($permessi[$pk])) $perm_sel[] = $pk;
            }
        }
        $perm_json = json_encode($perm_sel);

        if ($nome === '' || $email === '') {
            flash('Nome ed email obbligatori.', 'err');
        } elseif ($id > 0) {
            // Non si puo' modificare l'admin
            $target = q_one('SELECT ruolo FROM users WHERE id = ?', array($id));
            if ($target && $target['ruolo'] === 'admin') {
                flash('L\'amministratore non puo\' essere modificato.', 'err');
            } else {
                if (isset($_POST['password']) && $_POST['password'] !== '') {
                    $hash = password_hash($_POST['password'], PASSWORD_BCRYPT);
                    q('UPDATE users SET nome=?, email=?, permessi=?, password=? WHERE id=? AND ruolo=?',
                      array($nome, $email, $perm_json, $hash, $id, 'staff'));
                } else {
                    q('UPDATE users SET nome=?, email=?, permessi=? WHERE id=? AND ruolo=?',
                      array($nome, $email, $perm_json, $id, 'staff'));
                }
                flash('Utente aggiornato.');
            }
        } else {
            $esiste = q_val('SELECT COUNT(*) FROM users WHERE email = ?', array($email));
            if ($esiste) {
                flash('Email gia\' registrata.', 'err');
            } elseif (empty($_POST['password'])) {
                flash('La password e\' obbligatoria per un nuovo utente.', 'err');
            } else {
                $hash = password_hash($_POST['password'], PASSWORD_BCRYPT);
                q('INSERT INTO users (nome, email, password, ruolo, permessi, attivo, approvato, created_at) VALUES (?,?,?,?,?,1,1,?)',
                  array($nome, $email, $hash, 'staff', $perm_json, adesso()));
                flash('Utente creato.');
            }
        }
    } elseif ($azione === 'toggle') {
        $id = post_int('id');
        $target = q_one('SELECT ruolo FROM users WHERE id = ?', array($id));
        if ($target && $target['ruolo'] === 'admin') {
            flash('L\'amministratore non puo\' essere disattivato.', 'err');
        } else {
            q('UPDATE users SET attivo = 1 - attivo WHERE id = ? AND ruolo = ?', array($id, 'staff'));
            flash('Stato utente aggiornato.');
        }
    } elseif ($azione === 'elimina') {
        $id = post_int('id');
        q("DELETE FROM users WHERE id = ? AND ruolo = 'staff'", array($id));
        flash('Utente eliminato.');
    }
    redirect('utenti.php');
}

$titolo_pagina = 'Gestione Utenti';
$pagina_attiva = 'utenti';

$utenti = q_all("SELECT * FROM users WHERE ruolo IN ('admin','staff') ORDER BY ruolo ASC, nome ASC");

include __DIR__ . '/header.php';
?>

<div class="card">
  <div class="card-header">
    <h2>Utenti</h2><div class="spacer"></div>
    <button class="btn btn-oro" onclick="apriUtente()">Nuovo utente staff</button>
  </div>
  <table class="tab">
    <thead><tr><th>Nome</th><th>Email</th><th>Ruolo</th><th>Permessi</th><th>Stato</th><th class="azioni">Azioni</th></tr></thead>
    <tbody>
    <?php foreach ($utenti as $u): ?>
      <?php
        $lista = json_decode($u['permessi'] ? $u['permessi'] : '[]', true);
        if (!is_array($lista)) $lista = array();
      ?>
      <tr>
        <td><?php echo e($u['nome']); ?></td>
        <td class="muted"><?php echo e($u['email']); ?></td>
        <td><span class="badge <?php echo $u['ruolo'] === 'admin' ? 'badge-oro' : 'badge-grigio'; ?>"><?php echo e($u['ruolo']); ?></span></td>
        <td>
          <?php if ($u['ruolo'] === 'admin'): ?>
            <span class="muted" style="font-size:13px;">tutti</span>
          <?php elseif (!$lista): ?>
            <span class="muted" style="font-size:13px;">nessuno</span>
          <?php else: ?>
            <?php foreach ($lista as $pk): ?><span class="pill-info" style="font-size:11px;"><?php echo e(isset($permessi[$pk]) ? $permessi[$pk] : $pk); ?></span><?php endforeach; ?>
          <?php endif; ?>
        </td>
        <td><span class="badge <?php echo $u['attivo'] ? 'badge-verde' : 'badge-grigio'; ?>"><?php echo $u['attivo'] ? 'attivo' : 'disattivo'; ?></span></td>
        <td class="azioni">
          <?php if ($u['ruolo'] === 'admin'): ?>
            <span class="muted" style="font-size:12px;">-</span>
          <?php else: ?>
            <button class="btn-link" onclick='modificaUtente(<?php echo json_encode(array("id"=>$u["id"],"nome"=>$u["nome"],"email"=>$u["email"],"permessi"=>$lista), JSON_HEX_APOS|JSON_HEX_QUOT); ?>)'>Modifica</button>
            <form method="post" style="display:inline;"><?php echo csrf_field(); ?><input type="hidden" name="id" value="<?php echo (int)$u['id']; ?>"><button class="btn-link" name="azione" value="toggle"><?php echo $u['attivo'] ? 'Disattiva' : 'Attiva'; ?></button></form>
            <form method="post" style="display:inline;" onsubmit="return confirm('Eliminare l\'utente?')"><?php echo csrf_field(); ?><input type="hidden" name="id" value="<?php echo (int)$u['id']; ?>"><button class="btn-link danger" name="azione" value="elimina">Elimina</button></form>
          <?php endif; ?>
        </td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table>
</div>

<div class="modal-bg" id="modalUtente">
  <div class="modal">
    <form method="post" action="utenti.php">
      <div class="modal-head"><h3 id="modalUtTitolo">Nuovo utente</h3><button type="button" class="chiudi" onclick="chiudiModal('modalUtente')">&times;</button></div>
      <div class="modal-body">
        <?php echo csrf_field(); ?>
        <input type="hidden" name="id" value="">
        <div class="form-row"><label>Nome *</label><input type="text" name="nome" required></div>
        <div class="form-row"><label>Email *</label><input type="email" name="email" required></div>
        <div class="form-row"><label>Password <span class="muted" id="pwHint">(obbligatoria)</span></label><input type="password" name="password" autocomplete="new-password"></div>
        <div class="form-row">
          <label>Permessi</label>
          <div class="checkbox-grid">
            <?php foreach ($permessi as $pk => $lbl): ?>
              <label><input type="checkbox" name="permessi[]" value="<?php echo e($pk); ?>"> <?php echo e($lbl); ?></label>
            <?php endforeach; ?>
          </div>
        </div>
      </div>
      <div class="modal-foot">
        <button type="button" class="btn btn-ghost" onclick="chiudiModal('modalUtente')">Annulla</button>
        <button type="submit" class="btn" name="azione" value="salva">Salva</button>
      </div>
    </form>
  </div>
</div>

<script>
function resetPermessi() {
  var cbs = document.querySelectorAll('#modalUtente input[name="permessi[]"]');
  var i; for (i = 0; i < cbs.length; i++) cbs[i].checked = false;
}
function apriUtente() {
  apriModalModifica('modalUtente', {id:'', nome:'', email:'', password:''});
  resetPermessi();
  document.getElementById('modalUtTitolo').textContent = 'Nuovo utente staff';
  document.getElementById('pwHint').textContent = '(obbligatoria)';
}
function modificaUtente(d) {
  apriModalModifica('modalUtente', {id:d.id, nome:d.nome, email:d.email, password:''});
  resetPermessi();
  var i;
  if (d.permessi && d.permessi.length) {
    for (i = 0; i < d.permessi.length; i++) {
      var cb = document.querySelector('#modalUtente input[value="' + d.permessi[i] + '"]');
      if (cb) cb.checked = true;
    }
  }
  document.getElementById('modalUtTitolo').textContent = 'Modifica utente';
  document.getElementById('pwHint').textContent = '(lascia vuoto per non cambiarla)';
}
</script>

<?php include __DIR__ . '/footer.php'; ?>
