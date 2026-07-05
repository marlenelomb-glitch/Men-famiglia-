/* ==========================================================================
   Ammirato Marmi - Gestionale
   app.js - Interazioni UI (vanilla JS)
   ========================================================================== */

// ---- Sidebar mobile ----
function toggleSidebar() {
  var sb = document.getElementById('sidebar');
  var ov = document.getElementById('overlayMobile');
  if (sb) sb.classList.toggle('aperta');
  if (ov) ov.classList.toggle('aperto');
}

// ---- Modal ----
function apriModal(id) {
  var m = document.getElementById(id);
  if (m) m.classList.add('aperto');
}
function chiudiModal(id) {
  var m = document.getElementById(id);
  if (m) m.classList.remove('aperto');
}
// Chiude cliccando sullo sfondo
document.addEventListener('click', function (ev) {
  if (ev.target && ev.target.classList && ev.target.classList.contains('modal-bg')) {
    ev.target.classList.remove('aperto');
  }
});
// Chiude con ESC
document.addEventListener('keydown', function (ev) {
  if (ev.key === 'Escape') {
    var aperti = document.querySelectorAll('.modal-bg.aperto');
    var i;
    for (i = 0; i < aperti.length; i++) aperti[i].classList.remove('aperto');
  }
});

// ---- Precompila un modal di modifica con dati dal bottone (data-*) ----
function apriModalModifica(modalId, dati) {
  var m = document.getElementById(modalId);
  if (!m) return;
  var k;
  for (k in dati) {
    if (!dati.hasOwnProperty(k)) continue;
    var campo = m.querySelector('[name="' + k + '"]');
    if (campo) {
      if (campo.type === 'checkbox') {
        campo.checked = (dati[k] == 1 || dati[k] === true);
      } else {
        campo.value = dati[k] === null ? '' : dati[k];
      }
    }
  }
  m.classList.add('aperto');
}

// Legge tutti i data-* di un elemento in un oggetto
function datiDa(el) {
  var d = {};
  var i;
  for (i = 0; i < el.attributes.length; i++) {
    var a = el.attributes[i];
    if (a.name.indexOf('data-') === 0) {
      d[a.name.substring(5)] = a.value;
    }
  }
  return d;
}

// ---- Cambio stato inline (invia form nascosto) ----
function cambiaStato(sel, url, campo) {
  var f = document.createElement('form');
  f.method = 'post';
  f.action = url;
  var add = function (n, v) {
    var i = document.createElement('input');
    i.type = 'hidden'; i.name = n; i.value = v; f.appendChild(i);
  };
  add('azione', 'cambia_stato');
  add('id', sel.getAttribute('data-id'));
  add(campo || 'stato', sel.value);
  add('csrf', window.CSRF_TOKEN || '');
  document.body.appendChild(f);
  f.submit();
}

// ---- Calcolo totale preventivo in tempo reale ----
function calcolaTotalePreventivo() {
  var g = function (id) {
    var el = document.getElementById(id);
    if (!el) return 0;
    return parseFloat(String(el.value).replace(',', '.')) || 0;
  };
  var mano = g('costo_manodopera');
  var mat = g('costo_materiali');
  var trasp = g('costo_trasporto');
  var sconto = g('sconto_percent');
  var subtot = mano + mat + trasp;
  var tot = subtot - (subtot * sconto / 100);
  var out = document.getElementById('totalePreventivo');
  if (out) out.textContent = formatEuro(tot);
  var hid = document.getElementById('importo_calcolato');
  if (hid) hid.value = tot.toFixed(2);
}

function formatEuro(n) {
  return '€ ' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// ---- Calcolo IVA fattura ----
function calcolaIvaFattura() {
  var g = function (id) {
    var el = document.getElementById(id);
    if (!el) return 0;
    return parseFloat(String(el.value).replace(',', '.')) || 0;
  };
  var imponibile = g('imponibile');
  var iva = imponibile * 0.22;
  var totale = imponibile + iva;
  var setTxt = function (id, val) { var el = document.getElementById(id); if (el) el.textContent = formatEuro(val); };
  var setVal = function (id, val) { var el = document.getElementById(id); if (el) el.value = val.toFixed(2); };
  setTxt('vistaIva', iva);
  setTxt('vistaTotale', totale);
  setVal('importo_iva', iva);
  setVal('importo_totale', totale);
}

// ---- Ricerca/filtro tabella lato client ----
function filtraTabella(input, tabId) {
  var q = input.value.toLowerCase();
  var t = document.getElementById(tabId);
  if (!t) return;
  var righe = t.querySelectorAll('tbody tr');
  var i;
  for (i = 0; i < righe.length; i++) {
    var txt = righe[i].textContent.toLowerCase();
    righe[i].style.display = txt.indexOf(q) > -1 ? '' : 'none';
  }
}

// ---- Notifiche: pannello + polling ----
function toggleNotifiche() {
  var p = document.getElementById('notifPanel');
  if (p) p.classList.toggle('aperto');
}

function avviaPollingNotifiche() {
  if (!document.getElementById('notifBadge')) return;
  var aggiorna = function () {
    fetch('api/notifiche.php?azione=conteggio', { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var b = document.getElementById('notifBadge');
        if (!b) return;
        if (d && d.nuove > 0) {
          b.textContent = d.nuove;
          b.style.display = 'block';
        } else {
          b.style.display = 'none';
        }
      })
      .catch(function () {});
  };
  aggiorna();
  setInterval(aggiorna, 20000);
}

document.addEventListener('DOMContentLoaded', function () {
  avviaPollingNotifiche();
});
