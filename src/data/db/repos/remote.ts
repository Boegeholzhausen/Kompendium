/**
 * Was der Abruf in die lokale Datenbank schreibt.
 *
 * Die Begriffe von oben uebersetzt `data/remote/pull.ts`; hier steht nur, wie
 * daraus Zeilen werden — und welche davon der lokale Stand behaelt.
 */
import { database } from '../connection';
import type { DocumentPatch } from '../rows';
import type { StoredDocument } from '../../library';
import type { DocType } from '../../../theme/tile';

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
 * Und: ein Feld mit offenem Outbox-Eintrag behaelt seinen lokalen Wert. Der
 * lokale Stand ist dort der juengere — er wartet nur darauf, hochgeschickt zu
 * werden (siehe `mine` unten).
 */
/**
 * Ein Zuweisungsausdruck fuer `ON CONFLICT DO UPDATE`, der den lokalen Wert
 * behaelt, solange fuer GENAU DIESES FELD ein Outbox-Eintrag offen ist.
 *
 * Als Funktion und nicht zehnmal ausgeschrieben, damit die Regel an genau
 * einer Stelle steht — eine Spalte, die man beim Abschreiben vergisst, waere
 * eine, die der Abruf still zuruecksetzt.
 *
 * ## Warum feldweise und nicht zeilenweise
 *
 * Vorher schuetzte ein offener Eintrag die ganze Zeile. Das war fuer das
 * geaenderte Feld richtig und fuer alle uebrigen ein stiller Verlust: wer
 * offline einen Favoriten setzt, waehrend am PC der Titel desselben Dokuments
 * geaendert wird, bekam den neuen Titel nie zu sehen. Der Abruf verwarf ihn,
 * und weil das Wasserzeichen ueber diese Zeile trotzdem fortschrieb
 * (`pull.ts`), lieferte kein spaeterer Abruf ihn noch einmal.
 *
 * Gesucht wird im JSON-Text der Feldliste (`["title","favorite"]`). Ein
 * `LIKE '%"title"%'` reicht dafuer: die Namen stammen aus `PUSHABLE`, sind
 * feste Bezeichner ohne Sonderzeichen, und keiner ist Teil eines anderen —
 * `parseFields` laesst ohnehin nichts anderes durch. Der Name kommt hier aus
 * einer festen Zuordnung im Modul und nie von aussen.
 */
function mine(column: string, field: keyof DocumentPatch): string {
  return (
    `CASE WHEN EXISTS (` +
    `SELECT 1 FROM outbox o WHERE o.document_id = documents.id ` +
    `AND o.fields LIKE '%"${field}"%'` +
    `) THEN documents.${column} ELSE excluded.${column} END`
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
      // Endgueltig geloescht heisst endgueltig: eine Zeile, zu der hier ein
      // Grabstein liegt, wird nicht wieder angelegt. Ohne diese Sperre kaeme
      // sie im selben Lauf zurueck, in dem der Push sie oben weggeraeumt hat —
      // der Trigger schreibt beim `deleted_at` das `updated_at` fort, und damit
      // faellt sie in genau diesen Abruf (siehe `schema.ts`).
      const buried = await db.getAllAsync<{ document_id: string }>(
        'SELECT document_id FROM document_deletions WHERE document_id = ?',
        [document.id]
      );
      if (buried.length > 0) continue;

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
           title = ${mine('title', 'title')},
           folder_name = ${mine('folder_name', 'folderName')},
           favorite = ${mine('favorite', 'favorite')},
           note = ${mine('note', 'note')},
           keep_offline = ${mine('keep_offline', 'keepOffline')},
           trashed_at = ${mine('trashed_at', 'trashedAt')},
           open_count = ${mine('open_count', 'openCount')},
           last_opened_at = ${mine('last_opened_at', 'lastOpenedAt')},
           read_at = ${mine('read_at', 'readAt')},
           archived_at = ${mine('archived_at', 'archivedAt')},
           scroll_offset = ${mine('scroll_offset', 'scrollOffset')},
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
