<?php
/**
 * Ammirato Marmi - Gestionale
 * richieste_partner.php - Richieste di preventivo inviate dai partner
 * L'admin puo' creare un preventivo collegato al partner a partire dalla richiesta.
 */
require_once __DIR__ . '/config.php';
require_permission('partner');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $azione = post('azione');
    $rid = post_int('richiesta_id');
    $r = q_one('SELECT * FROM partner_richieste WHERE id = ?', array($rid));
    if ($r && $azione === 'crea_preventivo') {
        $mano = post_dec('costo_manodopera');
        $mat = post_dec('costo_materiali');
        $trasp = post_dec('costo_trasporto');
        $sconto = post_dec('sconto_percent');
        $subtot = $mano + $mat + $trasp;
        $importo = $subtot - ($subtot * $sconto / 100);
        $numero = prossimo_numero('preventivi', 'PRE');
        // Il preventivo creato per un partner nasce gia' in stato "inviato"
        q('INSERT INTO preventivi (numero, cliente_id, progetto_id, data_emissione, data_validita, importo, stato, descrizione, note, costo_manodopera, costo_materiali, costo_trasporto, sconto_percent, partner_id, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          array($numero, null, null, oggi(), post('data_validita') ?: null, $importo, 'inviato',
                post('descrizione'), post('note'), $mano, $mat, $trasp, $sconto, $r['partner_id'], adesso()));
        $prev_id = last_id();
        q("UPDATE partner_richieste SET stato = 'preventivata', preventivo_id = ?, note_admin = ? WHERE id = ?",
          array($prev_id, post('note_admin'), $rid));
        flash('Preventivo ' . $numero . ' creato e inviato al partner.');
    } elseif ($r && $azione === 'segna_lavorata') {
        q("UPDATE partner_richieste SET stato = 'gestita', note_admin = ? WHERE id = ?", array(post('note_admin'), $rid));
        flash('Richiesta segnata come gestita.');
    }
    redirect('richieste_partner.php');
}

$titolo_pagina = 'Richieste partner';
$pagina_attiva = 'partner';

$richieste = q_all("SELECT pr.*, u.nome AS partner_nome, u.ragione_sociale
                    FROM partner_richieste pr
                    LEFT JOIN users u ON u.id = pr.partner_id
                    ORDER BY pr.stato = 'nuova' DESC, pr.created_at DESC");

include __DIR__ . '/header.php';
?>

<p><a href="partner.php">&larr; Torna ai partner</a></p>

<div class="card">
  <div class="card-header"><h2>Richieste di preventivo</h2></div>
  <?php if (!$richieste): ?>
    <p class="muted">Nessuna richiesta ricevuta.</p>
  <?php else: ?>
    <?php foreach ($richieste as $r): ?>
      <?php $foto = array_filter(array_map('trim', explode(',', $r['foto']))); ?>
      <div style="border:1px solid var(--pietra-chiara);border-radius:8px;padding:18px;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <strong><?php echo e($r['partner_nome'] ? $r['partner_nome'] : 'Partner #' . $r['partner_id']); ?></strong>
          <span class="muted" style="font-size:13px;"><?php echo e($r['ragione_sociale']); ?></span>
          <div style="flex:1;"></div>
          <span class="badge <?php echo $r['stato'] === 'nuova' ? 'badge-oro' : 'badge-grigio'; ?>"><?php echo e($r['stato']); ?></span>
          <span class="muted" style="font-size:12px;"><?php echo data_it($r['created_at']); ?></span>
        </div>
        <?php if ($r['tipo_lavoro']): ?><div style="margin-top:8px;"><strong>Tipo:</strong> <?php echo e($r['tipo_lavoro']); ?></div><?php endif; ?>
        <p style="margin:8px 0;"><?php echo nl2br(e($r['descrizione'])); ?></p>
        <?php if ($foto): ?>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;">
            <?php foreach ($foto as $f): ?>
              <a href="../partner/uploads/<?php echo e($f); ?>" target="_blank"><img src="../partner/uploads/<?php echo e($f); ?>" style="width:120px;height:90px;object-fit:cover;border-radius:6px;border:1px solid var(--pietra-chiara);"></a>
            <?php endforeach; ?>
          </div>
        <?php endif; ?>
        <?php if ($r['preventivo_id']): ?>
          <p><a href="preventivo.php?id=<?php echo (int)$r['preventivo_id']; ?>">Vedi preventivo collegato</a></p>
        <?php endif; ?>
        <?php if ($r['stato'] === 'nuova'): ?>
          <button class="btn btn-sm btn-oro" onclick="document.getElementById('form<?php echo (int)$r['id']; ?>').style.display='block'">Crea preventivo</button>
          <div id="form<?php echo (int)$r['id']; ?>" style="display:none;margin-top:14px;border-top:1px solid var(--pietra-chiara);padding-top:14px;">
            <form method="post">
              <?php echo csrf_field(); ?>
              <input type="hidden" name="richiesta_id" value="<?php echo (int)$r['id']; ?>">
              <div class="form-row"><label>Descrizione lavoro</label><textarea name="descrizione"><?php echo e($r['descrizione']); ?></textarea></div>
              <div class="form-grid">
                <div class="form-row"><label>Manodopera &euro;</label><input type="number" step="0.01" name="costo_manodopera" value="0"></div>
                <div class="form-row"><label>Materiali &euro;</label><input type="number" step="0.01" name="costo_materiali" value="0"></div>
              </div>
              <div class="form-grid">
                <div class="form-row"><label>Trasporto &euro;</label><input type="number" step="0.01" name="costo_trasporto" value="0"></div>
                <div class="form-row"><label>Sconto %</label><input type="number" step="0.01" name="sconto_percent" value="0"></div>
              </div>
              <div class="form-row"><label>Validita' fino al</label><input type="date" name="data_validita"></div>
              <div class="form-row"><label>Note interne</label><input type="text" name="note_admin"></div>
              <button class="btn btn-oro" name="azione" value="crea_preventivo">Crea e invia preventivo</button>
              <button type="button" class="btn btn-ghost" onclick="document.getElementById('form<?php echo (int)$r['id']; ?>').style.display='none'">Annulla</button>
            </form>
          </div>
        <?php endif; ?>
      </div>
    <?php endforeach; ?>
  <?php endif; ?>
</div>

<?php include __DIR__ . '/footer.php'; ?>
