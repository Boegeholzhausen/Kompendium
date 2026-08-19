/**
 * Der eine Weg von der Datenbank in die Zustaende.
 *
 * Beim Start wird die Datenbank einmal vollstaendig gelesen und auf die
 * Zustaende verteilt; danach schreibt jede Aenderung ueber das Repository
 * zurueck. Fuer 247 Zeilen ist das der einfachste richtige Weg — sie stehen
 * ohnehin gleichzeitig in der Liste, und jede Filterung waere eine Abfrage,
 * die die Bibliothek beim Tippen ausbremst.
 *
 * Faellt das Lesen aus, startet die App trotzdem — mit leerer Bibliothek und
 * der Leerdarstellung aus Schritt 8. Ein Screen, der gar nicht erscheint,
 * waere die schlechtere Antwort auf einen Fehler, den der Nutzer nicht
 * beheben kann.
 */
import { TRASH_DAYS, type StoredDocument } from '../data/library';
import { countOutbox, expiredTrashIds, loadSnapshot } from '../data/db/repository';
import { warmSearchIndex } from '../data/search';
import { useAppearanceStore } from './appearance';
import { purgeDocuments, useDocumentStore } from './documents';
import { useFolderStore } from './folders';
import { useLibraryStore } from './library';
import { useSearchStore } from './search';
import { useSyncStore } from './sync';
import { useViewerStore } from './viewer';

let running: Promise<void> | null = null;

const DAY = 24 * 60 * 60 * 1000;

/**
 * Die 30-Tage-Zusage des Papierkorbs (Blatt `6a`) einloesen.
 *
 * Ohne diesen Lauf bliebe jede geloeschte Zeile fuer immer stehen — mit "0 Tage
 * uebrig" in der Meta-Zeile, also einem sichtbar gebrochenen Versprechen. Er
 * laeuft VOR dem Verteilen des Snapshots und raeumt die abgelaufenen Zeilen
 * auch aus ihm heraus, damit der Nutzer nie eine Zeile sieht, die eigentlich
 * schon weg ist.
 *
 * Faellt er aus, startet die App trotzdem: ein nicht geleerter Papierkorb ist
 * kein Grund, die Bibliothek nicht zu zeigen.
 */
async function purgeExpiredTrash(documents: StoredDocument[]): Promise<StoredDocument[]> {
  try {
    const expired = await expiredTrashIds(Date.now() - TRASH_DAYS * DAY);
    if (expired.length === 0) return documents;

    await purgeDocuments(expired);
    const gone = new Set(expired.map((entry) => entry.id));
    return documents.filter((document) => !gone.has(document.id));
  } catch (error: unknown) {
    console.warn('[kompendium] Papierkorb liess sich nicht aufraeumen:', error);
    return documents;
  }
}

/**
 * Den Anfangsstatus des Abgleichs setzen.
 *
 * Nebenlaeufig zum Verteilen des Snapshots: die Bibliothek soll nicht auf eine
 * Zaehlung warten, die nur einen Streifen am oberen Rand betrifft. Faellt sie
 * aus, bleibt `pending` stehen — die vorsichtigere der beiden Aussagen.
 */
async function setInitialSyncStatus(): Promise<void> {
  try {
    const open = await countOutbox();
    useSyncStore.getState().setStatus(open === 0 ? 'idle' : 'pending');
  } catch (error: unknown) {
    console.warn('[kompendium] Offene Aenderungen liessen sich nicht zaehlen:', error);
  }
}

/**
 * Der Lauf selbst. `hydrateStores` fuehrt ihn genau einmal aus,
 * `reloadStores` erzwingt ihn erneut — nach einem Abgleich, der etwas
 * gebracht hat.
 */
function readAndDistribute(): Promise<void> {
  return (async () => {
    try {
      const snapshot = await loadSnapshot();
      const documents = await purgeExpiredTrash(snapshot.documents);
      useDocumentStore.getState().hydrate(documents);
      useFolderStore.getState().hydrate(snapshot.folders);
      useLibraryStore.getState().hydrate(snapshot.settings);
      useAppearanceStore.getState().hydrate(snapshot.settings);
      useSearchStore.getState().hydrate(snapshot.settings);
      // Die Lesepositionen kommen NACH dem Aufraeumen des Papierkorbs an die
      // Reihe: nur so laesst sich verwerfen, was zu einem Dokument gehoert,
      // das es nicht mehr gibt.
      useViewerStore.getState().hydrate(
        snapshot.settings,
        documents.map((document) => document.id)
      );
      // Der Sync-Zustand startet auf `pending`; hier bekommt er zum ersten Mal
      // eine Auskunft statt einer Annahme — dasselbe Mass wie am Ende von
      // `sync()`. Eine leere Outbox heisst: die letzte Sitzung ist vollstaendig
      // oben angekommen, und die gelbe Leiste haette nichts zu melden.
      void setInitialSyncStatus();
      // Der Suchindex laeuft im Hintergrund warm: der erste Screen soll
      // nicht auf Dateien warten, die erst beim Suchen gebraucht werden.
      void warmSearchIndex(documents);
    } catch (error: unknown) {
      console.warn('[kompendium] Datenbank liess sich nicht lesen:', error);
      useDocumentStore.getState().hydrate([]);
      useSyncStore.getState().setStatus('idle');
    }
  })();
}

export function hydrateStores(): Promise<void> {
  if (running === null) running = readAndDistribute();
  return running;
}

/**
 * Noch einmal lesen — nach einem Abgleich, der Zeilen gebracht hat.
 *
 * Der gemerkte Lauf wird dabei ersetzt: wer danach `hydrateStores()` ruft,
 * soll den neuen Stand bekommen und nicht auf ein Versprechen von vorhin
 * warten, das laengst erfuellt ist.
 */
export function reloadStores(): Promise<void> {
  running = readAndDistribute();
  return running;
}
