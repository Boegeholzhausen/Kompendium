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
import * as Crypto from 'expo-crypto';
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
  /**
   * Leseposition je Dokument. Sie steht seit Schema 7 in der Dokumentzeile,
   * bleibt aber aus dem `StoredDocument` heraus: kein Screen zeigt sie, nur
   * der Viewer stellt sie wieder her. Als Feld an jedem Dokument muesste sie
   * durch jede Liste, jeden Filter und die ganze Erstbefuellung mitgeschleppt
   * werden, ohne dass sie dort je jemand liest.
   */
  scrollPositions: Record<string, number>;
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
  /** Leseposition in dp vom Seitenanfang. */
  scrollOffset?: number;
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
  scroll_offset: number;
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
  scrollOffset: 'scroll_offset',
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

  const scrollPositions: Record<string, number> = {};
  for (const row of documentRows) {
    if (row.scroll_offset > 0) scrollPositions[row.id] = row.scroll_offset;
  }

  return {
    documents: documentRows.map(toDocument),
    folders: folderRows.map((row) => ({
      name: row.name,
      color: row.color,
      keepOffline: row.keep_offline === 1,
    })),
    settings: Object.fromEntries(settingRows.map((row) => [row.key, row.value])),
    scrollPositions,
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

/**
 * Ordner anlegen oder aendern.
 *
 * Bewusst KEIN `INSERT OR REPLACE`: das ersetzt die ganze Zeile und setzt
 * dabei `remote_id` auf NULL zurueck, weil der Aufrufer den Ausweis oben gar
 * nicht kennt. Danach waere der Ordner oben nicht mehr auffindbar, jeder Push
 * legte eine zweite Zeile an, und die Dokument-Eintraege in der Outbox haetten
 * wieder keinen Ordner, auf den sie zeigen koennten — genau der Grund, aus dem
 * der Sync-Status auf "Änderungen offen" stehen blieb. `ON CONFLICT` fasst nur
 * die beiden Spalten an, die der Nutzer bearbeitet.
 */
export async function upsertFolder(folder: LibraryFolder): Promise<void> {
  const db = await database();
  await db.runAsync(
    `INSERT INTO folders (name, color, keep_offline) VALUES (?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET
       color = excluded.color,
       keep_offline = excluded.keep_offline`,
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
    // Der Grabstein muss VOR dem Loeschen geschrieben werden — danach gibt es
    // die Zeile nicht mehr, aus der sich das `remote_id` lesen liesse. Ordner,
    // die nie oben waren, hinterlassen keinen: dort gibt es nichts zu loeschen.
    await db.runAsync(
      `INSERT OR REPLACE INTO folder_deletions (remote_id, queued_at)
       SELECT remote_id, ? FROM folders WHERE name = ? AND remote_id IS NOT NULL`,
      [Date.now(), name]
    );
    await db.runAsync('DELETE FROM folders WHERE name = ?', [name]);
  });
}

/**
 * Der `settings`-Schluessel, unter dem die Lesepositionen liegen — ein
 * JSON-Objekt `{ dokumentId: offset }` (siehe `state/viewer.ts`).
 *
 * Er steht hier und nicht dort, weil die ID-Wanderung ihn mitziehen muss: die
 * Positionen sind nach der Dokumentkennung geschluesselt, und eine neue Kennung
 * ohne diesen Schritt hiesse, dass jedes gewanderte Dokument wieder oben
 * anfaengt. Wuerde das Repository ihn aus `state/viewer.ts` holen, entstuende
 * ein Modulzyklus — dort wird bereits `setSetting` von hier importiert.
 */
export const SETTING_SCROLL_POSITIONS = 'viewer.scrollPositions';

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
  // Die Leseposition gehoert zum Dokument und geht deshalb denselben Weg wie
  // "gelesen". Sie erreicht die Outbox nur gedrosselt — `state/viewer.ts`
  // schreibt beim Verlassen des Viewers und beim Wechsel in den Hintergrund,
  // nicht bei jedem Scrollschritt. Sonst stuende die Outbox beim Lesen eines
  // langen Dokuments dauernd voll und der Status sprunge hin und her.
  'scrollOffset',
];

/** Ein offener Eintrag, mit allem, was `pushChanges` daraus bauen muss. */
export interface OutboxEntry {
  documentId: string;
  fields: (keyof DocumentPatch)[];
  queuedAt: number;
  document: StoredDocument;
  /** Ausweis des Ordners oben; `null`, wenn der Ordner nur lokal existiert. */
  folderRemoteId: string | null;
  /**
   * Leseposition. Sie steht neben dem Dokument und nicht darin, aus demselben
   * Grund wie in `Snapshot`: kein Screen zeigt sie.
   */
  scrollOffset: number;
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
    scrollOffset: row.scroll_offset,
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

// ── Ordner: der Weg nach oben ───────────────────────────────────────────────

/**
 * Warum die Ordner KEINE Outbox haben.
 *
 * Bei einer Handvoll Ordner ist der direkte Vergleich mit oben der einfachere
 * richtige Weg: `readFoldersForPush` liefert den ganzen Bestand, der Push
 * gleicht ab. Eine zweite Outbox waere Buchhaltung ueber eine Menge, die man
 * ohnehin in einem Zug lesen kann — und sie muesste dieselbe Regel noch einmal
 * abbilden, die hier schon gilt: der Name ist der Ausweis (siehe Kopf von
 * `schema.ts`).
 *
 * Genau ein Fall entzieht sich dem Vergleich, das Loeschen — dafuer gibt es
 * `folder_deletions`.
 */
export interface FolderForPush {
  name: string;
  /** Hex-Wert wie im Zustand; die Uebersetzung in den Token-Namen macht der Push. */
  color: string;
  keepOffline: boolean;
  /** Ausweis derselben Zeile oben; `null`, wenn der Ordner nur lokal existiert. */
  remoteId: string | null;
}

export async function readFoldersForPush(): Promise<FolderForPush[]> {
  const db = await database();
  const rows = await db.getAllAsync<{
    name: string;
    color: string;
    keep_offline: number;
    remote_id: string | null;
  }>('SELECT name, color, keep_offline, remote_id FROM folders ORDER BY name ASC');

  return rows.map((row) => ({
    name: row.name,
    color: row.color,
    keepOffline: row.keep_offline === 1,
    remoteId: row.remote_id,
  }));
}

/**
 * Den Ausweis von oben an der lokalen Zeile festhalten.
 *
 * Ohne diesen Schritt legte der naechste Push denselben Ordner ein zweites Mal
 * an, und die Dokument-Eintraege in der Outbox faenden weiterhin kein
 * `folder_id`.
 */
export async function setFolderRemoteId(name: string, remoteId: string): Promise<void> {
  const db = await database();
  await db.runAsync('UPDATE folders SET remote_id = ? WHERE name = ?', [remoteId, name]);
}

/** Die Grabsteine, die der naechste Push oben auf `deleted_at` setzen muss. */
export async function readFolderDeletions(): Promise<string[]> {
  const db = await database();
  const rows = await db.getAllAsync<{ remote_id: string }>(
    'SELECT remote_id FROM folder_deletions ORDER BY queued_at ASC'
  );
  return rows.map((row) => row.remote_id);
}

/** Erledigte Grabsteine wegraeumen — nur die, die oben wirklich durchkamen. */
export async function clearFolderDeletions(remoteIds: string[]): Promise<void> {
  if (remoteIds.length === 0) return;
  const db = await database();
  const placeholders = remoteIds.map(() => '?').join(', ');
  await db.runAsync(
    `DELETE FROM folder_deletions WHERE remote_id IN (${placeholders})`,
    remoteIds
  );
}


/**
 * Was der Abgleich sich merkt. Zwei Schluessel, beide in `sync_state`:
 *
 *   last_pulled_at  Wasserzeichen des letzten Abrufs, ein SERVER-Zeitstempel
 *                   als ISO-Text. Nie die Geraetezeit — sie geht vor oder nach,
 *                   und beides laesst Zeilen verschwinden.
 *   reset_done      Ob der einmalige Schnitt vom Beispiel-Bestand auf den
 *                   echten schon gelaufen ist.
 *   uuid_ids_done   Ob die einmalige Wanderung der lokalen Import-Kennungen
 *                   auf UUIDs gelaufen ist (`migrateLocalIdsToUuid`).
 *   scroll_moved    Ob die Lesepositionen einmalig aus `settings` in die
 *                   Dokumentzeile gewandert sind (`adoptScrollPositions`).
 *   settings_pushed Die Voreinstellungen, wie sie zuletzt oben ankamen — als
 *                   JSON. Ohne diesen Vergleich schoebe jedes Geraet bei jedem
 *                   Abgleich seinen alten Stand ueber den neuen des anderen.
 *   owner_id        Unter welcher Identitaet der letzte Abruf lief. Aendert sie
 *                   sich (Anmeldung mit E-Mail, Abmelden), sind Wasserzeichen
 *                   und Ordner-Ausweise Aussagen ueber ein fremdes Konto.
 */
export type SyncStateKey =
  | 'last_pulled_at'
  | 'reset_done'
  | 'uuid_ids_done'
  | 'scroll_moved'
  | 'settings_pushed'
  | 'owner_id';

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

// ── Dokumente vom Handy nach oben ───────────────────────────────────────────

/** Sieht eine Kennung nach einer UUID aus? */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Die einmalige Wanderung der lokalen Import-Kennungen auf UUIDs.
 *
 * Frueher hiessen sie `doc-import-mf3x…`; oben ist `public.documents.id` eine
 * `uuid`. Solche Zeilen konnten deshalb prinzipiell nie hochgehen — sie
 * existierten ausschliesslich auf diesem Geraet, still und ohne Hinweis in der
 * Oberflaeche.
 *
 * Warum das keine Migration in `schema.ts` ist: dort steht ausschliesslich SQL,
 * und hier muss je Zeile eine neue Kennung erzeugt und an drei weiteren
 * Stellen nachgezogen werden. Abgesichert ist der Lauf ueber `sync_state`
 * (`uuid_ids_done`) und nicht ueber `user_version`: ein zweiter Lauf waere
 * harmlos, aber die Absicht "genau einmal" gehoert dorthin, wo sie nachlesbar
 * ist.
 *
 * `cache_key` bleibt bewusst unveraendert: die Datei im Cache wird nicht
 * umbenannt. Wo sie liegt, ist eine Frage dieses Geraets — und ein
 * Dateisystemlauf ueber Hunderte Dokumente waere ein Risiko ohne Gegenwert.
 *
 * Der Suchindex braucht nichts: er liegt im Arbeitsspeicher und wird nach
 * diesem Lauf erst gefuellt (`warmSearchIndex` in `state/hydrate.ts`).
 *
 * Rueckgabe ist die Zahl gewanderter Zeilen — fuer das Protokoll, nicht fuer
 * die Oberflaeche.
 */
export async function migrateLocalIdsToUuid(): Promise<number> {
  if ((await readSyncState('uuid_ids_done')) !== null) return 0;

  const db = await database();
  // Nur Zeilen, die nie oben waren. Alles mit `storage_path` traegt bereits
  // die Kennung, unter der es dort steht — die darf sich nie aendern.
  const rows = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM documents WHERE storage_path IS NULL'
  );
  const stale = rows.filter((row) => !UUID.test(row.id));

  for (const row of stale) {
    const next = Crypto.randomUUID();
    await db.withTransactionAsync(async () => {
      // `PRAGMA foreign_keys` steht auf ON, und `outbox.document_id` zeigt auf
      // `documents(id)` — beim Umschreiben der Elternzeile haenge der Eintrag
      // sonst in der Luft. Er wird deshalb gemerkt, entfernt und unter der
      // neuen Kennung wieder eingetragen; `queued_at` bleibt stehen, damit
      // `clearOutbox` ihn spaeter wiedererkennt.
      const open = await db.getAllAsync<{ fields: string; queued_at: number }>(
        'SELECT fields, queued_at FROM outbox WHERE document_id = ?',
        [row.id]
      );
      await db.runAsync('DELETE FROM outbox WHERE document_id = ?', [row.id]);
      await db.runAsync('UPDATE documents SET id = ? WHERE id = ?', [next, row.id]);

      const entry = open[0];
      if (entry !== undefined) {
        await db.runAsync(
          'INSERT INTO outbox (document_id, fields, queued_at) VALUES (?, ?, ?)',
          [next, entry.fields, entry.queued_at]
        );
      }

      await moveScrollPosition(db, row.id, next);
    });
  }

  await writeSyncState('uuid_ids_done', new Date().toISOString());
  return stale.length;
}

/**
 * Die Leseposition auf die neue Kennung umhaengen.
 *
 * Ohne diesen Schritt faenge jedes gewanderte Dokument wieder oben an — die
 * Positionen liegen als ein JSON-Objekt in `settings`, geschluesselt nach der
 * Dokumentkennung (siehe `state/viewer.ts`).
 */
async function moveScrollPosition(
  db: SQLiteDatabase,
  from: string,
  to: string
): Promise<void> {
  const rows = await db.getAllAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [SETTING_SCROLL_POSITIONS]
  );
  const raw = rows[0]?.value;
  if (raw === undefined) return;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return;
    const positions = parsed as Record<string, unknown>;
    if (!(from in positions)) return;

    positions[to] = positions[from];
    delete positions[from];
    await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [
      SETTING_SCROLL_POSITIONS,
      JSON.stringify(positions),
    ]);
  } catch {
    // Kaputtes JSON ist kein Grund, die Wanderung abzubrechen: dann faengt das
    // Dokument eben wieder oben an. `state/viewer.ts` verwirft es ohnehin.
  }
}

/**
 * Die einmalige Uebernahme der Lesepositionen aus `settings` in die
 * Dokumentzeile.
 *
 * Bis Schema 6 lagen sie als ein JSON-Objekt unter einem `settings`-Schluessel
 * — ein Wert ueber ein Dokument, der nicht am Dokument hing und deshalb auch
 * nie mit ihm nach oben ging. Nach dem Umzug ist das eine Spalte wie jede
 * andere und laeuft ueber die vorhandene Outbox mit.
 *
 * Bewusst OHNE Outbox-Eintrag: das waere ein Schwung Eintraege fuer Positionen,
 * die der Nutzer nie neu gesetzt hat. Sie gehen mit, sobald das Dokument das
 * naechste Mal gelesen wird.
 *
 * Laeuft nach `migrateLocalIdsToUuid`: die Kennungen im JSON-Objekt muessen
 * schon die neuen sein, sonst trifft das UPDATE keine Zeile.
 */
export async function adoptScrollPositions(): Promise<number> {
  if ((await readSyncState('scroll_moved')) !== null) return 0;

  const db = await database();
  const rows = await db.getAllAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [SETTING_SCROLL_POSITIONS]
  );

  let moved = 0;
  const raw = rows[0]?.value;
  if (raw !== undefined) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed !== null && typeof parsed === 'object') {
        const entries = Object.entries(parsed as Record<string, unknown>).filter(
          (entry): entry is [string, number] =>
            typeof entry[1] === 'number' && Number.isFinite(entry[1])
        );
        await db.withTransactionAsync(async () => {
          for (const [id, offset] of entries) {
            await db.runAsync('UPDATE documents SET scroll_offset = ? WHERE id = ?', [
              Math.max(0, Math.round(offset)),
              id,
            ]);
          }
          // Der alte Eintrag geht im selben Zug: zwei Wahrheiten ueber dieselbe
          // Stelle waeren schlimmer als keine.
          await db.runAsync('DELETE FROM settings WHERE key = ?', [SETTING_SCROLL_POSITIONS]);
        });
        moved = entries.length;
      }
    } catch {
      // Kaputtes JSON ist kein Grund, den Start abzubrechen — dann faengt jedes
      // Dokument eben wieder oben an.
    }
  }

  await writeSyncState('scroll_moved', new Date().toISOString());
  return moved;
}

// ── Voreinstellungen: der Weg in beide Richtungen ───────────────────────────

/**
 * Welche `settings`-Schluessel zum KONTO gehoeren und nicht zum Geraet.
 *
 * Textgroesse, Abdunkeln, Bildschirm anlassen, Darstellung und Sortierung
 * beschreiben, wie der Nutzer lesen will — das gilt auf jedem seiner Geraete.
 *
 * Ausdruecklich NICHT dabei:
 *
 *   search.recentQueries    was hier zuletzt gesucht wurde, ist ein Verlauf
 *                           dieses Geraets und keine Voreinstellung
 *   viewer.scrollPositions  gibt es seit Schema 7 nicht mehr — die Position
 *                           steht in der Dokumentzeile
 */
export const SYNCED_SETTING_KEYS = [
  'appearance.viewerTextScale',
  'appearance.dimDocuments',
  'appearance.keepScreenOn',
  'library.viewMode',
  'library.sort',
];

export async function readSettings(keys: string[]): Promise<Record<string, string>> {
  if (keys.length === 0) return {};
  const db = await database();
  const placeholders = keys.map(() => '?').join(', ');
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    `SELECT key, value FROM settings WHERE key IN (${placeholders})`,
    keys
  );
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

/** Mehrere Voreinstellungen in einem Zug — der Abruf bringt sie gebuendelt. */
export async function writeSettings(entries: Record<string, string>): Promise<void> {
  const keys = Object.keys(entries);
  if (keys.length === 0) return;
  const db = await database();
  await db.withTransactionAsync(async () => {
    for (const key of keys) {
      await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [
        key,
        entries[key],
      ]);
    }
  });
}

/**
 * Was noch nie oben war und hochgeladen werden kann.
 *
 * Vier Bedingungen, jede aus einem eigenen Grund:
 *
 *   storage_path IS NULL   war noch nie oben — alles andere ist dort bekannt
 *   trashed_at IS NULL     der Papierkorb ist kein Bestand; was der Nutzer
 *                          weggeworfen hat, gehoert nicht hochgeladen
 *   cache_key IS NOT NULL  ohne Datei gaebe es nichts hochzuladen
 *   source != 'sample'     der Beispiel-Bestand ist Erstbefuellung und kein
 *                          Bestand (CLAUDE.md); oben laesst die CHECK-Bedingung
 *                          `sample` ohnehin nicht zu
 */
export interface UploadableDocument {
  document: StoredDocument;
  /** Ausweis des Ordners oben; `null`, wenn ohne Ordner oder nur lokal bekannt. */
  folderRemoteId: string | null;
  /** Leseposition — siehe `OutboxEntry`. */
  scrollOffset: number;
}

interface UploadableRow extends DocumentRow {
  folder_remote_id: string | null;
}

export async function readUploadable(): Promise<UploadableDocument[]> {
  const db = await database();
  const rows = await db.getAllAsync<UploadableRow>(
    `SELECT d.*, f.remote_id AS folder_remote_id
       FROM documents d LEFT JOIN folders f ON f.name = d.folder_name
      WHERE d.storage_path IS NULL
        AND d.trashed_at IS NULL
        AND d.cache_key IS NOT NULL
        AND d.source <> 'sample'
      ORDER BY d.imported_at ASC`
  );

  return rows.map((row) => ({
    document: toDocument(row),
    folderRemoteId: row.folder_remote_id,
    scrollOffset: row.scroll_offset,
  }));
}

/**
 * Nach dem Hochladen: die Zeile weiss jetzt, wo ihre Datei oben liegt.
 *
 * Bewusst OHNE Outbox-Eintrag (deshalb nicht ueber `updateDocuments`): beide
 * Spalten beschreiben die Datei oben und kommen von dort — sie zurueck nach
 * oben zu schicken waere ein Echo. Und `content_hash` muss stehen, sonst
 * erklaert der naechste Abruf die gerade hochgeladene Datei fuer veraltet
 * (`applyRemote` vergleicht die Pruefsummen).
 *
 * Ab hier laeuft die Zeile den normalen Outbox-Weg wie jedes PC-Dokument:
 * `queueForPush` nimmt sie auf, weil `storage_path` nicht mehr NULL ist.
 */
export async function markUploaded(
  id: string,
  storagePath: string,
  contentHash: string
): Promise<void> {
  const db = await database();
  await db.runAsync('UPDATE documents SET storage_path = ?, content_hash = ? WHERE id = ?', [
    storagePath,
    contentHash,
    id,
  ]);
}

/**
 * Festhalten, unter welcher Identitaet abgeglichen wird — und aufraeumen, wenn
 * es eine andere ist als beim letzten Mal.
 *
 * Was nach einem Identitaetswechsel nicht mehr gilt:
 *
 * `folders.remote_id` zeigt auf Zeilen eines anderen Kontos. RLS laesst ein
 * `update` darauf nicht scheitern — es trifft schlicht keine Zeile und meldet
 * Erfolg. Der Ordner ginge damit nie oben an, und niemand erfuehre es. Ohne
 * Ausweis sucht `pushFolders` wieder ueber den Namen und legt an, was fehlt.
 *
 * Die Grabsteine gehen aus demselben Grund: eine Loeschung im alten Konto
 * nachzuholen waere ein Eingriff in fremde Daten. Und `settings_pushed` gilt
 * nicht mehr: was das alte Konto zuletzt bekam, sagt nichts ueber das neue.
 *
 * Der Bestand selbst bleibt unangetastet — die lokale Datenbank ist die
 * Wahrheitsquelle, und ein Kontowechsel ist kein Grund, Dokumente zu
 * verlieren. Was frueher schon oben lag, bleibt dort allerdings liegen: seine
 * Zeile gehoert dem alten Konto, und der neue Bestand kennt sie nicht.
 *
 * Rueckgabe: ob wirklich gewechselt wurde. Beim allerersten Lauf steht noch
 * gar keine Identitaet fest — das ist kein Wechsel und raeumt nichts auf.
 */
export async function noteOwner(userId: string): Promise<boolean> {
  const previous = await readSyncState('owner_id');
  if (previous === userId) return false;

  const db = await database();
  if (previous !== null) {
    await db.withTransactionAsync(async () => {
      await db.runAsync('UPDATE folders SET remote_id = NULL');
      await db.runAsync('DELETE FROM folder_deletions');
      await db.runAsync('DELETE FROM sync_state WHERE key IN (?, ?)', [
        'last_pulled_at',
        // Was das alte Konto zuletzt bekam, sagt nichts darueber, was das neue
        // schon hat — sonst schickte der naechste Push die Voreinstellungen gar
        // nicht erst hoch.
        'settings_pushed',
      ]);
    });
  }
  await writeSyncState('owner_id', userId);
  return previous !== null;
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
  keepOffline: boolean;
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
  scrollOffset: number;
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

      // `keep_offline` kommt seit dem Ordner-Push von oben mit: es ist eine
      // Entscheidung des Nutzers ueber den Ordner, keine Eigenschaft dieses
      // Geraets. Hart eine 0 einzusetzen hiesse, sie auf jedem weiteren Geraet
      // stillschweigend zurueckzunehmen.
      await db.runAsync(
        `INSERT INTO folders (name, color, keep_offline, remote_id) VALUES (?, ?, ?, ?)
         ON CONFLICT(name) DO UPDATE SET
           color = excluded.color,
           keep_offline = excluded.keep_offline,
           remote_id = excluded.remote_id`,
        [folder.name, folder.color, folder.keepOffline ? 1 : 0, folder.remoteId]
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
            source, cache_key, storage_path, content_hash, read_at, archived_at,
            scroll_offset)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)
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
           scroll_offset = ${mine('scroll_offset')},
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
          document.scrollOffset,
        ]
      );
    }
  });
}
