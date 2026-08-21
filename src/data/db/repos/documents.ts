/**
 * Die Dokumentzeilen: lesen, schreiben, endgueltig wegwerfen.
 *
 * Eine von mehreren Dateien unter `repos/`, in die das frueher einteilige
 * Repository zerlegt ist. Zusammengehalten werden sie von `repository.ts`,
 * das nichts weiter tut, als sie alle nach aussen zu reichen — kein Aufrufer
 * ausserhalb von `data/db/` merkt von der Aufteilung etwas.
 */
import { database, insertRow, toBind } from '../connection';
import { columns, toDocument, type DocumentPatch, type DocumentRow, type Snapshot } from '../rows';
import type { StoredDocument } from '../../library';
import { queueForPush } from './outbox';

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

/**
 * Endgueltig loeschen — nur aus dem Papierkorb heraus (Blatt `6a`).
 *
 * Der Grabstein muss VOR dem Loeschen geschrieben werden, dieselbe Ueberlegung
 * wie bei `deleteFolder`: danach gibt es die Zeile nicht mehr, aus der sich
 * `storage_path` lesen liesse. Zeilen, die nie oben waren, hinterlassen keinen
 * — dort gibt es weder eine Zeile noch eine Datei zu loeschen.
 *
 * Warum das nicht die Outbox erledigt: ihr Eintrag haengt per
 * `ON DELETE CASCADE` an der Dokumentzeile und geht im selben Moment mit. Er
 * ist damit die eine Buchhaltung, die ein Loeschen nicht ueberleben kann.
 *
 * Beides in einer Transaktion: ein Aussetzer dazwischen liesse entweder einen
 * Grabstein ohne Loeschung stehen (der naechste Push naehme oben etwas weg, was
 * hier noch in der Liste steht) oder eine Loeschung ohne Grabstein — genau die
 * Luecke, die es zu schliessen gilt.
 */
export async function deleteDocuments(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await database();
  const placeholders = ids.map(() => '?').join(', ');
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT OR REPLACE INTO document_deletions (document_id, storage_path, queued_at)
       SELECT id, storage_path, ? FROM documents
        WHERE id IN (${placeholders}) AND storage_path IS NOT NULL`,
      [Date.now(), ...ids]
    );
    await db.runAsync(`DELETE FROM documents WHERE id IN (${placeholders})`, ids);
  });
}

/** Ein Grabstein, mit allem, was `pushChanges` daraus bauen muss. */
export interface DocumentDeletion {
  documentId: string;
  /** Wo die Datei oben liegt — nach dem Loeschen sonst nicht mehr zu ermitteln. */
  storagePath: string;
}

/** Die Grabsteine, die der naechste Push noch abarbeiten muss. */
export async function readDocumentDeletions(): Promise<DocumentDeletion[]> {
  const db = await database();
  const rows = await db.getAllAsync<{ document_id: string; storage_path: string }>(
    `SELECT document_id, storage_path FROM document_deletions
      WHERE pushed_at IS NULL ORDER BY queued_at ASC`
  );
  return rows.map((row) => ({ documentId: row.document_id, storagePath: row.storage_path }));
}

/**
 * Erledigte Grabsteine abhaken — nur die, die oben wirklich durchkamen.
 *
 * Abgehakt, nicht geloescht: die Zeile bleibt als Sperrliste stehen, damit der
 * Abruf gleich danach das eben geloeschte Dokument nicht als Papierkorb-Eintrag
 * wieder anlegt (Begruendung ausfuehrlich in `schema.ts`). Eine Handvoll
 * Zeilen mit je einer Kennung ist der Preis dafuer.
 */
export async function markDeletionsPushed(documentIds: string[]): Promise<void> {
  if (documentIds.length === 0) return;
  const db = await database();
  const placeholders = documentIds.map(() => '?').join(', ');
  await db.runAsync(
    `UPDATE document_deletions SET pushed_at = ? WHERE document_id IN (${placeholders})`,
    [Date.now(), ...documentIds]
  );
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
