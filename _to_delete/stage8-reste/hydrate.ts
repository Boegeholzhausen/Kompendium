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
import { loadSnapshot } from '../data/db/repository';
import { warmSearchIndex } from '../data/search';
import { useAppearanceStore } from './appearance';
import { useDocumentStore } from './documents';
import { useFolderStore } from './folders';
import { useLibraryStore } from './library';
import { useSyncStore } from './sync';

let running: Promise<void> | null = null;

export function hydrateStores(): Promise<void> {
  if (running === null) {
    running = (async () => {
      try {
        const snapshot = await loadSnapshot();
        useDocumentStore.getState().hydrate(snapshot.documents, snapshot.tags);
        useFolderStore.getState().hydrate(snapshot.folders);
        useLibraryStore.getState().hydrate(snapshot.settings);
        useAppearanceStore.getState().hydrate(snapshot.settings);
        // Der Sync-Zustand startet auf `pending` — offene Aenderungen der
        // letzten Sitzung. Auf einer leeren Bibliothek waere das eine
        // Falschaussage: es gibt nichts, was offen sein koennte, und die
        // gelbe Leiste stuende ausgerechnet auf dem Erststart-Screen.
        if (snapshot.documents.length === 0) useSyncStore.getState().setStatus('idle');
        // Der Suchindex laeuft im Hintergrund warm: der erste Screen soll
        // nicht auf Dateien warten, die erst beim Suchen gebraucht werden.
        void warmSearchIndex(snapshot.documents);
      } catch (error: unknown) {
        console.warn('[kompendium] Datenbank liess sich nicht lesen:', error);
        useDocumentStore.getState().hydrate([], []);
        useSyncStore.getState().setStatus('idle');
      }
    })();
  }
  return running;
}
