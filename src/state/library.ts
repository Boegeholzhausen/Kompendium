/**
 * Zustand der Bibliothek.
 *
 * Das Handoff-Dokument listet unter "State Management" fuer die Bibliothek
 * `viewMode`, `sort`, `activeFilter`, `headerCollapsed`, `selectionMode` und
 * `selectedIds`. Hier liegt, was ueber Screens hinweg gilt:
 *
 *   viewMode      Liste oder Kacheln — gilt auch im Ordner-Detail (Blatt 3b)
 *   sort          zuletzt geaendert / Titel / Groesse / zuletzt geoeffnet
 *   activeFilter  "Alle", "Favoriten" oder ein Tag
 *
 *   selectionMode Mehrfachauswahl aktiv (Blatt `3h`)
 *   selectedIds   die gewaehlten Dokumente
 *
 * `headerCollapsed` gehoert NICHT hierher: der Wert kommt aus dem Scrolloffset
 * und lebt nur, solange der Screen sichtbar ist. `favorites` ebenfalls nicht
 * mehr — seit Schritt 7 ist der Favorit eine Spalte der Dokumentzeile
 * (`state/documents.ts`).
 *
 * `viewMode` und `sort` sind zugleich die beiden Werte, die "Darstellung >
 * Bibliothek" (Blatt `6b`) einstellt. Sie stehen deshalb nur hier und nicht
 * ein zweites Mal in einem Einstellungs-Zustand: eine Voreinstellung, die vom
 * gerade sichtbaren Zustand abweicht, waere fuer niemanden nachvollziehbar.
 * Beide ueberdauern den Neustart, weil sie in `settings` liegen.
 *
 * `selectedIds` ist eine Liste, kein Set: der Zustand wird bei jeder Aenderung
 * ersetzt, und eine Liste laesst sich unveraendert kopieren, ohne dass ein
 * Vergleich in zustand danebengreift.
 */
import { create } from 'zustand';

import { persist } from '../data/db/persist';
import { setSetting } from '../data/db/repository';
import type { StoredDocument } from '../data/library';

export type ViewMode = 'list' | 'grid';
export type SortKey = 'recent' | 'title' | 'size' | 'opened';
/** 'all' | 'favorites' | Tag-Ausweis */
export type LibraryFilter = string;

/**
 * Was die Auswahl-Aktionsleiste anfordert.
 *
 * Die Leiste ersetzt die Tab-Bar und lebt deshalb im Tab-Rahmen, die Sheets
 * und der Toast aber in der Bibliothek. Statt Rueckrufe durch den Navigator zu
 * faedeln, legt die Leiste hier einen Wunsch ab; die Bibliothek nimmt ihn auf
 * und raeumt ihn wieder weg. Eine Stelle, ein Weg.
 */
export type SelectionRequest = 'move' | 'tag' | 'favorite' | 'trash';

export const sortLabels: Record<SortKey, string> = {
  recent: 'Zuletzt geändert',
  title: 'Titel',
  size: 'Größe',
  opened: 'Zuletzt geöffnet',
};

/**
 * Kurzformen fuer das Segment in "Darstellung" (Blatt `6b`). Seit "Zuletzt
 * geoeffnet" dazugekommen ist, sind es vier — deshalb die kurzen Woerter.
 */
export const sortShortLabels: Record<SortKey, string> = {
  recent: 'Zuletzt',
  title: 'Titel',
  size: 'Größe',
  opened: 'Geöffnet',
};

/**
 * Reihenfolge einer Dokumentliste. Bibliothek (Screen 1) und Ordner-Detail
 * (Screen 4) benutzen dieselbe Regel — zwei Listen, die dieselbe Einstellung
 * anzeigen, duerfen nicht unterschiedlich sortieren.
 *
 * "Zuletzt geoeffnet" faellt fuer nie geoeffnete Dokumente auf 0 zurueck; sie
 * stehen damit hinten. Bei Gleichstand entscheidet `updatedAt` absteigend,
 * sonst waere die Reihenfolge unter allen ungelesenen zufaellig.
 */
export function sortDocuments(documents: StoredDocument[], sort: SortKey): StoredDocument[] {
  const sorted = [...documents];
  if (sort === 'title') {
    sorted.sort((a, b) => a.title.localeCompare(b.title, 'de'));
  } else if (sort === 'size') {
    sorted.sort((a, b) => b.sizeBytes - a.sizeBytes);
  } else if (sort === 'opened') {
    sorted.sort((a, b) => {
      const diff = (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0);
      return diff !== 0 ? diff : b.updatedAt - a.updatedAt;
    });
  } else {
    sorted.sort((a, b) => b.updatedAt - a.updatedAt);
  }
  return sorted;
}

/**
 * Ist die sichtbare Liste vollstaendig gewaehlt? Die Auswahl-Kopfzeile
 * entscheidet daran zwischen "Alle auswaehlen" und "Auswahl aufheben".
 * Gefragt wird nur nach den uebergebenen Ausweisen: die Auswahl kann
 * Dokumente enthalten, die der aktive Filter gerade nicht zeigt.
 */
export function isAllSelected(ids: string[], selectedIds: string[]): boolean {
  return ids.length > 0 && ids.every((id) => selectedIds.includes(id));
}

export const SETTING_VIEW_MODE = 'library.viewMode';
export const SETTING_SORT = 'library.sort';

interface LibraryState {
  viewMode: ViewMode;
  sort: SortKey;
  activeFilter: LibraryFilter;
  selectionMode: boolean;
  selectedIds: string[];
  /** Wunsch der Auswahl-Aktionsleiste, den die Bibliothek ausfuehrt. */
  request: SelectionRequest | null;

  hydrate: (settings: Record<string, string>) => void;

  toggleViewMode: () => void;
  setViewMode: (viewMode: ViewMode) => void;
  setSort: (sort: SortKey) => void;
  setFilter: (filter: LibraryFilter) => void;
  /** Langer Druck auf eine Zeile: Modus an, diese Zeile gewaehlt. */
  startSelection: (id: string) => void;
  /** "Einsortieren" in der Sektion "Neu": Modus an, alle Neuen gewaehlt. */
  startSelectionWith: (ids: string[]) => void;
  /** "Alle auswaehlen" / "Auswahl aufheben" — die Liste ersetzt die Auswahl. */
  selectAll: (ids: string[]) => void;
  setRequest: (request: SelectionRequest | null) => void;
  toggleSelected: (id: string) => void;
  endSelection: () => void;
}

export const useLibraryStore = create<LibraryState>((set) => ({
  viewMode: 'list',
  sort: 'recent',
  activeFilter: 'all',
  selectionMode: false,
  selectedIds: [],
  request: null,

  hydrate: (settings) =>
    set({
      viewMode: settings[SETTING_VIEW_MODE] === 'grid' ? 'grid' : 'list',
      sort: (['recent', 'title', 'size', 'opened'] as SortKey[]).includes(
        settings[SETTING_SORT] as SortKey
      )
        ? (settings[SETTING_SORT] as SortKey)
        : 'recent',
    }),

  toggleViewMode: () =>
    set((state) => {
      const viewMode: ViewMode = state.viewMode === 'list' ? 'grid' : 'list';
      persist(() => setSetting(SETTING_VIEW_MODE, viewMode));
      return { viewMode };
    }),

  setViewMode: (viewMode) => {
    persist(() => setSetting(SETTING_VIEW_MODE, viewMode));
    set({ viewMode });
  },

  setSort: (sort) => {
    persist(() => setSetting(SETTING_SORT, sort));
    set({ sort });
  },

  setFilter: (activeFilter) => set({ activeFilter }),

  startSelection: (id) => set({ selectionMode: true, selectedIds: [id] }),

  startSelectionWith: (ids) => set({ selectionMode: true, selectedIds: ids }),

  /**
   * Ersetzen, nicht ergaenzen: der Griff bekommt die gerade sichtbare,
   * gefilterte Liste herein, und "Auswahl aufheben" ist derselbe Ruf mit einer
   * leeren Liste. Der Auswahlmodus bleibt dabei an — "0 ausgewählt" ist ein
   * gueltiger Zustand (siehe `toggleSelected`).
   */
  selectAll: (ids) => set({ selectedIds: ids }),

  setRequest: (request) => set({ request }),

  /**
   * Die letzte Abwahl beendet den Modus nicht: "0 ausgewählt" ist ein
   * gueltiger Zustand, und ein Screen, der beim vorletzten Tipp umspringt,
   * ueberrascht mehr als er hilft. Beendet wird ueber "Abbrechen".
   */
  toggleSelected: (id) =>
    set((state) => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds.filter((entry) => entry !== id)
        : [...state.selectedIds, id],
    })),

  endSelection: () => set({ selectionMode: false, selectedIds: [], request: null }),
}));
