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
import { libraryTags } from '../sampleLibrary';
import type { LibraryFolder, LibraryTag, StoredDocument } from '../library';
import type { DocType } from '../../theme/tile';
import { createSchemaSql, DATABASE_NAME, SCHEMA_VERSION } from './schema';

export interface Snapshot {
  documents: StoredDocument[];
  folders: LibraryFolder[];
  tags: LibraryTag[];
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
  trashedAt?: number | null;
  updatedAt?: number;
  sizeBytes?: number;
  cacheKey?: string | null;
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
  note: string;
  keep_offline: number;
  trashed_at: number | null;
  source: string;
  cache_key: string | null;
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
  trashedAt: 'trashed_at',
  updatedAt: 'updated_at',
  sizeBytes: 'size_bytes',
  cacheKey: 'cache_key',
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
      await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
      await seedIfEmpty(db);
      return db;
    })();
  }
  return handle;
}

async function seedIfEmpty(db: SQLiteDatabase): Promise<void> {
  const rows = await db.getAllAsync<{ count: number }>('SELECT COUNT(*) AS count FROM documents');
  if ((rows[0]?.count ?? 0) > 0) return;

  await db.withTransactionAsync(async () => {
    for (const tag of libraryTags) {
      await db.runAsync('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)', [
        tag.id,
        tag.name,
        tag.color,
      ]);
    }
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
        updated_at, imported_at, open_count, note, keep_offline, trashed_at,
        source, cache_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      document.note,
      document.keepOffline ? 1 : 0,
      document.trashedAt,
      document.source,
      document.cacheKey,
    ]
  );

  await db.runAsync('DELETE FROM document_tags WHERE document_id = ?', [document.id]);
  for (const tagId of document.tagIds) {
    await db.runAsync('INSERT OR IGNORE INTO document_tags (document_id, tag_id) VALUES (?, ?)', [
      document.id,
      tagId,
    ]);
  }
}

function toDocument(row: DocumentRow, tagIds: string[]): StoredDocument {
  return {
    id: row.id,
    title: row.title,
    docType: row.doc_type as DocType,
    folderName: row.folder_name,
    tagIds,
    favorite: row.favorite === 1,
    cached: row.cached === 1,
    sizeBytes: row.size_bytes,
    updatedAt: row.updated_at,
    importedAt: row.imported_at,
    openCount: row.open_count,
    note: row.note,
    keepOffline: row.keep_offline === 1,
    trashedAt: row.trashed_at,
    source: row.source as StoredDocument['source'],
    cacheKey: row.cache_key,
  };
}

export async function loadSnapshot(): Promise<Snapshot> {
  const db = await database();

  const [documentRows, pairs, tagRows, folderRows, settingRows] = await Promise.all([
    db.getAllAsync<DocumentRow>('SELECT * FROM documents'),
    db.getAllAsync<{ document_id: string; tag_id: string }>('SELECT * FROM document_tags'),
    db.getAllAsync<{ id: string; name: string; color: string }>('SELECT * FROM tags'),
    db.getAllAsync<{ name: string; color: string; keep_offline: number }>('SELECT * FROM folders'),
    db.getAllAsync<{ key: string; value: string }>('SELECT * FROM settings'),
  ]);

  const tagsByDocument = new Map<string, string[]>();
  for (const pair of pairs) {
    const list = tagsByDocument.get(pair.document_id);
    if (list) list.push(pair.tag_id);
    else tagsByDocument.set(pair.document_id, [pair.tag_id]);
  }

  return {
    documents: documentRows.map((row) => toDocument(row, tagsByDocument.get(row.id) ?? [])),
    folders: folderRows.map((row) => ({
      name: row.name,
      color: row.color,
      keepOffline: row.keep_offline === 1,
    })),
    tags: tagRows,
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

  await db.runAsync(`UPDATE documents SET ${assignments} WHERE id IN (${placeholders})`, [
    ...values,
    ...ids,
  ]);
}

export async function setDocumentTags(documentId: string, tagIds: string[]): Promise<void> {
  const db = await database();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM document_tags WHERE document_id = ?', [documentId]);
    for (const tagId of tagIds) {
      await db.runAsync('INSERT OR IGNORE INTO document_tags (document_id, tag_id) VALUES (?, ?)', [
        documentId,
        tagId,
      ]);
    }
  });
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

export async function upsertTag(tag: LibraryTag): Promise<void> {
  const db = await database();
  await db.runAsync('INSERT OR REPLACE INTO tags (id, name, color) VALUES (?, ?, ?)', [
    tag.id,
    tag.name,
    tag.color,
  ]);
}

/** Die Zuordnungen gehen ueber `ON DELETE CASCADE` von selbst mit. */
export async function deleteTag(tagId: string): Promise<void> {
  const db = await database();
  await db.runAsync('DELETE FROM tags WHERE id = ?', [tagId]);
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await database();
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
}
