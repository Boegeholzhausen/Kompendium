/**
 * Die Ordnerzeilen — lokal und auf dem Weg nach oben.
 *
 * Der Name IST der Ausweis (siehe Kopf von `schema.ts`); `remote_id` haelt
 * daneben fest, unter welcher Kennung derselbe Ordner oben steht.
 */
import { database } from '../connection';
import type { LibraryFolder } from '../../library';

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
