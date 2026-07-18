-- ===========================================================================
-- Ammirato Marmi - Gestionale
-- schema.sql - Struttura database (MySQL 5.6 compatibile)
-- NOTA: MySQL 5.6 non supporta il tipo JSON -> si usa TEXT.
-- ===========================================================================

SET NAMES utf8;
SET foreign_key_checks = 0;

-- Utenti (staff, admin, partner)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  ruolo VARCHAR(20) NOT NULL DEFAULT 'staff',
  permessi TEXT NULL,
  attivo TINYINT(1) NOT NULL DEFAULT 1,
  approvato TINYINT(1) NOT NULL DEFAULT 0,
  ragione_sociale VARCHAR(190) NULL,
  piva VARCHAR(30) NULL,
  telefono VARCHAR(50) NULL,
  listino VARCHAR(20) NULL DEFAULT 'base',
  sconto_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  created_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Clienti
CREATE TABLE IF NOT EXISTS clienti (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(190) NOT NULL,
  email VARCHAR(190) NULL,
  telefono VARCHAR(50) NULL,
  indirizzo VARCHAR(255) NULL,
  citta VARCHAR(120) NULL,
  piva VARCHAR(30) NULL,
  note TEXT NULL,
  tipo VARCHAR(20) NOT NULL DEFAULT 'privato',
  user_id INT NULL,
  created_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Progetti
CREATE TABLE IF NOT EXISTS progetti (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NULL,
  nome VARCHAR(190) NOT NULL,
  descrizione TEXT NULL,
  stato VARCHAR(20) NOT NULL DEFAULT 'pianificato',
  data_inizio DATE NULL,
  data_consegna DATE NULL,
  note TEXT NULL,
  foto_misure TEXT NULL,
  created_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Preventivi
CREATE TABLE IF NOT EXISTS preventivi (
  id INT AUTO_INCREMENT PRIMARY KEY,
  numero VARCHAR(30) NOT NULL,
  cliente_id INT NULL,
  progetto_id INT NULL,
  data_emissione DATE NULL,
  data_validita DATE NULL,
  importo DECIMAL(12,2) NOT NULL DEFAULT 0,
  stato VARCHAR(20) NOT NULL DEFAULT 'bozza',
  descrizione TEXT NULL,
  note TEXT NULL,
  costo_manodopera DECIMAL(12,2) NOT NULL DEFAULT 0,
  costo_materiali DECIMAL(12,2) NOT NULL DEFAULT 0,
  costo_trasporto DECIMAL(12,2) NOT NULL DEFAULT 0,
  sconto_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  partner_id INT NULL,
  data_accettazione DATETIME NULL,
  created_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Voci di preventivo
CREATE TABLE IF NOT EXISTS preventivo_voci (
  id INT AUTO_INCREMENT PRIMARY KEY,
  preventivo_id INT NOT NULL,
  descrizione VARCHAR(255) NOT NULL,
  categoria VARCHAR(60) NULL,
  quantita DECIMAL(12,2) NOT NULL DEFAULT 1,
  unita VARCHAR(20) NULL,
  prezzo_unitario DECIMAL(12,2) NOT NULL DEFAULT 0,
  prezzo_totale DECIMAL(12,2) NOT NULL DEFAULT 0,
  posizione INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Fatture
CREATE TABLE IF NOT EXISTS fatture (
  id INT AUTO_INCREMENT PRIMARY KEY,
  numero VARCHAR(30) NOT NULL,
  cliente_id INT NULL,
  progetto_id INT NULL,
  data_emissione DATE NULL,
  data_scadenza DATE NULL,
  importo DECIMAL(12,2) NOT NULL DEFAULT 0,
  importo_iva DECIMAL(12,2) NOT NULL DEFAULT 0,
  importo_totale DECIMAL(12,2) NOT NULL DEFAULT 0,
  stato VARCHAR(20) NOT NULL DEFAULT 'bozza',
  descrizione TEXT NULL,
  note TEXT NULL,
  created_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Inventario materiali
CREATE TABLE IF NOT EXISTS inventario (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(190) NOT NULL,
  descrizione TEXT NULL,
  categoria VARCHAR(40) NOT NULL DEFAULT 'Marmo',
  spessore DECIMAL(6,2) NULL,
  quantita DECIMAL(12,2) NOT NULL DEFAULT 0,
  quantita_minima DECIMAL(12,2) NOT NULL DEFAULT 0,
  unita VARCHAR(20) NOT NULL DEFAULT 'mq',
  costo_unitario DECIMAL(12,2) NOT NULL DEFAULT 0,
  prezzo_vendita DECIMAL(12,2) NOT NULL DEFAULT 0,
  note TEXT NULL,
  created_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Lavorazioni
CREATE TABLE IF NOT EXISTS lavorazioni (
  id INT AUTO_INCREMENT PRIMARY KEY,
  progetto_id INT NULL,
  titolo VARCHAR(190) NOT NULL,
  descrizione TEXT NULL,
  stato VARCHAR(20) NOT NULL DEFAULT 'da_iniziare',
  assegnato_a INT NULL,
  data_inizio DATE NULL,
  data_scadenza DATE NULL,
  note TEXT NULL,
  created_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Eventi calendario
CREATE TABLE IF NOT EXISTS eventi (
  id INT AUTO_INCREMENT PRIMARY KEY,
  titolo VARCHAR(190) NOT NULL,
  descrizione TEXT NULL,
  data_inizio DATETIME NULL,
  data_fine DATETIME NULL,
  tutto_il_giorno TINYINT(1) NOT NULL DEFAULT 0,
  progetto_id INT NULL,
  cliente_id INT NULL,
  tipo VARCHAR(30) NOT NULL DEFAULT 'altro',
  created_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Transazioni finanziarie
CREATE TABLE IF NOT EXISTS transazioni (
  id INT AUTO_INCREMENT PRIMARY KEY,
  data DATE NOT NULL,
  tipo VARCHAR(10) NOT NULL DEFAULT 'entrata',
  categoria VARCHAR(120) NULL,
  importo DECIMAL(12,2) NOT NULL DEFAULT 0,
  descrizione VARCHAR(255) NULL,
  note TEXT NULL,
  created_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Risorse (operai e macchinari)
CREATE TABLE IF NOT EXISTS risorse (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(190) NOT NULL,
  tipo VARCHAR(20) NOT NULL DEFAULT 'operaio',
  tariffa_oraria DECIMAL(10,2) NULL,
  disponibilita VARCHAR(20) NULL,
  note TEXT NULL,
  attivo TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Richieste partner
CREATE TABLE IF NOT EXISTS partner_richieste (
  id INT AUTO_INCREMENT PRIMARY KEY,
  partner_id INT NOT NULL,
  descrizione TEXT NULL,
  tipo_lavoro VARCHAR(120) NULL,
  foto TEXT NULL,
  stato VARCHAR(20) NOT NULL DEFAULT 'nuova',
  preventivo_id INT NULL,
  note_admin TEXT NULL,
  created_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Notifiche
CREATE TABLE IF NOT EXISTS notifiche (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipo VARCHAR(40) NULL,
  titolo VARCHAR(190) NULL,
  messaggio TEXT NULL,
  entita_id INT NULL,
  entita_tipo VARCHAR(40) NULL,
  letta TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

-- Fornitori
CREATE TABLE IF NOT EXISTS fornitori (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(190) NOT NULL,
  email VARCHAR(190) NULL,
  telefono VARCHAR(50) NULL,
  indirizzo VARCHAR(255) NULL,
  piva VARCHAR(30) NULL,
  note TEXT NULL,
  created_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

SET foreign_key_checks = 1;
