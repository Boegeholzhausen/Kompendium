/**
 * Das Schema der lokalen Datenbank.
 *
 * Handoff-Dokument, "State Management": "lokale Datenbank ist die
 * Wahrheitsquelle (Liste, Metadaten, Ordner), Sync laeuft im Hintergrund; die
 * Liste rendert immer aus dem lokalen Bestand, damit sie offline vollstaendig
 * funktioniert."
 *
 * Drei Tabellen und zwei Schluessel-Wert-Paare:
 *
 *   documents          eine Zeile je Dokument, mit allem, was ein Screen zeigt
 *   folders            Name (zugleich Ausweis), Farbe, "Inhalt offline behalten"
 *   outbox             was lokal geaendert wurde und noch nach oben muss
 *   folder_deletions   Grabsteine geloeschter Ordner (siehe unten)
 *   document_deletions Grabsteine endgueltig geloeschter Dokumente
 *   settings           Darstellung und Bibliothek-Voreinstellungen
 *
 * Der Workflow-Status (`read_at`, `archived_at`) steht als Spalte in der
 * Dokumentzeile und nicht als Zuordnung wie frueher die Tags: "gelesen" ist
 * ein einwertiger Lebenszyklus, keine mehrwertige Klassifikation — ueber eine
 * Zuordnungstabelle abgebildet erlaubte die Datenbank Zustaende, die es
 * fachlich nicht gibt. Archiv ist dabei eine zweite Achse und keine dritte
 * Stufe: ein archiviertes Dokument ist in aller Regel auch gelesen, und mit
 * nur einer Status-Spalte ginge beim Entarchivieren die Leseinformation
 * verloren.
 *
 * Der Ordner steht als **Name** in `documents.folder_name` und nicht als
 * Fremdschluessel auf eine Ausweisspalte: der Prototyp zeigt ueberall den
 * Namen, und ein zweiter Ausweis haette in dieser App keinen Leser.
 * Umbenennen fasst deshalb beide Tabellen an (`renameFolder` im Repository) —
 * genau eine Stelle, an der das passiert.
 *
 * `ON DELETE CASCADE` in `outbox` erspart das Aufraeumen von Hand: wird ein
 * Dokument endgueltig geloescht, geht sein offener Eintrag mit.
 */

/**
 * Bei Aenderungen am Schema hochzaehlen. `user_version` steht in der Datei
 * selbst — daran erkennt der naechste Start, ob eine Migration faellig ist.
 */
export const SCHEMA_VERSION = 8;

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
  content_hash TEXT,
  -- Workflow-Status, Millisekunden wie ueberall sonst. NULL = ungelesen bzw.
  -- nicht archiviert. Zwei Spalten statt einer, weil Archiv eine zweite Achse
  -- ist: sonst ginge beim Entarchivieren verloren, dass gelesen wurde.
  read_at      INTEGER,
  archived_at  INTEGER,
  -- Leseposition in dp vom Seitenanfang. Sie stand frueher als JSON-Objekt in
  -- der settings-Tabelle — ein Wert ueber ein Dokument, der nicht am
  -- Dokument hing und deshalb auch nie mit ihm nach oben ging.
  scroll_offset INTEGER NOT NULL DEFAULT 0
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

-- Der Weg nach oben: welche Dokumente lokal geaendert wurden und noch nicht
-- in Supabase stehen.
CREATE TABLE IF NOT EXISTS outbox (
  document_id TEXT PRIMARY KEY NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  -- JSON-Liste der geaenderten Feldnamen. Nicht die Werte: die stehen in
  -- documents und sind dort immer der neueste Stand. Ein zweites Mal
  -- gespeicherte Werte waeren eine zweite Wahrheit, die veralten kann.
  fields      TEXT NOT NULL,
  queued_at   INTEGER NOT NULL
);

-- Grabsteine geloeschter Ordner.
--
-- Der Push vergleicht den lokalen Ordnerbestand direkt mit oben — eine zweite
-- Outbox nur fuer eine Handvoll Ordner waere Buchhaltung ohne Gegenwert. Genau
-- ein Fall entzieht sich diesem Vergleich: eine geloeschte Zeile hinterlaesst
-- lokal nichts, was der Vergleich noch finden koennte. Der Grabstein ist die
-- einzige Spur, an der der naechste Lauf erkennt, dass oben ein deleted_at
-- faellig ist.
CREATE TABLE IF NOT EXISTS folder_deletions (
  remote_id TEXT PRIMARY KEY NOT NULL,
  queued_at INTEGER NOT NULL
);

-- Grabsteine endgueltig geloeschter Dokumente — dieselbe Ueberlegung wie eine
-- Zeile darueber, nur fuer die andere Tabelle.
--
-- Die Outbox kann das nicht leisten: ihr Eintrag haengt per ON DELETE CASCADE
-- an der Dokumentzeile und geht mit ihr, genau im Moment des Loeschens. Ohne
-- Grabstein bliebe die Zeile oben fuer immer stehen (und ihre Datei mit ihr),
-- selbst wenn der Papierkorb-Vermerk nie hochkam — etwa wenn offline
-- weggeworfen und die 30-Tage-Frist offline abgelaufen ist.
--
-- Der Ablageort steht mit drin, weil er sich nach dem Loeschen nirgends mehr
-- ablesen laesst: die Datei im Bucket muss mitgeloescht werden, sonst waechst
-- er monoton (nichts im Projekt raeumt ihn sonst auf).
--
-- Die Spalte pushed_at macht daraus zwei Dinge in einer Tabelle, mit Absicht:
--
--   NULL           noch abzuarbeiten — der naechste Push setzt oben
--                  deleted_at und raeumt die Datei weg
--   ein Zeitpunkt  erledigt, aber die Zeile BLEIBT als Sperrliste stehen
--
-- Ohne das Bleiben kaeme das Dokument sofort zurueck: der Push setzt oben
-- deleted_at, der Trigger schreibt updated_at fort, und der Abruf im selben
-- Lauf legte die Zeile lokal als Papierkorb-Eintrag wieder an — ein Dokument,
-- das der Nutzer gerade endgueltig weggeworfen hat. applyRemote schlaegt
-- deshalb hier nach, bevor es eine Zeile anlegt.
CREATE TABLE IF NOT EXISTS document_deletions (
  document_id  TEXT PRIMARY KEY NOT NULL,
  storage_path TEXT NOT NULL,
  queued_at    INTEGER NOT NULL,
  pushed_at    INTEGER
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
 *
 * Version 4: Workflow-Status statt Tags. Bestehende Zeilen starten mit
 * `read_at = NULL`, sind also ungelesen — was vor dem Umbau gelesen wurde,
 * weiss niemand mehr, und "alles gelesen" waere eine Behauptung. Dieselbe
 * Zurueckhaltung wie bei `last_opened_at` in Version 2.
 *
 * Version 6 steht bewusst OHNE Eintrag: die Umstellung der lokalen
 * Import-Kennungen auf UUIDs ist eine Datenwanderung und kein `ALTER TABLE`.
 * Sie muss Zeile fuer Zeile rechnen (neue Kennung erzeugen, Outbox und
 * Leseposition mitziehen) — hier steht ausschliesslich SQL. Ihr Platz ist
 * `migrateLocalIdsToUuid` im Repository, abgesichert ueber den
 * `sync_state`-Schluessel `uuid_ids_done`.
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
  // Version 4: der Workflow-Status loest die Tags ab. Reihenfolge beachten —
  // `document_tags` haengt per Fremdschluessel an `tags`, und
  // `PRAGMA foreign_keys` steht auf ON: die Zuordnung muss zuerst weg.
  { to: 4, sql: 'ALTER TABLE documents ADD COLUMN read_at INTEGER' },
  { to: 4, sql: 'ALTER TABLE documents ADD COLUMN archived_at INTEGER' },
  { to: 4, sql: 'DROP TABLE IF EXISTS document_tags' },
  { to: 4, sql: 'DROP TABLE IF EXISTS tags' },
  {
    to: 4,
    sql: `CREATE TABLE IF NOT EXISTS outbox (
      document_id TEXT PRIMARY KEY NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      fields      TEXT NOT NULL,
      queued_at   INTEGER NOT NULL
    )`,
  },
  // Version 5: Ordner gehen nach oben. Der Grabstein ist die einzige Spur, die
  // ein geloeschter Ordner hinterlaesst — ohne ihn faende der Vergleich beim
  // naechsten Push nichts mehr, was zu loeschen waere.
  {
    to: 5,
    sql: `CREATE TABLE IF NOT EXISTS folder_deletions (
      remote_id TEXT PRIMARY KEY NOT NULL,
      queued_at INTEGER NOT NULL
    )`,
  },
  // Version 7: die Leseposition wandert aus `settings` in die Dokumentzeile.
  // Die Uebernahme der vorhandenen Werte ist wieder eine Datenwanderung und
  // steht deshalb nicht hier, sondern in `adoptScrollPositions` im Repository
  // (`sync_state`-Schluessel `scroll_moved`). Der Vorgabewert 0 ist richtig:
  // ein Dokument ohne gemerkte Stelle faengt oben an.
  { to: 7, sql: 'ALTER TABLE documents ADD COLUMN scroll_offset INTEGER NOT NULL DEFAULT 0' },
  // Version 8: Grabsteine fuer endgueltig geloeschte Dokumente. Vorhandene
  // Installationen fangen mit einer leeren Tabelle an — was vor diesem Umbau
  // geloescht wurde, steht oben noch, und das nachtraeglich zu erraten ginge
  // nur ueber einen Vollabgleich gegen den Server. Dieselbe Zurueckhaltung wie
  // bei `read_at` in Version 4: lieber nichts behaupten.
  {
    to: 8,
    sql: `CREATE TABLE IF NOT EXISTS document_deletions (
      document_id  TEXT PRIMARY KEY NOT NULL,
      storage_path TEXT NOT NULL,
      queued_at    INTEGER NOT NULL,
      pushed_at    INTEGER
    )`,
  },
];
