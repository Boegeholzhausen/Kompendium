/**
 * Der Abruf: Supabase → lokale Datenbank.
 *
 * Die Richtung, die aus dem Beispiel-Bestand echte Dokumente macht. Sie ist
 * bewusst die erste von beiden — lesen kann nichts kaputtmachen, und der Weg
 * vom PC (`scripts/upload.mjs`) fuellt oben ohnehin schon.
 *
 * Wasserzeichen statt Vollabgleich: die App merkt sich, bis wann sie gelesen
 * hat (`last_pulled_at`, ein SERVER-Zeitstempel), und fragt beim naechsten Mal
 * nur nach juengeren Zeilen. Loeschungen brauchen dabei keinen Sonderweg — ein
 * Soft Delete setzt `deleted_at` UND `updated_at`, kommt also durch dasselbe
 * Wasserzeichen mit.
 *
 * Kein SQL hier: das steht ausschliesslich im Repository. Dieses Modul redet
 * mit Supabase, uebersetzt in die Begriffe der App und uebergibt das Ergebnis
 * an `applyRemote`.
 */
import {
  applyRemote,
  clearLibrary,
  noteOwner,
  readSyncState,
  writeSettings,
  writeSyncState,
  SYNCED_SETTING_KEYS,
  type RemoteDocument,
  type RemoteFolder,
  type RemoteSnapshot,
} from '../db/repository';
import type { DocType } from '../../theme/tile';
import type { StoredDocument } from '../library';
import { currentUserId, supabase } from '../supabase';
import { tagPalette } from '../../theme/colors';

/**
 * Farben stehen oben als Token-Name ("mint"), unten als Wert.
 *
 * Der Name ist die richtige Form fuer die Ablage: er ueberlebt jede Aenderung
 * an der Palette, waehrend ein gespeicherter Hex-Wert eine Kopie waere, die
 * beim naechsten Feinschliff des Themes zurueckbleibt. Uebersetzt wird deshalb
 * erst hier, an der Grenze.
 */
function colorFor(token: string | null): string {
  if (token !== null && token in tagPalette) {
    return tagPalette[token as keyof typeof tagPalette];
  }
  return tagPalette.slate;
}

/** Zeitstempel von oben (ISO) in die Millisekunden, mit denen die App rechnet. */
function millis(value: string | null): number | null {
  if (value === null) return null;
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : at;
}

const DOC_TYPES: DocType[] = ['table', 'chart', 'text', 'calculator', 'list'];
const SOURCES: StoredDocument['source'][] = ['pc', 'file', 'clipboard', 'url', 'sample'];

/**
 * Was das Ergebnis eines Abrufs ist.
 *
 * `at` ist das neue Wasserzeichen; `changed` die Zahl der Zeilen, die sich
 * geaendert haben — die Einstellungen sagen damit "nichts Neues" statt eines
 * Hakens, der immer gleich aussieht.
 */
export interface PullResult {
  changed: number;
  at: string | null;
}

/** Eine Tabelle abfragen, nur was juenger ist als das Wasserzeichen. */
async function since(table: string, watermark: string | null) {
  if (supabase === null) throw new Error('Supabase ist nicht eingerichtet.');

  let query = supabase.from(table).select('*').order('updated_at', { ascending: true });
  if (watermark !== null) query = query.gt('updated_at', watermark);

  const { data, error } = await query;
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []) as Record<string, unknown>[];
}

/**
 * Der Abruf.
 *
 * Beim allerersten Lauf faellt der Schnitt: der Beispiel-Bestand geht, bevor
 * die erste echte Zeile kommt. Danach nie wieder — `reset_done` haelt fest,
 * dass es passiert ist, denn ein zweiter Lauf wuerde alles loeschen, was
 * seither am Handy entstanden ist.
 */
export async function pullChanges(): Promise<PullResult> {
  if (supabase === null) throw new Error('Supabase ist nicht eingerichtet.');

  const userId = await currentUserId();
  if (userId === null) throw new Error('Keine Anmeldung bei Supabase.');

  if ((await readSyncState('reset_done')) === null) {
    await clearLibrary();
    await writeSyncState('reset_done', new Date().toISOString());
  }

  // Zweite Sicherung: `pushChanges` hat den Kontowechsel im selben Lauf schon
  // bemerkt, aber der Abruf laesst sich auch fuer sich aufrufen. Der zweite
  // Aufruf kostet eine Abfrage und tut sonst nichts.
  await noteOwner(userId);

  const watermark = await readSyncState('last_pulled_at');

  // Die Reihenfolge der Abfragen ist gleichgueltig — geschrieben wird in einer
  // Transaktion, und dort haengt die Reihenfolge fest: erst Ordner, dann
  // Dokumente.
  const [folderRows, documentRows, settingRows] = await Promise.all([
    since('folders', watermark),
    since('documents', watermark),
    since('user_settings', watermark),
  ]);

  const folders: RemoteFolder[] = folderRows.map((row) => ({
    remoteId: String(row.id),
    name: String(row.name ?? ''),
    color: colorFor(row.color as string | null),
    keepOffline: row.keep_offline === true,
    deleted: row.deleted_at !== null,
  }));

  const documents: RemoteDocument[] = documentRows.map((row) => {
    const docType = String(row.doc_type ?? 'text') as DocType;
    const source = String(row.source ?? 'pc') as StoredDocument['source'];
    const updatedAt = millis(row.updated_at as string | null) ?? Date.now();

    return {
      id: String(row.id),
      title: String(row.title ?? ''),
      // Ein unbekannter Wert waere sonst eine Kachel, die es nicht gibt. Der
      // Text-Typ ist der ehrliche Rueckfall: er behauptet am wenigsten.
      docType: DOC_TYPES.includes(docType) ? docType : 'text',
      folderRemoteId: row.folder_id === null ? null : String(row.folder_id),
      favorite: row.is_favorite === true,
      keepOffline: row.keep_offline === true,
      sizeBytes: Number(row.file_size ?? 0),
      updatedAt,
      importedAt: millis(row.created_at as string | null) ?? updatedAt,
      openCount: Number(row.open_count ?? 0),
      lastOpenedAt: millis(row.opened_at as string | null),
      note: String(row.note ?? ''),
      trashedAt: millis(row.deleted_at as string | null),
      source: SOURCES.includes(source) ? source : 'pc',
      storagePath: row.storage_path === null ? null : String(row.storage_path),
      contentHash: row.content_hash === null ? null : String(row.content_hash),
      readAt: millis(row.read_at as string | null),
      archivedAt: millis(row.archived_at as string | null),
      scrollOffset: Number(row.scroll_offset ?? 0),
    };
  });

  const snapshot: RemoteSnapshot = { folders, documents };

  await applyRemote(snapshot);

  // Die Voreinstellungen stehen neben dem Bestand und nicht darin: sie
  // beschreiben, WIE gelesen wird, nicht WAS. Sie gehen deshalb an
  // `writeSettings` und nicht durch `applyRemote`.
  //
  // Gefiltert wird auf die bekannten Schluessel: eine Zeile, die eine spaetere
  // Fassung der App angelegt hat, gehoert nicht ungeprueft in die lokale
  // Tabelle. Und `settings_pushed` wird mitgezogen, damit der naechste Push den
  // gerade empfangenen Wert nicht sofort wieder ueberschreibt.
  const incoming: Record<string, string> = {};
  for (const row of settingRows) {
    const key = String(row.key ?? '');
    if (SYNCED_SETTING_KEYS.includes(key)) incoming[key] = String(row.value ?? '');
  }
  if (Object.keys(incoming).length > 0) {
    await writeSettings(incoming);
    const pushed = await readSyncState('settings_pushed');
    const merged = { ...safeObject(pushed), ...incoming };
    await writeSyncState('settings_pushed', JSON.stringify(merged));
  }

  // Das neue Wasserzeichen ist der groesste empfangene Zeitstempel, nicht
  // "jetzt": zwischen Abfrage und Antwort kann oben eine Zeile entstanden
  // sein, und die waere mit der Geraetezeit fuer immer uebersprungen.
  const stamps = [...folderRows, ...documentRows, ...settingRows]
    .map((row) => String(row.updated_at ?? ''))
    .filter((value) => value !== '');
  const newest = stamps.length === 0 ? null : stamps.reduce((a, b) => (a > b ? a : b));
  if (newest !== null) await writeSyncState('last_pulled_at', newest);

  return {
    changed: folderRows.length + documentRows.length + settingRows.length,
    at: newest ?? watermark,
  };
}

/** Ein gemerkter JSON-Stand; ein kaputter Text heisst schlicht "noch nichts". */
function safeObject(raw: string | null): Record<string, string> {
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}
