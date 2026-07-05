<?php
/**
 * Ammirato Marmi - Gestionale
 * progetto.php - Scheda singolo progetto
 */
require_once __DIR__ . '/config.php';
require_permission('progetti');

$id = (int) get('id');
$p = q_one('SELECT p.*, c.nome AS cliente_nome FROM progetti p LEFT JOIN clienti c ON c.id = p.cliente_id WHERE p.id = ?', array($id));
if (!$p) { flash('Progetto non trovato.', 'err'); redirect('progetti.php'); }

$titolo_pagina = 'Scheda progetto';
$pagina_attiva = 'progetti';

$lavorazioni = q_all('SELECT l.*, r.nome AS operaio FROM lavorazioni l LEFT JOIN risorse r ON r.id = l.assegnato_a WHERE l.progetto_id = ? ORDER BY l.created_at DESC', array($id));
$preventivi = q_all('SELECT * FROM preventivi WHERE progetto_id = ? ORDER BY created_at DESC', array($id));
$foto = array_filter(array_map('trim', explode(',', $p['foto_misure'])));

include __DIR__ . '/header.php';
?>

<p><a href="progetti.php">&larr; Torna ai progetti</a></p>

<div class="card">
  <div class="card-header">
    <h2><?php echo e($p['nome']); ?></h2>
    <span class="badge badge-grigio"><?php echo e($p['stato']); ?></span>
  </div>
  <dl class="dl">
    <dt>Cliente</dt><dd><?php echo e($p['cliente_nome'] ? $p['cliente_nome'] : '-'); ?></dd>
    <dt>Inizio</dt><dd><?php echo data_it($p['data_inizio']); ?></dd>
    <dt>Consegna</dt><dd><?php echo data_it($p['data_consegna']); ?></dd>
    <dt>Descrizione</dt><dd><?php echo nl2br(e($p['descrizione'])); ?></dd>
    <dt>Note</dt><dd><?php echo nl2br(e($p['note'])); ?></dd>
  </dl>
  <?php if ($foto): ?>
    <h3 style="margin-top:20px;font-size:15px;">Foto con misure</h3>
    <div style="display:flex;gap:12px;flex-wrap:wrap;">
      <?php foreach ($foto as $f): ?>
        <a href="uploads/<?php echo e($f); ?>" target="_blank"><img src="uploads/<?php echo e($f); ?>" alt="misura" style="width:140px;height:110px;object-fit:cover;border-radius:6px;border:1px solid var(--pietra-chiara);"></a>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>
</div>

<div class="griglia-2">
  <div class="card">
    <div class="card-header"><h2>Lavorazioni</h2></div>
    <?php if (!$lavorazioni): ?><p class="muted">Nessuna lavorazione collegata.</p><?php else: ?>
      <table class="tab"><tbody>
      <?php foreach ($lavorazioni as $l): ?>
        <tr><td><?php echo e($l['titolo']); ?><div class="muted" style="font-size:12px;"><?php echo e($l['operaio'] ? $l['operaio'] : ''); ?></div></td>
        <td><span class="badge badge-grigio"><?php echo e($l['stato']); ?></span></td></tr>
      <?php endforeach; ?>
      </tbody></table>
    <?php endif; ?>
  </div>
  <div class="card">
    <div class="card-header"><h2>Preventivi</h2></div>
    <?php if (!$preventivi): ?><p class="muted">Nessun preventivo collegato.</p><?php else: ?>
      <table class="tab"><tbody>
      <?php foreach ($preventivi as $pr): ?>
        <tr><td><a href="preventivo.php?id=<?php echo (int)$pr['id']; ?>"><?php echo e($pr['numero']); ?></a></td>
        <td class="text-right"><?php echo euro($pr['importo']); ?></td>
        <td><span class="badge badge-grigio"><?php echo e($pr['stato']); ?></span></td></tr>
      <?php endforeach; ?>
      </tbody></table>
    <?php endif; ?>
  </div>
</div>

<?php include __DIR__ . '/footer.php'; ?>
