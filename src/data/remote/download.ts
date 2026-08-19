/**
 * Die Datei holen — Supabase Storage → lokaler Dateicache.
 *
 * Der Abgleich bringt Zeilen, nicht Dateien. Eine frisch abgeglichene Zeile
 * steht deshalb mit `cached: false` in der Liste: sichtbar, aber noch nicht zu
 * oeffnen. Erst wer sie antippt, loest den Abruf hier aus.
 *
 * Das ist Absicht und steht so im Zielbild (DATABASE_STRUCTURE.md,
 * Sync-Strategie): "Download erst beim ersten Oeffnen, nicht beim Sync." Bei
 * 50–500 Dokumenten waere alles vorab zu laden ein Datenvolumen, das niemand
 * bestellt hat — und das meiste davon fuer Dokumente, die in dieser Sitzung
 * niemand aufschlaegt.
 *
 * Dateien gelten als unveraenderlich: aendert sich der Inhalt am PC, aendert
 * sich `content_hash`, und dann wird neu geholt statt zusammengefuehrt.
 */
import { writeDocument } from '../cache';
import type { StoredDocument } from '../library';
import { indexDocumentText } from '../search';
import { STORAGE_BUCKET, supabase } from '../supabase';

/**
 * Muss die Datei geholt werden?
 *
 * Drei Gruende, die alle im selben Merkmal zusammenlaufen: sie war nie da, sie
 * wurde weggeraeumt ("Cache leeren"), oder der Inhalt oben hat sich geaendert.
 * Den letzten Fall erkennt nicht dieses Modul, sondern der Abgleich: er sieht
 * den neuen `content_hash` und setzt `cached` zurueck (siehe `applyRemote`).
 * Hier bleibt deshalb eine Frage statt eines Vergleichs.
 */
export function needsDownload(document: StoredDocument): boolean {
  if (document.storagePath === null) return false;
  return !document.cached || document.cacheKey === null;
}

export interface DownloadResult {
  cacheKey: string;
  sizeBytes: number;
  html: string;
}

/** Wie lange die Adresse gilt, mit der die Datei geholt wird. */
const SIGNED_URL_SECONDS = 60;

/**
 * Die Datei holen und ablegen.
 *
 * Der Schluessel im Dateicache ist die Kennung des Dokuments — dieselbe, die
 * die Zeile oben und unten hat. Ein eigener Schluessel waere eine dritte
 * Benennung fuer dieselbe Sache.
 *
 * Geholt wird ueber eine signierte Adresse und `fetch`, NICHT ueber
 * `storage.download()`: dessen Ergebnis ist ein `Blob`, und der von React
 * Native hat keine `text()`-Methode — der Aufruf endet in "undefined is not a
 * function". Mit der signierten Adresse kommt der Text direkt aus der Antwort,
 * ganz ohne Blob. Der Bucket bleibt dabei privat; die Adresse gilt eine Minute
 * und nur fuer diese eine Datei.
 *
 * Wirft, wenn es nicht klappt: der Viewer zeigt daraufhin den Zustand "nicht
 * geladen" (Blatt `4c`) statt einer leeren Buehne, ueber der nichts erklaert,
 * warum sie leer ist.
 */
export async function downloadDocument(document: StoredDocument): Promise<DownloadResult> {
  if (supabase === null) throw new Error('Supabase ist nicht eingerichtet.');
  if (document.storagePath === null) throw new Error('Zu diesem Dokument gibt es keine Datei.');

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(document.storagePath, SIGNED_URL_SECONDS);
  if (error !== null) throw new Error(error.message);
  if (!data?.signedUrl) throw new Error('Es kam keine Adresse fuer die Datei zurueck.');

  const response = await fetch(data.signedUrl);
  if (!response.ok) throw new Error(`Die Datei antwortete mit ${response.status}.`);

  const html = await response.text();
  const sizeBytes = await writeDocument(document.id, html);
  // Der Text steht jetzt schon fest — ihn gleich abzulegen erspart es, die
  // Datei beim naechsten Suchlauf noch einmal zu lesen. Dieselbe Ueberlegung
  // wie beim Import.
  indexDocumentText(document.id, html);

  return { cacheKey: document.id, sizeBytes, html };
}
