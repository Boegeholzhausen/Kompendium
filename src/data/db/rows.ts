/**
 * Die Gestalt einer Dokumentzeile — Typen und Zuordnungen, kein SQL.
 *
 * Herausgeloest aus `repository.ts`, das auf ueber 1300 Zeilen angewachsen
 * war. Hier steht ausschliesslich, WIE eine Zeile aussieht und wie sie in die
 * Begriffe der App uebersetzt wird; WAS mit ihr geschieht, steht in `repos/`.
 * Das Modul haengt an nichts ausser Typen — es ist das Blatt, auf das alle
 * anderen zeigen duerfen.
 */
import type { LibraryFolder, StoredDocument } from '../library';
import type { DocType } from '../../theme/tile';

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

export interface DocumentRow {
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
export const columns: Record<keyof DocumentPatch, string> = {
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

export function toDocument(row: DocumentRow): StoredDocument {
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
