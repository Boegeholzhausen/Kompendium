/**
 * Zustand der Bibliothek.
 *
 * Das Handoff-Dokument listet unter "State Management" fuer die Bibliothek
 * `viewMode`, `sort`, `activeFilter`, `headerCollapsed`, `selectionMode` und
 * `selectedIds`. Hier liegt, was ueber Screens hinweg gilt:
 *
 *   viewMode      Liste oder Kacheln — gilt auch im Ordner-Detail (Blatt 3b)
 *   sort          zuletzt geaendert / Titel / Groesse
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

export type ViewMode = 'list' | 'grid';
export type SortKey = 'recent' | 'title' | 'size';
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
};

/** Kurzformen fuer das Dreier-Segment in "Darstellung" (Blatt `6b`). */
export const sortShortLabels: Record<SortKey, string> = {
  recent: 'Zuletzt',
  title: 'Titel',
  size: 'Größe',
};

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
      sort: (['recent', 'title', 'size'] as SortKey[]).includes(settings[SETTING_SORT] as SortKey)
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
