/**
 * Die Zahlen der Gruppe "Speicher" in den Einstellungen (Blatt `3i`).
 *
 * Gerechnet, nicht gesetzt: die Werte aendern sich, wenn Dokumente offline
 * behalten, geloescht oder importiert werden. Nur so sagen sie etwas — eine
 * feste Zahl waere ein Bild von Speicherplatz, keine Auskunft ueber ihn.
 *
 * Zwei Werte, weil "Cache leeren" sonst wie Datenverlust wirkt:
 *
 *   offline   was ausdruecklich behalten wird — bleibt beim Leeren stehen
 *   cache     was nur zufaellig noch da ist — genau das verschwindet
 *
 * Ein Kontingent gibt es bewusst nicht mehr. Die 3 GB aus Blatt `3i` waren
 * kein Geraetewert und wurden von nichts durchgesetzt: kein Import wurde
 * blockiert, nichts verdraengt. Eine Obergrenze, die niemand einhaelt, ist
 * keine Auskunft — sie behauptet freien Platz, den sie nicht kennt.
 */
import type { StoredDocument } from './library';

export interface StorageUsage {
  /** Summe der Dokumente mit "Offline behalten". */
  offlineBytes: number;
  /** Summe der uebrigen geladenen Dokumente. */
  cacheBytes: number;
  usedBytes: number;
  offlineCount: number;
  trashCount: number;
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
    offlineCount,
    trashCount,
  };
}

/** Gesamtgroesse einer Auswahl — der Papierkorb nennt sie im Sektionskopf. */
export function totalBytes(documents: StoredDocument[]): number {
  return documents.reduce((sum, document) => sum + document.sizeBytes, 0);
}
