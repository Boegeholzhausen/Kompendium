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
export const SCHEMA_VERSION = 3;

export const DATABASE_NAME = 'kompendium.db';

export const createSchemaSql = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS documents (
  -- Seit dem Abgleich ist das dieselbe Kennung wie oben in Supabase: eine
  -- UUID. Eine eigene lokale Kennung mit einer Zuordnungstabelle daneben
  -- waere eine zweite Wahrheit ueber dieselbe Zeile.
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
  last_opened_at INTEGER,
  note         TEXT NOT NULL DEFAULT '',
  keep_offline INTEGER NOT NULL DEFAULT 0,
  trashed_at   INTEGER,
  source       TEXT NOT NULL DEFAULT 'sample',
  cache_key    TEXT,
  -- Wo die Datei in Supabase Storage liegt ("<owner>/<id>.html"). NULL heisst:
  -- diese Zeile war noch nie oben. Der Viewer holt sich das HTML darueber, wenn
  -- es nicht im lokalen Dateicache liegt.
  storage_path TEXT,
  -- Pruefsumme des Inhalts, wie sie oben steht. Aendert sie sich, ist die
  -- gecachte Datei veraltet und wird beim naechsten Oeffnen neu geholt.
  content_hash TEXT
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
  keep_offline INTEGER NOT NULL DEFAULT 0,
  -- Der Ausweis derselben Zeile in Supabase. Lokal ist der Name der Ausweis
  -- (siehe oben), oben ist es eine UUID — die Zuordnung muss irgendwo stehen,
  -- sonst landet beim naechsten Abgleich jedes Dokument im falschen Ordner.
  remote_id    TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

-- Was der Abgleich sich merken muss: das Wasserzeichen des letzten Abrufs
-- (last_pulled_at, ein SERVER-Zeitstempel) und ob der einmalige Schnitt vom
-- Beispiel-Bestand zum echten schon gelaufen ist (reset_done).
--
-- Bewusst nicht in settings: das sind Voreinstellungen des Nutzers, die er
-- in der Darstellung wiederfindet. Ein Wasserzeichen ist Buchhaltung des
-- Abgleichs und hat dort nichts zu suchen.
CREATE TABLE IF NOT EXISTS sync_state (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

-- Die Bibliothek sortiert nach "zuletzt geaendert" und blendet den Papierkorb
-- aus; genau diese beiden Spalten stehen deshalb im Index.
CREATE INDEX IF NOT EXISTS documents_by_recent ON documents (trashed_at, updated_at DESC);
CREATE INDEX IF NOT EXISTS documents_by_folder ON documents (folder_name);
CREATE INDEX IF NOT EXISTS document_tags_by_tag ON document_tags (tag_id);
`;

/**
 * Migrationen fuer Datenbanken, die schon auf einem Geraet liegen.
 *
 * `CREATE TABLE IF NOT EXISTS` legt eine fehlende Tabelle an, aendert aber
 * keine vorhandene — eine neue Spalte erreicht damit nur Neuinstallationen.
 * Der Schluessel ist die Version, die die Datei bereits hat; ausgefuehrt wird
 * alles darueber, in aufsteigender Reihenfolge.
 *
 * Version 2 (Schritt 8): `last_opened_at` fuer Screen 22 — "Zuletzt geöffnet
 * vor 6 Tagen". `NULL` fuer alles Vorhandene ist richtig: wann diese
 * Dokumente zuletzt offen waren, weiss niemand mehr, und ein erfundenes
 * Datum waere schlechter als keins.
 */
export const migrations: { to: number; sql: string }[] = [
  { to: 2, sql: 'ALTER TABLE documents ADD COLUMN last_opened_at INTEGER' },
  // Version 3: der Abgleich mit Supabase. Die Spalten sind alle `NULL`-bar und
  // bleiben es fuer alles, was rein lokal entstanden ist — eine Zeile ohne
  // `storage_path` ist keine kaputte Zeile, sondern eine, die noch nie oben war.
  { to: 3, sql: 'ALTER TABLE documents ADD COLUMN storage_path TEXT' },
  { to: 3, sql: 'ALTER TABLE documents ADD COLUMN content_hash TEXT' },
  { to: 3, sql: 'ALTER TABLE folders ADD COLUMN remote_id TEXT' },
  {
    to: 3,
    sql: 'CREATE TABLE IF NOT EXISTS sync_state (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)',
  },
];
