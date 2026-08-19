/**
 * Das Repository — der einzige Ort im Projekt, an dem SQL steht.
 *
 * Die Zustaende (`src/state/*`) lesen beim Start einmal `loadSnapshot()` und
 * schreiben danach jede Aenderung hierher zurueck. Kein Screen kennt die
 * Datenbank; er kennt nur seinen Zustand. Damit bleibt der Wechsel auf den
 * Supabase-Sync eine Sache dieser Datei.
 *
 * Geschrieben wird **feldweise** (`updateDocuments(ids, patch)`), nicht als
 * ganze Zeile: die Screens aendern immer nur ein paar Spalten, und eine ganze
 * Zeile zurueckzuschreiben hiesse, den Rest aus dem Zustand neu zu belegen —
 * jede Abweichung dort waere ein stiller Datenverlust.
 *
 * Fuer den Web-Export gibt es `repository.web.ts` mit derselben Schnittstelle
 * im Arbeitsspeicher: expo-sqlite laeuft im Browser ueber WebAssembly und
 * verlangt dafuer eigene HTTP-Kopfzeilen, die der statische Build (`python3
 * -m http.server`) nicht liefert. Der Web-Build dient allein der
 * Bildkontrolle gegen den Prototyp — dieselbe Ueberlegung wie bei
 * `DocumentView.web.tsx`.
 */
import {
  openDatabaseAsync,
  type SQLiteBindValue,
  type SQLiteDatabase,
} from 'expo-sqlite';

import { seedFolders, seedLibrary } from '../sampleLibrary';
import { isSupabaseConfigured } from '../supabase';
import type { LibraryFolder, StoredDocument } from '../library';
import type { DocType } from '../../theme/tile';
import { createSchemaSql, DATABASE_NAME, migrations, SCHEMA_VERSION } from './schema';

export interface Snapshot {
  documents: StoredDocument[];
  folders: LibraryFolder[];
  settings: Record<string, string>;
}

/** Alle Spalten, die ein Screen aendern kann. */
export interface DocumentPatch {
  title?: string;
  folderName?: string | null;
  favorite?: boolean;
  cached?: boolean;
  note?: string;
  keepOffline?: boolean;
  openCount?: number;
  lastOpenedAt?: number | null;
  trashedAt?: number | null;
  updatedAt?: number;
  sizeBytes?: number;
  cacheKey?: string | null;
  storagePath?: string | null;
  contentHash?: string | null;
  readAt?: number | null;
  archivedAt?: number | null;
}

interface DocumentRow {
  id: string;
  title: string;
  doc_type: string;
  folder_name: string | null;
  favorite: number;
  cached: number;
  size_bytes: number;
  updated_at: number;
  imported_at: number;
  open_count: number;
  last_opened_at: number | null;
  note: string;
  keep_offline: number;
  trashed_at: number | null;
  source: string;
  cache_key: string | null;
  storage_path: string | null;
  content_hash: string | null;
  read_at: number | null;
  archived_at: number | null;
}

/** Spaltenname je Feld des Patches — die einzige Stelle mit dieser Zuordnung. */
const columns: Record<keyof DocumentPatch, string> = {
  title: 'title',
  folderName: 'folder_name',
  favorite: 'favorite',
  cached: 'cached',
  note: 'note',
  keepOffline: 'keep_offline',
  openCount: 'open_count',
  lastOpenedAt: 'last_opened_at',
  trashedAt: 'trashed_at',
  updatedAt: 'updated_at',
  sizeBytes: 'size_bytes',
  cacheKey: 'cache_key',
  storagePath: 'storage_path',
  contentHash: 'content_hash',
  readAt: 'read_at',
  archivedAt: 'archived_at',
};

let handle: Promise<SQLiteDatabase> | null = null;

function toBind(value: unknown): SQLiteBindValue {
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value as SQLiteBindValue;
}

/**
 * Oeffnet die Datenbank, legt das Schema an und befuellt sie beim allerersten
 * Start. Das Versprechen wird gemerkt: jeder weitere Aufruf bekommt dieselbe
 * Verbindung, auch wenn zwei Screens gleichzeitig fragen.
 */
function database(): Promise<SQLiteDatabase> {
  if (handle === null) {
    handle = (async () => {
      const db = await openDatabaseAsync(DATABASE_NAME);
      await db.execAsync(createSchemaSql);
      await migrate(db);
      await seedIfEmpty(db);
      return db;
    })();
  }
  return handle;
}

/**
 * Bringt eine vorhandene Datei auf den heutigen Stand.
 *
 * `createSchemaSql` legt nur an, was fehlt — eine neue Spalte in einer
 * bestehenden Tabelle erreicht es nicht. Die Version steht in der Datei
 * selbst (`user_version`); eine frisch angelegte Datenbank steht auf 0, hat
 * aber schon alle Spalten, deshalb laeuft dort nur das PRAGMA.
 */
async function migrate(db: SQLiteDatabase): Promise<void> {
  const rows = await db.getAllAsync<{ user_version: number }>('PRAGMA user_version');
  const from = rows[0]?.user_version ?? 0;
  if (from === SCHEMA_VERSION) return;

  // Eine leere Datei ist keine alte Datei: sie wurde eben erst aus
  // `createSchemaSql` gebaut und braucht keinen ALTER-Befehl.
  const counted = await db.getAllAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM documents'
  );
  const fresh = from === 0 && (counted[0]?.count ?? 0) === 0;

  if (!fresh) {
    for (const step of migrations) {
      if (step.to <= from) continue;
      await db.execAsync(step.sql);
    }
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

/**
 * Die Erstbefuellung — aber nur, solange es nichts Echtes gibt.
 *
 * Sobald Zugangsdaten in `.env` stehen, kommt der Bestand aus Supabase, und
 * der Beispiel-Bestand haette dann nur eine Wirkung: er stuende beim ersten
 * Start neben den echten Dokumenten und liesse den Nutzer aufraeumen, was er
 * nie angelegt hat. Ohne `.env` bleibt er, was er war — der Grund, warum die
 * App auch ohne Server etwas zu zeigen hat.
 */
async function seedIfEmpty(db: SQLiteDatabase): Promise<void> {
  if (isSupabaseConfigured) return;

  const rows = await db.getAllAsync<{ count: number }>('SELECT COUNT(*) AS count FROM documents');
  if ((rows[0]?.count ?? 0) > 0) return;

  await db.withTransactionAsync(async () => {
    for (const folder of seedFolders) {
      await db.runAsync('INSERT INTO folders (name, color, keep_offline) VALUES (?, ?, ?)', [
        folder.name,
        folder.color,
        folder.keepOffline ? 1 : 0,
      ]);
    }
    for (const document of seedLibrary) {
      await insertRow(db, document);
    }
  });
}

async function insertRow(db: SQLiteDatabase, document: StoredDocument): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO documents
       (id, title, doc_type, folder_name, favorite, cached, size_bytes,
        updated_at, imported_at, open_count, last_opened_at, note, keep_offline,
        trashed_at, source, cache_key, storage_path, content_hash, read_at,
        archived_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      document.id,
      document.title,
      document.docType,
      document.folderName,
      document.favorite ? 1 : 0,
      document.cached ? 1 : 0,
      document.sizeBytes,
      document.updatedAt,
      document.importedAt,
      document.openCount,
      document.lastOpenedAt,
      document.note,
      document.keepOffline ? 1 : 0,
      document.trashedAt,
      document.source,
      document.cacheKey,
      document.storagePath,
      document.contentHash,
      document.readAt,
      document.archivedAt,
    ]
  );
}

function toDocument(row: DocumentRow): StoredDocument {
  return {
    id: row.id,
    title: row.title,
    docType: row.doc_type as DocType,
    folderName: row.folder_name,
    favorite: row.favorite === 1,
    cached: row.cached === 1,
    sizeBytes: row.size_bytes,
    updatedAt: row.updated_at,
    importedAt: row.imported_at,
    openCount: row.open_count,
    lastOpenedAt: row.last_opened_at,
    note: row.note,
    keepOffline: row.keep_offline === 1,
    trashedAt: row.trashed_at,
    source: row.source as StoredDocument['source'],
    cacheKey: row.cache_key,
    storagePath: row.storage_path,
    contentHash: row.content_hash,
    readAt: row.read_at,
    archivedAt: row.archived_at,
  };
}

export async function loadSnapshot(): Promise<Snapshot> {
  const db = await database();

  const [documentRows, folderRows, settingRows] = await Promise.all([
    db.getAllAsync<DocumentRow>('SELECT * FROM documents'),
    db.getAllAsync<{ name: string; color: string; keep_offline: number }>('SELECT * FROM folders'),
    db.getAllAsync<{ key: string; value: string }>('SELECT * FROM settings'),
  ]);

  return {
    documents: documentRows.map(toDocument),
    folders: folderRows.map((row) => ({
      name: row.name,
      color: row.color,
      keepOffline: row.keep_offline === 1,
    })),
    settings: Object.fromEntries(settingRows.map((row) => [row.key, row.value])),
  };
}

export async function insertDocument(document: StoredDocument): Promise<void> {
  await insertRow(await database(), document);
}

export async function updateDocuments(ids: string[], patch: DocumentPatch): Promise<void> {
  const keys = (Object.keys(patch) as (keyof DocumentPatch)[]).filter(
    (key) => patch[key] !== undefined
  );
  if (ids.length === 0 || keys.length === 0) return;

  const db = await database();
  const assignments = keys.map((key) => `${columns[key]} = ?`).join(', ');
  const values = keys.map((key) => toBind(patch[key]));
  const placeholders = ids.map(() => '?').join(', ');

  // Schreiben und Einreihen gehoeren zusammen: eine Aenderung, die in
  // `documents` steht, aber nicht in der Outbox, ginge beim naechsten Abruf
  // still verloren.
  await db.withTransactionAsync(async () => {
    await db.runAsync(`UPDATE documents SET ${assignments} WHERE id IN (${placeholders})`, [
      ...values,
      ...ids,
    ]);
    await queueForPush(db, ids, keys);
  });
}

/**
 * Alles, was laenger als die Papierkorb-Frist im Papierkorb liegt.
 *
 * Der Hinweisstreifen auf Blatt `6a` verspricht "Wird nach 30 Tagen endgueltig
 * geloescht" — den Aufraeumlauf dazu stoesst `hydrateStores()` beim Start an.
 * Der Schluessel der Datei kommt mit, weil sie im selben Zug wegmuss (A4).
 */
export async function expiredTrashIds(
  before: number
): Promise<{ id: string; cacheKey: string | null }[]> {
  const db = await database();
  const rows = await db.getAllAsync<{ id: string; cache_key: string | null }>(
    'SELECT id, cache_key FROM documents WHERE trashed_at IS NOT NULL AND trashed_at < ?',
    [before]
  );
  return rows.map((row) => ({ id: row.id, cacheKey: row.cache_key }));
}

/** Endgueltig loeschen — nur aus dem Papierkorb heraus (Blatt `6a`). */
export async function deleteDocuments(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await database();
  const placeholders = ids.map(() => '?').join(', ');
  await db.runAsync(`DELETE FROM documents WHERE id IN (${placeholders})`, ids);
}

export async function upsertFolder(folder: LibraryFolder): Promise<void> {
  const db = await database();
  await db.runAsync(
    'INSERT OR REPLACE INTO folders (name, color, keep_offline) VALUES (?, ?, ?)',
    [folder.name, folder.color, folder.keepOffline ? 1 : 0]
  );
}

/**
 * Der Name IST der Ausweis, deshalb fasst Umbenennen beide Tabellen an. Beide
 * Schritte stehen in einer Transaktion: ein Aussetzer dazwischen liesse
 * Dokumente in einem Ordner zurueck, den es nicht mehr gibt.
 */
export async function renameFolder(from: string, to: string): Promise<void> {
  const db = await database();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE folders SET name = ? WHERE name = ?', [to, from]);
    await db.runAsync('UPDATE documents SET folder_name = ? WHERE folder_name = ?', [to, from]);
  });
}

/**
 * Ordner loeschen — dieselbe Ueberlegung wie beim Umbenennen, deshalb ebenfalls
 * in einer Transaktion: erst die Dokumente aus dem Ordner nehmen, dann den
 * Ordner selbst. Ein Aussetzer dazwischen liesse Dokumente in einem Ordner
 * zurueck, den es nicht mehr gibt.
 *
 * Die Dokumente werden NIE mitgeloescht — sie landen in "Nicht einsortiert".
 * Ein Ordner ist eine Ablage, kein Behaelter, und ein versehentlich geloeschter
 * Ordner darf keine Dokumente mitnehmen.
 */
export async function deleteFolder(name: string): Promise<void> {
  const db = await database();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE documents SET folder_name = NULL WHERE folder_name = ?', [name]);
    await db.runAsync('DELETE FROM folders WHERE name = ?', [name]);
  });
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await database();
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
}

// ── Abgleich mit Supabase ───────────────────────────────────────────────────

// ── Outbox: der Weg nach oben ───────────────────────────────────────────────

/**
 * Felder, die nach oben gehoeren. Alles andere beschreibt dieses Geraet:
 * `cached`, `cacheKey` und `sizeBytes` sagen etwas ueber die Datei, die hier
 * liegt, `storagePath` und `contentHash` kommen ohnehin vom Server, und
 * `updatedAt` setzt oben der Server (siehe `remote/push.ts`).
 */
const PUSHABLE: (keyof DocumentPatch)[] = [
  'title',
  'folderName',
  'favorite',
  'note',
  'keepOffline',
  'trashedAt',
  'openCount',
  'lastOpenedAt',
  'readAt',
  'archivedAt',
];

/** Ein offener Eintrag, mit allem, was `pushChanges` daraus bauen muss. */
export interface OutboxEntry {
  documentId: string;
  fields: (keyof DocumentPatch)[];
  queuedAt: number;
  document: StoredDocument;
  /** Ausweis des Ordners oben; `null`, wenn der Ordner nur lokal existiert. */
  folderRemoteId: string | null;
}

interface OutboxRow extends DocumentRow {
  outbox_fields: string;
  outbox_queued_at: number;
  folder_remote_id: string | null;
}

/**
 * Eine Aenderung fuer den Weg nach oben vormerken.
 *
 * Das passiert ausschliesslich hier, in `updateDocuments` — dort laeuft jede
 * Aenderung eines Screens durch, und damit gibt es genau eine Stelle, an der
 * nichts vergessen werden kann.
 */
async function queueForPush(
  db: SQLiteDatabase,
  ids: string[],
  keys: (keyof DocumentPatch)[]
): Promise<void> {
  const fields = keys.filter((key) => PUSHABLE.includes(key));
  if (fields.length === 0) return;

  const placeholders = ids.map(() => '?').join(', ');
  // Nur Zeilen, die es oben schon gibt. Eine Zeile ohne `storage_path` war nie
  // oben: ein `update` traefe dort nichts, und ein `insert` erzeugte eine
  // Zeile ohne Datei. Solche Dokumente bleiben lokal, bis es die
  // Hochlade-Richtung fuer Dateien gibt (README, "Abweichungen").
  const rows = await db.getAllAsync<{ id: string; fields: string | null }>(
    `SELECT d.id AS id, o.fields AS fields
       FROM documents d LEFT JOIN outbox o ON o.document_id = d.id
      WHERE d.id IN (${placeholders}) AND d.storage_path IS NOT NULL`,
    ids
  );
  if (rows.length === 0) return;

  const now = Date.now();
  for (const row of rows) {
    // Vereinigung in TypeScript statt in SQL: JSON-Listen zu mischen ist
    // nichts, was SQLite verlaesslich kann, und die Menge ist winzig.
    const before = parseFields(row.fields);
    const merged = [...new Set([...before, ...fields])];
    await db.runAsync(
      'INSERT OR REPLACE INTO outbox (document_id, fields, queued_at) VALUES (?, ?, ?)',
      [row.id, JSON.stringify(merged), now]
    );
  }
}

/** Die Feldliste eines Eintrags; ein kaputter Text ist kein Grund zum Absturz. */
function parseFields(value: string | null): (keyof DocumentPatch)[] {
  if (value === null) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is keyof DocumentPatch =>
        typeof entry === 'string' && PUSHABLE.includes(entry as keyof DocumentPatch)
    );
  } catch {
    return [];
  }
}

export async function readOutbox(): Promise<OutboxEntry[]> {
  const db = await database();
  const rows = await db.getAllAsync<OutboxRow>(
    `SELECT d.*, o.fields AS outbox_fields, o.queued_at AS outbox_queued_at,
            f.remote_id AS folder_remote_id
       FROM outbox o
       JOIN documents d ON d.id = o.document_id
       LEFT JOIN folders f ON f.name = d.folder_name
      ORDER BY o.queued_at ASC`
  );

  return rows.map((row) => ({
    documentId: row.id,
    fields: parseFields(row.outbox_fields),
    queuedAt: row.outbox_queued_at,
    document: toDocument(row),
    folderRemoteId: row.folder_remote_id,
  }));
}

/**
 * Erledigte Eintraege entfernen — aber nur, wenn seither nichts Neues dazukam.
 *
 * `queued_at` ist dabei der Ausweis des Standes: hat der Nutzer waehrend des
 * Hochschickens noch einmal gewischt, steht dort ein neuerer Wert, und der
 * Eintrag bleibt fuer den naechsten Lauf stehen. Ohne diese Bedingung ginge
 * genau die Aenderung verloren, die im ungluecklichsten Moment kam.
 */
export async function clearOutbox(
  entries: { documentId: string; queuedAt: number }[]
): Promise<void> {
  if (entries.length === 0) return;
  const db = await database();
  await db.withTransactionAsync(async () => {
    for (const entry of entries) {
      await db.runAsync('DELETE FROM outbox WHERE document_id = ? AND queued_at = ?', [
        entry.documentId,
        entry.queuedAt,
      ]);
    }
  });
}

/** Wie viele Aenderungen noch offen sind — die Grundlage von `pending`. */
export async function countOutbox(): Promise<number> {
  const db = await database();
  const rows = await db.getAllAsync<{ count: number }>('SELECT COUNT(*) AS count FROM outbox');
  return rows[0]?.count ?? 0;
}


/**
 * Was der Abgleich sich merkt. Zwei Schluessel, beide in `sync_state`:
 *
 *   last_pulled_at  Wasserzeichen des letzten Abrufs, ein SERVER-Zeitstempel
 *                   als ISO-Text. Nie die Geraetezeit — sie geht vor oder nach,
 *                   und beides laesst Zeilen verschwinden.
 *   reset_done      Ob der einmalige Schnitt vom Beispiel-Bestand auf den
 *                   echten schon gelaufen ist.
 */
export type SyncStateKey = 'last_pulled_at' | 'reset_done';

export async function readSyncState(key: SyncStateKey): Promise<string | null> {
  const db = await database();
  const rows = await db.getAllAsync<{ value: string }>(
    'SELECT value FROM sync_state WHERE key = ?',
    [key]
  );
  return rows[0]?.value ?? null;
}

export async function writeSyncState(key: SyncStateKey, value: string): Promise<void> {
  const db = await database();
  await db.runAsync('INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)', [key, value]);
}

/**
 * Der einmalige Schnitt: alles Lokale weg, damit der erste Abgleich auf einer
 * leeren Flaeche aufsetzt.
 *
 * Betroffen sind Dokumente und Ordner — nicht `settings`: Darstellung,
 * Sortierung und Textgroesse gehoeren dem Geraet, nicht dem Bestand, und sie
 * beim Umstieg zurueckzusetzen waere ein Verlust ohne Gegenwert.
 */
export async function clearLibrary(): Promise<void> {
  const db = await database();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM documents');
    await db.runAsync('DELETE FROM folders');
  });
}

/** Eine Ordnerzeile, wie sie oben steht. */
export interface RemoteFolder {
  remoteId: string;
  name: string;
  color: string;
  deleted: boolean;
}

/** Eine Dokumentzeile von oben, schon in die Begriffe der App uebersetzt. */
export interface RemoteDocument {
  id: string;
  title: string;
  docType: DocType;
  /** Ausweis des Ordners oben; die Zuordnung auf den Namen passiert hier. */
  folderRemoteId: string | null;
  favorite: boolean;
  keepOffline: boolean;
  sizeBytes: number;
  updatedAt: number;
  importedAt: number;
  openCount: number;
  lastOpenedAt: number | null;
  note: string;
  trashedAt: number | null;
  source: StoredDocument['source'];
  storagePath: string | null;
  contentHash: string | null;
  readAt: number | null;
  archivedAt: number | null;
}

export interface RemoteSnapshot {
  folders: RemoteFolder[];
  documents: RemoteDocument[];
}

/**
 * Den Abruf in die lokale Datenbank schreiben.
 *
 * Alles in einer Transaktion: ein halb geschriebener Abruf waere eine
 * Bibliothek, in der Dokumente in Ordnern stehen, die es noch nicht gibt.
 *
 * Was hier bewusst NICHT vom Server kommt: `cached` und `cache_key`. Beide
 * beschreiben dieses Geraet — welche Datei hier liegt, weiss der Server nicht
 * und soll es nicht bestimmen. Ein Abruf, der `cached` ueberschreibt, wuerde
 * eine vorhandene Datei fuer nicht vorhanden erklaeren.
 *
 * Und: eine Zeile mit offenem Outbox-Eintrag behaelt ihre Nutzerfelder. Der
 * lokale Stand ist dort der juengere — er wartet nur darauf, hochgeschickt zu
 * werden (siehe `mine` unten).
 */
/**
 * Ein Zuweisungsausdruck fuer `ON CONFLICT DO UPDATE`, der den lokalen Wert
 * behaelt, solange fuer diese Zeile ein Outbox-Eintrag offen ist.
 *
 * Als Funktion und nicht zehnmal ausgeschrieben, damit die Regel an genau
 * einer Stelle steht — eine Spalte, die man beim Abschreiben vergisst, waere
 * eine, die der Abruf still zuruecksetzt.
 */
function mine(column: string): string {
  return (
    `CASE WHEN EXISTS (SELECT 1 FROM outbox o WHERE o.document_id = documents.id) ` +
    `THEN documents.${column} ELSE excluded.${column} END`
  );
}

export async function applyRemote(snapshot: RemoteSnapshot): Promise<void> {
  const db = await database();

  await db.withTransactionAsync(async () => {
    for (const folder of snapshot.folders) {
      if (folder.deleted) {
        // Dieselbe Regel wie beim Loeschen von Hand: die Dokumente bleiben und
        // landen in "Nicht einsortiert". Ein Ordner ist eine Ablage, kein
        // Behaelter.
        await db.runAsync(
          `UPDATE documents SET folder_name = NULL
           WHERE folder_name = (SELECT name FROM folders WHERE remote_id = ?)`,
          [folder.remoteId]
        );
        await db.runAsync('DELETE FROM folders WHERE remote_id = ?', [folder.remoteId]);
        continue;
      }

      // Umbenannt: lokal IST der Name der Ausweis, deshalb muessen die
      // Dokumente mitziehen — dieselbe Ueberlegung wie in `renameFolder`.
      const previous = await db.getAllAsync<{ name: string }>(
        'SELECT name FROM folders WHERE remote_id = ?',
        [folder.remoteId]
      );
      const before = previous[0]?.name;
      if (before !== undefined && before !== folder.name) {
        await db.runAsync('DELETE FROM folders WHERE name = ?', [before]);
        await db.runAsync('UPDATE documents SET folder_name = ? WHERE folder_name = ?', [
          folder.name,
          before,
        ]);
      }

      await db.runAsync(
        `INSERT INTO folders (name, color, keep_offline, remote_id) VALUES (?, ?, 0, ?)
         ON CONFLICT(name) DO UPDATE SET color = excluded.color, remote_id = excluded.remote_id`,
        [folder.name, folder.color, folder.remoteId]
      );
    }

    for (const document of snapshot.documents) {
      const rows =
        document.folderRemoteId === null
          ? []
          : await db.getAllAsync<{ name: string }>('SELECT name FROM folders WHERE remote_id = ?', [
              document.folderRemoteId,
            ]);
      const folderName = rows[0]?.name ?? null;

      await db.runAsync(
        `INSERT INTO documents
           (id, title, doc_type, folder_name, favorite, cached, size_bytes, updated_at,
            imported_at, open_count, last_opened_at, note, keep_offline, trashed_at,
            source, cache_key, storage_path, content_hash, read_at, archived_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           -- Die Nutzerfelder nur, solange kein Eintrag in der Outbox offen
           -- ist: sonst naehme der Abruf zurueck, was gerade offline gewischt
           -- wurde, und der naechste Push schriebe den alten Wert wieder hoch.
           title = ${mine('title')},
           folder_name = ${mine('folder_name')},
           favorite = ${mine('favorite')},
           note = ${mine('note')},
           keep_offline = ${mine('keep_offline')},
           trashed_at = ${mine('trashed_at')},
           open_count = ${mine('open_count')},
           last_opened_at = ${mine('last_opened_at')},
           read_at = ${mine('read_at')},
           archived_at = ${mine('archived_at')},
           -- Technische Felder kommen immer vom Server: sie beschreiben die
           -- Datei oben, nicht die Ablage hier. Bliebe der Dateicache auf
           -- einem veralteten Hash stehen, holte der Viewer nie neu.
           doc_type = excluded.doc_type,
           size_bytes = excluded.size_bytes,
           updated_at = excluded.updated_at,
           source = excluded.source,
           storage_path = excluded.storage_path,
           content_hash = excluded.content_hash,
           -- Ein anderer Hash heisst: der Inhalt oben ist ein anderer als der,
           -- der hier liegt. Die Datei bleibt vorerst im Cache, gilt aber als
           -- veraltet — der Viewer holt sie beim naechsten Oeffnen neu.
           -- "IS NOT" statt "<>", weil NULL sonst jeden Vergleich verschluckt.
           cached = CASE
             WHEN documents.content_hash IS NOT excluded.content_hash THEN 0
             ELSE documents.cached
           END`,
        [
          document.id,
          document.title,
          document.docType,
          folderName,
          document.favorite ? 1 : 0,
          document.sizeBytes,
          document.updatedAt,
          document.importedAt,
          document.openCount,
          document.lastOpenedAt,
          document.note,
          document.keepOffline ? 1 : 0,
          document.trashedAt,
          document.source,
          document.storagePath,
          document.contentHash,
          document.readAt,
          document.archivedAt,
        ]
      );
    }
  });
}
