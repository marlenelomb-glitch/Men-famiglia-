# Gestionale Ammirato Marmi

Gestionale aziendale per **Ammirato Marmi** (lavorazione marmo e pietra naturale, Ardore RC).
PHP 8 + MySQL, frontend HTML/CSS/JS vanilla. Progettato per hosting Aruba Linux.

## Struttura

```
ammirato-marmi/
  Gestionale/        Area interna (admin + staff)
    config.php       Sessione, autenticazione, permessi
    db.php           Costanti DB, connessione PDO, helper  <-- IMPOSTARE LA PASSWORD QUI
    schema.sql       Struttura database (MySQL 5.6 compatibile)
    install.php      Crea tabelle + utente admin (da eliminare dopo l'uso)
    login.php ...    Pagine del gestionale
    assets/          style.css, app.js
    uploads/         Foto misure progetti
    api/notifiche.php  Polling notifiche
  partner/           Portale partner (isolato dal gestionale)
    register.php, login.php, index.php, catalogo.php,
    richiesta.php, preventivi.php, ordini.php
    uploads/         Foto richieste partner
```

## Installazione su Aruba

1. Carica l'intera cartella su Aruba in modo da avere:
   - `ammirato.it/Gestionale/`
   - `ammirato.it/partner/`
   (le due cartelle devono restare sorelle: il portale partner include `../Gestionale/db.php`)
2. Apri `Gestionale/db.php` e inserisci la **password del database** al posto di
   `INSERISCI_QUI_LA_PASSWORD_DB`.
3. Visita `ammirato.it/Gestionale/install.php` nel browser: crea le tabelle e l'admin.
4. **Elimina `install.php`** dal server.
5. Accedi da `ammirato.it/Gestionale/login.php`.

## Credenziali admin di default

- Email: `info@ammirato.it`
- Password: `Ammirato2024!` (cambiala dalle Impostazioni dopo il primo accesso)

## Ruoli e permessi

- **admin**: accesso completo, gestione utenti e permessi.
- **staff**: accesso solo alle sezioni per cui l'admin ha assegnato il permesso
  (controllo lato server su ogni pagina, non solo in interfaccia).
- **partner**: NON accede al gestionale interno; usa solo il portale `/partner/`.

## Sicurezza

- Password con `password_hash` (bcrypt).
- Sessioni PHP separate per gestionale (`AMMIRATO_GEST`) e partner (`AMMIRATO_PARTNER`), durata 8 ore, cookie httponly.
- Token CSRF su tutti i form.
- Input sanitizzato (`strip_tags` + `htmlspecialchars`); query sempre con prepared statement PDO.
- `.htaccess` protegge `config.php`/`db.php`/`schema.sql` e blocca l'esecuzione di script nelle cartelle `uploads/`.

## Note tecniche

- Compatibile MySQL 5.6: nessun tipo JSON, i permessi sono in un campo TEXT (JSON codificato).
- Percorsi con `__DIR__` per compatibilita' Aruba.
- Numerazione automatica documenti: `PRE-ANNO-XXXX` (preventivi), `FAT-ANNO-XXXX` (fatture).
- IVA fatture calcolata automaticamente al 22%.
