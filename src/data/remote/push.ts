/**
 * Der Weg nach oben: lokale Datenbank → Supabase.
 *
 * Die Gegenrichtung zu `pull.ts`, und die zweite Haelfte dessen, was der
 * Kopfkommentar von `data/supabase.ts` schon vorsieht ("Push per Outbox").
 * Ohne sie stuenden alle Aenderungen am Handy nur in SQLite und waeren beim
 * naechsten Abruf ueberschrieben, sobald der PC dieselbe Zeile anfasst.
 *
 * Was hochgeht, steht nicht hier, sondern in der Outbox: das Repository merkt
 * beim Schreiben vor, welche FELDER sich geaendert haben — die Werte holt
 * dieses Modul aus der Dokumentzeile, die immer den neuesten Stand traegt.
 *
 * Kein SQL hier: das steht ausschliesslich im Repository. Dieses Modul
 * uebersetzt in die Begriffe von Supabase und redet mit dem Server.
 */
import {
  clearOutbox,
  countOutbox,
  readOutbox,
  type DocumentPatch,
  type OutboxEntry,
} from '../db/repository';
import { ensureSession, supabase } from '../supabase';

/** Wie viele Zeilen tatsaechlich oben angekommen sind. */
export interface PushResult {
  pushed: number;
}

/** Millisekunden der App in den ISO-Text, mit dem Supabase rechnet. */
function iso(value: number | null): string | null {
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
function column(
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
    default:
      // Alles andere beschreibt dieses Geraet und hat oben nichts zu suchen.
      // Die Outbox nimmt es ohnehin nicht auf (`PUSHABLE` im Repository).
      return undefined;
  }
}

/**
 * Alles Offene hochschicken.
 *
 * Zeile fuer Zeile statt in einem Rutsch: die Nutzlasten unterscheiden sich je
 * Eintrag (nur geaenderte Felder), und ein Sammelaufruf muesste die
 * Vereinigung aller Felder schicken — also auch Werte, die der Nutzer gar
 * nicht angefasst hat, ueber einen fremden Stand hinweg.
 *
 * `update`, nicht `upsert`: es geht ausschliesslich um Zeilen, die es oben
 * schon gibt (die Outbox nimmt nichts ohne `storage_path` auf). Deshalb
 * braucht es hier auch kein `owner_id` — RLS greift ueber die vorhandene
 * Zeile.
 *
 * `updated_at` wird bewusst NICHT mitgeschickt: das Wasserzeichen des Abrufs
 * ist ein Server-Zeitstempel, und eine Geraetezeit hineinzuschreiben koennte
 * die Reihenfolge dauerhaft verderben — eine nachgehende Uhr liesse die Zeile
 * beim naechsten Abruf fuer immer unter dem Wasserzeichen liegen.
 */
export async function pushChanges(): Promise<PushResult> {
  if (supabase === null) throw new Error('Supabase ist nicht eingerichtet.');
  if ((await countOutbox()) === 0) return { pushed: 0 };

  const userId = await ensureSession();
  if (userId === null) throw new Error('Keine Anmeldung bei Supabase.');

  const entries = await readOutbox();
  const done: { documentId: string; queuedAt: number }[] = [];
  const failed: string[] = [];

  for (const entry of entries) {
    const payload: Record<string, unknown> = {};
    for (const field of entry.fields) {
      const mapped = column(field, entry);
      if (mapped !== undefined) payload[mapped.name] = mapped.value;
    }

    // Blieb nichts uebrig (nur ein Ordner, den es oben nicht gibt), waere ein
    // leeres `update` ein Aufruf ohne Wirkung. Der Eintrag bleibt stehen und
    // geht mit, sobald der Ordner oben angelegt ist.
    if (Object.keys(payload).length === 0) continue;

    const { error } = await supabase.from('documents').update(payload).eq('id', entry.documentId);
    if (error) {
      failed.push(`${entry.documentId}: ${error.message}`);
      continue;
    }
    done.push({ documentId: entry.documentId, queuedAt: entry.queuedAt });
  }

  // Erst aufraeumen, dann melden: was oben angekommen ist, soll auch dann
  // nicht ein zweites Mal geschickt werden, wenn eine andere Zeile scheitert.
  await clearOutbox(done);

  if (failed.length > 0) {
    throw new Error(`${failed.length} Änderung(en) blieben offen: ${failed[0]}`);
  }

  return { pushed: done.length };
}
