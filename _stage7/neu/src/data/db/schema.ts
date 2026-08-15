/**
 * Das Schema der lokalen Datenbank.
 *
 * Handoff-Dokument, "State Management": "lokale Datenbank ist die
 * Wahrheitsquelle (Liste, Metadaten, Tags, Ordner), Sync laeuft im
 * Hintergrund; die Liste rendert immer aus dem lokalen Bestand, damit sie
 * offline vollstaendig funktioniert."
 *
 * Vier Tabellen und ein Schluessel-Wert-Paar:
 *
 *   documents       eine Zeile je Dokument, mit allem, was ein Screen zeigt
 *   tags            Name und Farbe
 *   document_tags   die Zuordnung — eine eigene Tabelle, weil ein Tag zu
 *                   vielen Dokumenten gehoert und ein Dokument zu vielen Tags
 *   folders         Name (zugleich Ausweis), Farbe, "Inhalt offline behalten"
 *   settings        Darstellung und Bibliothek-Voreinstellungen
 *
 * Der Ordner steht als **Name** in `documents.folder_name` und nicht als
 * Fremdschluessel auf eine Ausweisspalte: der Prototyp zeigt ueberall den
 * Namen, und ein zweiter Ausweis haette in dieser App keinen Leser.
 * Umbenennen fasst deshalb beide Tabellen an (`renameFolder` im Repository) —
 * genau eine Stelle, an der das passiert.
 *
 * `ON DELETE CASCADE` in `document_tags` erspart das Aufraeumen von Hand: wird
 * ein Dokument endgueltig geloescht oder ein Tag entfernt, gehen seine
 * Zuordnungen mit.
 */

/**
 * Bei Aenderungen am Schema hochzaehlen. `user_version` steht in der Datei
 * selbst — daran erkennt der naechste Start, ob eine Migration faellig ist.
 */
export const SCHEMA_VERSION = 1;

export const DATABASE_NAME = 'kompendium.db';

export const createSchemaSql = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS documents (
  id           TEXT PRIMARY KEY NOT NULL,
  title        TEXT NOT NULL,
  doc_type     TEXT NOT NULL,
  folder_name  TEXT,
  favorite     INTEGER NOT NULL DEFAULT 0,
  cached       INTEGER NOT NULL DEFAULT 1,
  size_bytes   INTEGER NOT NULL DEFAULT 0,
  updated_at   INTEGER NOT NULL,
  imported_at  INTEGER NOT NULL,
  open_count   INTEGER NOT NULL DEFAULT 0,
  note         TEXT NOT NULL DEFAULT '',
  keep_offline INTEGER NOT NULL DEFAULT 0,
  trashed_at   INTEGER,
  source       TEXT NOT NULL DEFAULT 'sample',
  cache_key    TEXT
);

CREATE TABLE IF NOT EXISTS tags (
  id    TEXT PRIMARY KEY NOT NULL,
  name  TEXT NOT NULL,
  color TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS document_tags (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tag_id      TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (document_id, tag_id)
);

CREATE TABLE IF NOT EXISTS folders (
  name         TEXT PRIMARY KEY NOT NULL,
  color        TEXT NOT NULL,
  keep_offline INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

-- Die Bibliothek sortiert nach "zuletzt geaendert" und blendet den Papierkorb
-- aus; genau diese beiden Spalten stehen deshalb im Index.
CREATE INDEX IF NOT EXISTS documents_by_recent ON documents (trashed_at, updated_at DESC);
CREATE INDEX IF NOT EXISTS documents_by_folder ON documents (folder_name);
CREATE INDEX IF NOT EXISTS document_tags_by_tag ON document_tags (tag_id);
`;
