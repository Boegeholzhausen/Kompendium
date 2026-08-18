/**
 * Der lokale Dateicache — hier liegt das HTML importierter Dokumente.
 *
 * Handoff-Dokument: "Der Dokumenten-Viewer selbst ist eine `WebView`
 * (`react-native-webview`) mit **lokal gespeichertem HTML**." Genau das ist
 * dieses Modul: eine Datei je Dokument unter `dokumente/` im
 * Dokumentverzeichnis der App.
 *
 * Warum nicht in die Datenbank: ein HTML-Dokument ist schnell ein paar hundert
 * Kilobyte gross, und die Liste liest bei jedem Filterwechsel alle Zeilen. Ein
 * Textfeld dieser Groesse in der Zeile wuerde jede Abfrage mitschleppen, obwohl
 * der Inhalt nur beim Oeffnen gebraucht wird. Die Zeile merkt sich deshalb nur
 * den Schluessel.
 *
 * `Paths.document` statt `Paths.cache`: was das System bei Platzmangel loeschen
 * darf, ist kein Ort fuer die einzige Fassung eines Dokuments.
 */
import { Directory, File, Paths } from 'expo-file-system';

const FOLDER = 'dokumente';

function directory(): Directory {
  const dir = new Directory(Paths.document, FOLDER);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function fileFor(key: string): File {
  return new File(directory(), `${key}.html`);
}

/** Legt das HTML ab und gibt den Schluessel zurueck, den die Zeile behaelt. */
export async function writeDocument(key: string, html: string): Promise<number> {
  const file = fileFor(key);
  if (file.exists) file.delete();
  file.create();
  file.write(html);
  return file.size;
}

/** Das HTML eines Dokuments, oder `null`, wenn die Datei nicht (mehr) da ist. */
export async function readDocument(key: string): Promise<string | null> {
  const file = fileFor(key);
  if (!file.exists) return null;
  return file.text();
}

/**
 * Der `file://`-Pfad der abgelegten Datei, oder `null`, wenn es sie nicht gibt.
 *
 * Gebraucht vom Teilen im Viewer: das System-Sheet bekommt die Datei selbst,
 * nicht ihren Inhalt — ein paar hundert Kilobyte HTML als Text durch das
 * Sheet zu schicken waere weder lesbar noch weiterverwendbar.
 */
export function documentUri(key: string): string | null {
  const file = fileFor(key);
  if (!file.exists) return null;
  return file.uri;
}

export async function deleteDocument(key: string): Promise<void> {
  const file = fileFor(key);
  if (file.exists) file.delete();
}

/**
 * Belegter Platz im Cache, in Bytes. Die Einstellungen zeigen ihn als zweites
 * Segment des Speicherbalkens (Blatt `3i`).
 */
export async function cacheSize(): Promise<number> {
  const dir = directory();
  let total = 0;
  for (const entry of dir.list()) {
    if (entry instanceof File) total += entry.size;
  }
  return total;
}

/**
 * "Cache leeren" aus den Einstellungen. Loescht die Dateien, nicht die
 * Dokumente — die Zeilen bleiben in der Liste stehen und sind nur nicht mehr
 * zu oeffnen, so wie jedes nicht geladene Dokument (Blatt `4c`).
 */
export async function clearCache(keep: string[] = []): Promise<string[]> {
  const kept = new Set(keep.map((key) => `${key}.html`));
  const dropped: string[] = [];

  for (const entry of directory().list()) {
    if (!(entry instanceof File)) continue;
    if (kept.has(entry.name)) continue;
    dropped.push(entry.name.replace(/\.html$/, ''));
    entry.delete();
  }

  return dropped;
}
