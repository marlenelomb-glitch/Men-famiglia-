# Deploy automatico GitHub -> Aruba — Guida alla configurazione

Con questo sistema, **ogni volta che il codice cambia su GitHub, il sito su Aruba si aggiorna da solo** via FTP. Non dovrai piu' caricare i file a mano.

La configurazione qui sotto va fatta **una volta sola**. Serve solo a dare a GitHub le chiavi di accesso al tuo spazio Aruba, in modo sicuro (i dati restano nascosti nei "Secret", non nel codice).

---

## Cosa ti serve

I dati di accesso **FTP** del tuo hosting Aruba e la **password del database**:

- **Host FTP** (es. `ftp.ammirato.it` oppure un indirizzo tipo `62.149.x.x`)
- **Utente FTP**
- **Password FTP**
- **Password del database** MySQL

I dati FTP si trovano nel pannello Aruba, nella sezione **Hosting -> FTP / Gestione account FTP** (oppure nella mail di attivazione del servizio).

---

## Passo 1 — Inserisci i "Secret" su GitHub

1. Apri il repository su GitHub.
2. In alto clicca **Settings** (Impostazioni).
3. Nel menu a sinistra: **Secrets and variables -> Actions**.
4. Clicca **New repository secret** e aggiungi questi **quattro** segreti, uno alla volta
   (Name = nome esatto qui sotto, Secret = il valore):

   | Name          | Valore da inserire                    |
   |---------------|---------------------------------------|
   | `FTP_SERVER`  | l'host FTP di Aruba                   |
   | `FTP_USERNAME`| l'utente FTP                          |
   | `FTP_PASSWORD`| la password FTP                       |
   | `DB_PASS`     | la password del database MySQL        |

   Scrivi i nomi **esattamente** come sopra (maiuscole comprese).

---

## Passo 2 — Fatto

Da adesso, ad ogni modifica caricata sul repository, GitHub:
1. inserisce automaticamente la password del database in `Gestionale/db.php`,
2. carica tutti i file su Aruba via FTP.

Puoi anche avviare il deploy **a mano** quando vuoi: scheda **Actions** del repository -> workflow **"Deploy su Aruba (FTP)"** -> **Run workflow**.

---

## Prima messa online (una tantum)

Il deploy automatico carica i file, ma il **database** va inizializzato una volta sola:

1. Fai partire almeno un deploy (o carica i file).
2. Carica **manualmente** il file `Gestionale/install.php` sul server via Gestione File di Aruba
   (il deploy automatico non lo carica, per sicurezza).
3. Apri nel browser `iltuosito/Gestionale/install.php` -> crea le tabelle e l'admin.
4. **Elimina** `install.php` dal server.

Da quel momento in poi ti bastano i deploy automatici.

---

## Note utili

- **Cartella pubblica:** il workflow carica nella radice FTP (`./`). Se il tuo spazio Aruba
  pubblica il sito da una sottocartella (es. `/www/`), apri il file
  `.github/workflows/deploy.yml` e cambia `server-dir: ./` con `server-dir: ./www/`.
- **Se la connessione FTP dà errore:** nel file del workflow cambia `protocol: ftps` in `protocol: ftp`.
- **Le foto caricate dagli utenti** (cartelle `uploads/`) non vengono mai cancellate dal deploy.
- **La password del database** non è mai scritta nel codice su GitHub: viene inserita solo
  durante il deploy, dai Secret. Nel repository resta il segnaposto.
