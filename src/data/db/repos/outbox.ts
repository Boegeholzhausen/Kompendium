/**
 * Die Outbox — welche FELDER lokal geaendert wurden und noch nach oben muessen.
 *
 * Nicht die Werte: die stehen in `documents` und sind dort immer der neueste
 * Stand. Dazu die Gegenrichtung fuer Dokumente, die es oben noch gar nicht
 * gibt (`readUploadable`, `markUploaded`).
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { database } from '../connection';
import { toDocument, type DocumentPatch, type DocumentRow } from '../rows';
import type { StoredDocument } from '../../library';

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
export async function queueForPush(
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
