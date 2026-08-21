/**
 * Der Bestand — seit Schritt 7 die Bibliothek selbst, nicht mehr eine
 * Ueberlagerung ueber einem Beispiel-Bestand.
 *
 * Bis Schritt 6 lagen hier sieben Tabellen nebeneinander (`titles`,
 * `folderNames`, `notes` …), weil es keine Datenbank gab, in die eine
 * geaenderte Zeile haette zurueckfliessen koennen. Mit expo-sqlite gibt es sie:
 * `documents` ist die Zeilenmenge aus der Datenbank, und jede Aenderung geht
 * denselben Weg — erst in diesen Zustand, dann ueber das Repository in die
 * Datenbank. Sieben Karten neben einer Tabelle waeren ab jetzt nur noch eine
 * zweite Wahrheit.
 *
 * Auch `favorite` liegt deshalb hier und nicht mehr im Bibliothek-Zustand: es
 * ist eine Spalte der Zeile. Die Regel "ein Schalter, ein Speicherort" gilt
 * weiter — der Speicherort ist jetzt die Zeile.
 */
import { create } from 'zustand';

import { deleteDocument } from '../data/cache';
import { persist } from '../data/db/persist';
import * as repository from '../data/db/repository';
import { forgetDocumentText } from '../data/search';
import type { StoredDocument } from '../data/library';
import { useViewerStore } from './viewer';

interface DocumentState {
  /** Erst nach dem Laden aus der Datenbank darf ein Screen "leer" zeigen. */
  hydrated: boolean;
  documents: StoredDocument[];

  hydrate: (documents: StoredDocument[]) => void;

  setTitle: (documentId: string, title: string) => void;
  setNote: (documentId: string, note: string) => void;
  setKeepOffline: (documentId: string, keep: boolean) => void;
  /** Mehrere auf einmal — "Inhalt offline behalten" eines ganzen Ordners. */
  setDocumentsKeepOffline: (documentIds: string[], keep: boolean) => void;
  /** Beim Oeffnen im Viewer — das Info-Sheet zeigt den Wert als "Geöffnet 12×". */
  countOpen: (documentId: string) => void;

  toggleFavorite: (documentId: string) => void;
  /** Mehrere auf einmal — die Auswahl-Aktionsleiste setzt, sie schaltet nicht um. */
  setFavorite: (documentIds: string[], value: boolean) => void;

  /** Setzen, nicht umschalten — bei gemischter Auswahl waere Umschalten nicht vorhersagbar. */
  setRead: (documentIds: string[], value: boolean) => void;
  setArchived: (documentIds: string[], value: boolean) => void;
  /** Die Wischgeste trifft genau eine Zeile und kennt deren Zustand. */
  toggleRead: (documentId: string) => void;
  toggleArchived: (documentId: string) => void;

  /** Einzeln oder als Mehrfachauswahl: Dokumente in einen Ordner legen. */
  setFolder: (documentIds: string[], folderName: string | null) => void;
  /** Zweite Haelfte des Ordner-Umbenennens (siehe `state/folders.ts`). */
  renameFolderEverywhere: (from: string, to: string) => void;
  /** Zweite Haelfte des Ordner-Loeschens: die Dokumente bleiben, der Ordner nicht. */
  clearFolderEverywhere: (name: string) => void;

  /** In den Papierkorb legen; `at` als Parameter, damit das Ergebnis pruefbar bleibt. */
  trash: (documentIds: string[], at?: number) => void;
  restoreFromTrash: (documentIds: string[]) => void;
  /** Endgueltig — nur aus dem Papierkorb heraus (Blatt `6a`). */
  deleteForever: (documentIds: string[]) => void;

  /** Nach "Cache leeren": die Zeilen bleiben, ihr Inhalt ist weg. */
  markUncached: (documentIds: string[]) => void;
  /**
   * Gegenstueck zu `markUncached`: die Datei liegt jetzt auf dem Geraet.
   * Gerufen, nachdem der Viewer sie aus Supabase Storage geholt hat.
   */
  markCached: (documentId: string, cacheKey: string, sizeBytes: number) => void;

  /** Ein importiertes Dokument aufnehmen (Blatt `3g`). */
  addDocument: (document: StoredDocument) => void;
}

/**
 * Endgueltiges Loeschen an EINER Stelle: Datenbankzeile und Datei im Cache.
 *
 * Beide Wege gehoeren zusammen — eine geloeschte Zeile ohne ihre Datei laesst
 * das HTML fuer immer im Dokumentverzeichnis liegen, und der Speicherbalken in
 * den Einstellungen zeigt dann weniger an, als belegt ist. Neben
 * `deleteForever` benutzt auch der Papierkorb-Aufraeumlauf beim Start
 * (`state/hydrate.ts`) genau diese Funktion.
 *
 * Die gemerkte Leseposition faellt hier mit weg: sie ueberdauert seit Paket B
 * den Neustart, und ein Eintrag zu einem Dokument, das es nicht mehr gibt,
 * wuerde sonst fuer immer mitgeschleppt. Dasselbe gilt fuer den Text im
 * Suchpuffer — er haelt den ganzen Inhalt im Arbeitsspeicher.
 */
export async function purgeDocuments(
  entries: { id: string; cacheKey: string | null }[]
): Promise<void> {
  if (entries.length === 0) return;
  await repository.deleteDocuments(entries.map((entry) => entry.id));
  useViewerStore.getState().forgetScroll(entries.map((entry) => entry.id));
  for (const entry of entries) {
    // Der Text im Suchpuffer gehoert dazu: er haelt den ganzen Inhalt im
    // Arbeitsspeicher und ueberlebte sonst als Karteileiche bis zum naechsten
    // Start — bei einem geleerten Papierkorb gleich in Dutzenden.
    forgetDocumentText(entry.id);
    if (entry.cacheKey !== null) await deleteDocument(entry.cacheKey);
  }
}

/**
 * Aendert die genannten Zeilen im Zustand und schreibt dieselbe Aenderung in
 * die Datenbank. Beide Wege stehen hier zusammen, damit keiner vergessen wird.
 */
function patch(
  documents: StoredDocument[],
  ids: string[],
  change: repository.DocumentPatch
): StoredDocument[] {
  const wanted = new Set(ids);
  persist(() => repository.updateDocuments(ids, change));
  return documents.map((document) =>
    wanted.has(document.id) ? { ...document, ...change } : document
  );
}

export const useDocumentStore = create<DocumentState>((set) => ({
  hydrated: false,
  documents: [],

  hydrate: (documents) => set({ documents, hydrated: true }),

  /**
   * Titel und Notiz sind Aenderungen AM Dokument und ruecken es damit in
   * "Zuletzt geaendert" nach vorn. Ordner und Favorit dagegen sagen
   * etwas ueber die Ablage, nicht ueber den Inhalt — sie lassen `updatedAt`
   * in Ruhe, sonst waere die Liste nach jedem Einsortieren neu gemischt.
   */
  setTitle: (documentId, title) =>
    set((state) => {
      const current = state.documents.find((document) => document.id === documentId);
      // Gleicher Wert, kein Schreibvorgang: das Info-Sheet meldet gedrosselt
      // UND beim Verlassen des Feldes, der letzte Ruf traegt deshalb oft nichts
      // Neues. Wuerde er trotzdem `updatedAt` setzen, rutschte das Dokument in
      // "Zuletzt geaendert" nach oben, ohne dass jemand etwas geaendert hat.
      if (current === undefined || current.title === title) return state;
      return {
        documents: patch(state.documents, [documentId], { title, updatedAt: Date.now() }),
      };
    }),

  setNote: (documentId, note) =>
    set((state) => {
      const current = state.documents.find((document) => document.id === documentId);
      if (current === undefined || current.note === note) return state;
      return {
        documents: patch(state.documents, [documentId], { note, updatedAt: Date.now() }),
      };
    }),

  setKeepOffline: (documentId, keepOffline) =>
    set((state) => ({ documents: patch(state.documents, [documentId], { keepOffline }) })),

  setDocumentsKeepOffline: (documentIds, keepOffline) =>
    set((state) => ({ documents: patch(state.documents, documentIds, { keepOffline }) })),

  countOpen: (documentId) =>
    set((state) => {
      const current = state.documents.find((document) => document.id === documentId);
      if (current === undefined) return state;
      return {
        documents: patch(state.documents, [documentId], {
          openCount: current.openCount + 1,
          // Zaehler und Zeitpunkt beschreiben dasselbe Ereignis und werden
          // deshalb zusammen gesetzt — getrennt liefe einer von beiden nach.
          lastOpenedAt: Date.now(),
        }),
      };
    }),

  toggleFavorite: (documentId) =>
    set((state) => {
      const current = state.documents.find((document) => document.id === documentId);
      if (current === undefined) return state;
      return { documents: patch(state.documents, [documentId], { favorite: !current.favorite }) };
    }),

  setFavorite: (documentIds, favorite) =>
    set((state) => ({ documents: patch(state.documents, documentIds, { favorite }) })),

  /**
   * `readAt` und `archivedAt` lassen `updatedAt` in Ruhe — wie Ordner und
   * Favorit sagen sie etwas ueber die Ablage, nicht ueber den Inhalt. Sonst
   * waere "Zuletzt geaendert" nach jedem Wischen neu gemischt, und die Zeile
   * spraenge unter dem Finger weg.
   */
  setRead: (documentIds, value) =>
    set((state) => ({
      documents: patch(state.documents, documentIds, { readAt: value ? Date.now() : null }),
    })),

  setArchived: (documentIds, value) =>
    set((state) => ({
      documents: patch(state.documents, documentIds, { archivedAt: value ? Date.now() : null }),
    })),

  toggleRead: (documentId) =>
    set((state) => {
      const current = state.documents.find((document) => document.id === documentId);
      if (current === undefined) return state;
      return {
        documents: patch(state.documents, [documentId], {
          readAt: current.readAt === null ? Date.now() : null,
        }),
      };
    }),

  toggleArchived: (documentId) =>
    set((state) => {
      const current = state.documents.find((document) => document.id === documentId);
      if (current === undefined) return state;
      return {
        documents: patch(state.documents, [documentId], {
          archivedAt: current.archivedAt === null ? Date.now() : null,
        }),
      };
    }),

  setFolder: (documentIds, folderName) =>
    set((state) => ({ documents: patch(state.documents, documentIds, { folderName }) })),

  /**
   * Nur der Zustand: die Datenbank erledigt beide Tabellen in einer
   * Transaktion (`repository.renameFolder`), angestossen vom Ordner-Zustand.
   */
  renameFolderEverywhere: (from, to) =>
    set((state) => ({
      documents: state.documents.map((document) =>
        document.folderName === from ? { ...document, folderName: to } : document
      ),
    })),

  /**
   * Gegenstueck zu `renameFolderEverywhere`: die Datenbank hat die Transaktion
   * (`repository.deleteFolder`) schon erledigt, hier bleibt nur der Zustand.
   * Die Dokumente selbst bleiben — sie landen in "Nicht einsortiert".
   */
  clearFolderEverywhere: (name) =>
    set((state) => ({
      documents: state.documents.map((document) =>
        document.folderName === name ? { ...document, folderName: null } : document
      ),
    })),

  trash: (documentIds, at) =>
    set((state) => ({
      documents: patch(state.documents, documentIds, { trashedAt: at ?? Date.now() }),
    })),

  restoreFromTrash: (documentIds) =>
    set((state) => ({ documents: patch(state.documents, documentIds, { trashedAt: null }) })),

  deleteForever: (documentIds) =>
    set((state) => {
      const gone = new Set(documentIds);
      // Der Schluessel muss VOR dem Entfernen aus dem Zustand feststehen —
      // danach ist nicht mehr zu ermitteln, welche Datei dazugehoerte.
      const entries = documentIds.map((id) => ({
        id,
        cacheKey: state.documents.find((document) => document.id === id)?.cacheKey ?? null,
      }));
      persist(() => purgeDocuments(entries));
      return { documents: state.documents.filter((document) => !gone.has(document.id)) };
    }),

  markUncached: (documentIds) =>
    set((state) => ({
      documents: patch(state.documents, documentIds, { cached: false, cacheKey: null }),
    })),

  markCached: (documentId, cacheKey, sizeBytes) =>
    set((state) => ({
      documents: patch(state.documents, [documentId], { cached: true, cacheKey, sizeBytes }),
    })),

  addDocument: (document) =>
    set((state) => {
      persist(() => repository.insertDocument(document));
      return { documents: [document, ...state.documents] };
    }),
}));

/** Ein Dokument aus dem Bestand holen — der Viewer bekommt nur den Ausweis. */
export function documentById(
  documents: StoredDocument[],
  id: string
): StoredDocument | undefined {
  return documents.find((document) => document.id === id);
}

export { isArchived, isTrashed, isUnread, isVisible } from '../data/library';
