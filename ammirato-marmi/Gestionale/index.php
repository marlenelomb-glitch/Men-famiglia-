<?php
/**
 * Ammirato Marmi - Gestionale
 * index.php - Dashboard
 */
require_once __DIR__ . '/config.php';
require_login();

// Gestione approva/rifiuta partner dalla dashboard
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    if (is_admin() || has_permission('partner')) {
        $azione = post('azione');
        $pid = post_int('partner_id');
        if ($pid > 0 && $azione === 'approva_partner') {
            q('UPDATE users SET approvato = 1 WHERE id = ? AND ruolo = ?', array($pid, 'partner'));
            crea_notifica('partner', 'Partner approvato', 'Un partner e' . "'" . ' stato approvato.', $pid, 'partner');
            flash('Partner approvato.');
        } elseif ($pid > 0 && $azione === 'rifiuta_partner') {
            q('UPDATE users SET approvato = 0, attivo = 0 WHERE id = ? AND ruolo = ?', array($pid, 'partner'));
            flash('Partner rifiutato.');
        }
    }
    redirect('index.php');
}

$titolo_pagina = 'Dashboard';
$pagina_attiva = 'dashboard';

// Statistiche
$n_clienti = (int) q_val('SELECT COUNT(*) FROM clienti');
$n_progetti = (int) q_val("SELECT COUNT(*) FROM progetti WHERE stato IN ('pianificato','in_corso','in_attesa')");
$n_preventivi = (int) q_val("SELECT COUNT(*) FROM preventivi WHERE stato = 'inviato'");
$n_fatture_aperte = (int) q_val("SELECT COUNT(*) FROM fatture WHERE stato IN ('emessa','scaduta')");

// Lavorazioni in corso con operaio
$lav = q_all(
    "SELECT l.*, p.nome AS progetto_nome, r.nome AS operaio
     FROM lavorazioni l
     LEFT JOIN progetti p ON p.id = l.progetto_id
     LEFT JOIN risorse r ON r.id = l.assegnato_a
     WHERE l.stato IN ('da_iniziare','in_corso')
     ORDER BY l.data_scadenza IS NULL, l.data_scadenza ASC LIMIT 8"
);

// Partner in attesa
$partner_attesa = array();
if (is_admin() || has_permission('partner')) {
    $partner_attesa = q_all("SELECT * FROM users WHERE ruolo = 'partner' AND approvato = 0 AND attivo = 1 ORDER BY id DESC");
}

include __DIR__ . '/header.php';
?>

<div class="stat-grid">
  <div class="stat"><div class="num"><?php echo $n_clienti; ?></div><div class="lbl">Clienti</div></div>
  <div class="stat"><div class="num"><?php echo $n_progetti; ?></div><div class="lbl">Progetti attivi</div></div>
  <div class="stat"><div class="num"><?php echo $n_preventivi; ?></div><div class="lbl">Preventivi inviati</div></div>
  <div class="stat"><div class="num"><?php echo $n_fatture_aperte; ?></div><div class="lbl">Fatture aperte</div></div>
</div>

<div class="griglia-2">
  <div class="card">
    <div class="card-header"><h2>Lavorazioni in corso</h2></div>
    <?php if (!$lav): ?>
      <p class="muted">Nessuna lavorazione in corso.</p>
    <?php else: ?>
      <table class="tab">
        <thead><tr><th>Titolo</th><th>Progetto</th><th>Operaio</th><th>Scadenza</th></tr></thead>
        <tbody>
        <?php foreach ($lav as $l): ?>
          <?php $scaduta = $l['data_scadenza'] && $l['data_scadenza'] < oggi(); ?>
          <tr class="<?php echo $scaduta ? 'riga-rossa' : ''; ?>">
            <td><?php echo e($l['titolo']); ?></td>
            <td class="muted"><?php echo e($l['progetto_nome'] ? $l['progetto_nome'] : '-'); ?></td>
            <td><?php echo e($l['operaio'] ? $l['operaio'] : '-'); ?></td>
            <td class="nowrap"><?php echo data_it($l['data_scadenza']); ?></td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    <?php endif; ?>
  </div>

  <div class="card">
    <div class="card-header"><h2>Partner in attesa</h2></div>
    <?php if (!(is_admin() || has_permission('partner'))): ?>
      <p class="muted">Non hai i permessi per la gestione partner.</p>
    <?php elseif (!$partner_attesa): ?>
      <p class="muted">Nessun partner in attesa di approvazione.</p>
    <?php else: ?>
      <table class="tab">
        <thead><tr><th>Nome</th><th>Ragione sociale</th><th class="azioni">Azioni</th></tr></thead>
        <tbody>
        <?php foreach ($partner_attesa as $p): ?>
          <tr>
            <td><?php echo e($p['nome']); ?><div class="muted" style="font-size:12px;"><?php echo e($p['email']); ?></div></td>
            <td><?php echo e($p['ragione_sociale'] ? $p['ragione_sociale'] : '-'); ?></td>
            <td class="azioni">
              <form method="post" style="display:inline;">
                <?php echo csrf_field(); ?>
                <input type="hidden" name="partner_id" value="<?php echo (int)$p['id']; ?>">
                <button class="btn btn-sm btn-oro" name="azione" value="approva_partner">Approva</button>
                <button class="btn btn-sm btn-ghost" name="azione" value="rifiuta_partner" onclick="return confirm('Rifiutare questo partner?')">Rifiuta</button>
              </form>
            </td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    <?php endif; ?>
  </div>
</div>

<?php include __DIR__ . '/footer.php'; ?>
