/**
 * Was alle Push-Schritte brauchen: der Zeitstempel-Umbau und die Uebersetzung
 * eines geaenderten Feldes in Spalte und Wert.
 *
 * Herausgeloest aus `push.ts`, das vier Wege nach oben plus Ablaufsteuerung in
 * einer Datei hielt. Kein SQL hier und in keiner Datei unter `push/` — das
 * steht ausschliesslich unterhalb von `data/db/`.
 */
import type { DocumentPatch, OutboxEntry } from '../../db/repository';

/** Millisekunden der App in den ISO-Text, mit dem Supabase rechnet. */
export function iso(value: number | null): string | null {
  return value === null ? null : new Date(value).toISOString();
}

/**
 * Ein geaendertes Feld in Spalte und Wert oben.
 *
 * `undefined` heisst: nicht mitschicken. Das braucht genau ein Fall — ein
 * Ordner, den es oben noch nicht gibt (kein `remote_id`). Ihn als `null` zu
 * schicken hiesse "aus dem Ordner genommen", und das hat der Nutzer nicht
 * getan.
 */
export function column(
  field: keyof DocumentPatch,
  entry: OutboxEntry
): { name: string; value: unknown } | undefined {
  const document = entry.document;
  switch (field) {
    case 'title':
      return { name: 'title', value: document.title };
    case 'folderName':
      if (document.folderName !== null && entry.folderRemoteId === null) return undefined;
      return { name: 'folder_id', value: document.folderName === null ? null : entry.folderRemoteId };
    case 'favorite':
      return { name: 'is_favorite', value: document.favorite };
    case 'note':
      return { name: 'note', value: document.note };
    case 'keepOffline':
      return { name: 'keep_offline', value: document.keepOffline };
    case 'trashedAt':
      return { name: 'deleted_at', value: iso(document.trashedAt) };
    case 'openCount':
      return { name: 'open_count', value: document.openCount };
    case 'lastOpenedAt':
      return { name: 'opened_at', value: iso(document.lastOpenedAt) };
    case 'readAt':
      return { name: 'read_at', value: iso(document.readAt) };
    case 'archivedAt':
      return { name: 'archived_at', value: iso(document.archivedAt) };
    case 'scrollOffset':
      return { name: 'scroll_offset', value: entry.scrollOffset };
    default:
      // Alles andere beschreibt dieses Geraet und hat oben nichts zu suchen.
      // Die Outbox nimmt es ohnehin nicht auf (`PUSHABLE` im Repository).
      return undefined;
  }
}
