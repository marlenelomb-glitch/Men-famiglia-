<?php
/**
 * Ammirato Marmi - Portale Partner
 * richiesta.php - Invio richiesta di preventivo con foto
 */
require_once __DIR__ . '/config.php';
require_partner();

$p = partner_corrente();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    if (post('descrizione') === '') {
        flash('Inserisci una descrizione del lavoro.', 'err');
    } else {
        // Upload fino a piu' foto (campo multiplo gestito uno a uno)
        $foto = array();
        $f1 = upload_immagine_partner('foto1');
        $f2 = upload_immagine_partner('foto2');
        $f3 = upload_immagine_partner('foto3');
        if ($f1) $foto[] = $f1;
        if ($f2) $foto[] = $f2;
        if ($f3) $foto[] = $f3;
        q('INSERT INTO partner_richieste (partner_id, descrizione, tipo_lavoro, foto, stato, created_at) VALUES (?,?,?,?,?,?)',
          array($p['id'], post('descrizione'), post('tipo_lavoro'), implode(',', $foto), 'nuova', adesso()));
        crea_notifica('richiesta', 'Nuova richiesta preventivo', $p['nome'] . ' ha inviato una richiesta di preventivo.', last_id(), 'richiesta');
        flash('Richiesta inviata. Ti contatteremo con un preventivo.');
        redirect('index.php');
    }
    redirect('richiesta.php');
}

$titolo_pagina = 'Richiedi preventivo';
$pagina_attiva = 'richiesta';

include __DIR__ . '/header.php';
?>

<div class="card" style="max-width:640px;">
  <div class="card-header"><h2>Richiesta di preventivo</h2></div>
  <form method="post" action="richiesta.php" enctype="multipart/form-data">
    <?php echo csrf_field(); ?>
    <div class="form-row"><label>Tipo di lavoro</label><input type="text" name="tipo_lavoro" placeholder="es. Piano cucina, scala, rivestimento"></div>
    <div class="form-row"><label>Descrizione del lavoro *</label><textarea name="descrizione" rows="5" required placeholder="Descrivi misure, materiale desiderato, finitura, tempistiche..."></textarea></div>
    <div class="form-grid-3">
      <div class="form-row"><label>Foto 1</label><input type="file" name="foto1" accept="image/*"></div>
      <div class="form-row"><label>Foto 2</label><input type="file" name="foto2" accept="image/*"></div>
      <div class="form-row"><label>Foto 3</label><input type="file" name="foto3" accept="image/*"></div>
    </div>
    <button type="submit" class="btn btn-oro">Invia richiesta</button>
  </form>
</div>

<?php include __DIR__ . '/footer.php'; ?>
