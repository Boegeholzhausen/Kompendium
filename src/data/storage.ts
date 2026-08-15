/**
 * Die Zahlen der Gruppe "Speicher" in den Einstellungen (Blatt `3i`).
 *
 * Gerechnet, nicht gesetzt: die Werte aendern sich, wenn Dokumente offline
 * behalten, geloescht oder importiert werden. Nur so sagt der Balken etwas —
 * eine feste Zahl waere ein Bild von Speicherplatz, keine Auskunft ueber ihn.
 *
 * Zwei Segmente, weil "Cache leeren" sonst wie Datenverlust wirkt:
 *
 *   offline   was ausdruecklich behalten wird — bleibt beim Leeren stehen
 *   cache     was nur zufaellig noch da ist — genau das verschwindet
 *
 * **Abweichung von Blatt `3i`:** dort fuellen die beiden Segmente 46 % des
 * Balkens ("1,4 GB von 3 GB"). Mit dem Beispiel-Bestand sind es rund 110 MB,
 * der Balken bleibt also fast leer. Das Blatt zeigt eine Beispielzahl; ein
 * Balken, der mehr anzeigt, als belegt ist, waere die schlechtere Loesung.
 * Damit ein vorhandenes Segment trotzdem sichtbar bleibt, zeichnet der Screen
 * jedes Segment ueber null mindestens 2 dp breit.
 */
import type { StoredDocument } from './library';

/**
 * Das Kontingent, das die App sich selbst gibt — 3 GB aus Blatt `3i`. Es ist
 * bewusst kein Geraetewert: was das Handy insgesamt frei hat, sagt nichts
 * darueber, wie viel eine Dokumentensammlung belegen sollte.
 */
export const STORAGE_QUOTA_BYTES = 3 * 1024 * 1024 * 1024;

export interface StorageUsage {
  /** Summe der Dokumente mit "Offline behalten". */
  offlineBytes: number;
  /** Summe der uebrigen geladenen Dokumente. */
  cacheBytes: number;
  usedBytes: number;
  quotaBytes: number;
  offlineCount: number;
  trashCount: number;
  /** Anteile am Kontingent, 0 bis 1 — die beiden Segmente des Balkens. */
  offlineShare: number;
  cacheShare: number;
}

export function storageUsage(documents: StoredDocument[]): StorageUsage {
  let offlineBytes = 0;
  let cacheBytes = 0;
  let offlineCount = 0;
  let trashCount = 0;

  for (const document of documents) {
    if (document.trashedAt !== null) {
      trashCount += 1;
      // Geloeschte Dokumente belegen weiter Platz — das ist genau der Grund,
      // warum der Papierkorb eine Gesamtgroesse nennt.
    }
    if (document.keepOffline) {
      offlineBytes += document.sizeBytes;
      offlineCount += 1;
    } else if (document.cached) {
      cacheBytes += document.sizeBytes;
    }
  }

  const usedBytes = offlineBytes + cacheBytes;

  return {
    offlineBytes,
    cacheBytes,
    usedBytes,
    quotaBytes: STORAGE_QUOTA_BYTES,
    offlineCount,
    trashCount,
    offlineShare: Math.min(1, offlineBytes / STORAGE_QUOTA_BYTES),
    cacheShare: Math.min(1, cacheBytes / STORAGE_QUOTA_BYTES),
  };
}

/** Gesamtgroesse einer Auswahl — der Papierkorb nennt sie im Sektionskopf. */
export function totalBytes(documents: StoredDocument[]): number {
  return documents.reduce((sum, document) => sum + document.sizeBytes, 0);
}
