/**
 * Zustand der Suche (Blaetter `3c`, `3d`, `3e`).
 *
 * Das Handoff-Dokument listet `query`, `recentQueries[]`, `filters` und
 * `state: 'empty' | 'results' | 'none'`. Der Zustand wird hier NICHT
 * gespeichert, sondern aus Eingabe und Trefferzahl abgeleitet — zwei Quellen
 * fuer dieselbe Aussage waeren eine Fehlerquelle.
 *
 * Warum die Suche einen eigenen Speicher hat und nicht im Screen lebt: der
 * Verlauf ("Zuletzt gesucht") muss den Screen ueberdauern, und der Weg
 * Bibliothek → Suche → Viewer → zurueck soll den Begriff und die Filter
 * wiederfinden.
 */
import { create } from 'zustand';

/** Zeitraum-Filter des Dropdown-Chips (Blatt `3d`). */
export type PeriodKey = 'week' | 'month' | 'year';

export const periodLabels: Record<PeriodKey, string> = {
  week: 'Letzte 7 Tage',
  month: 'Letzte 30 Tage',
  year: 'Letztes Jahr',
};

export const periodDays: Record<PeriodKey, number> = {
  week: 7,
  month: 30,
  year: 365,
};

export interface SearchFilters {
  folderName: string | null;
  tagIds: string[];
  period: PeriodKey | null;
}

const noFilters: SearchFilters = { folderName: null, tagIds: [], period: null };

interface SearchState {
  /** Was im Feld steht. */
  query: string;
  /** Was zuletzt abgeschickt wurde — die Ergebnisliste haengt daran. */
  submitted: string;
  recentQueries: string[];
  filters: SearchFilters;

  setQuery: (query: string) => void;
  /** Absenden: Begriff uebernehmen und in den Verlauf legen. */
  submit: (query?: string) => void;
  /** Feld leeren; der Screen faellt auf "Zuletzt gesucht" zurueck. */
  clear: () => void;

  setFolderFilter: (folderName: string | null) => void;
  toggleTagFilter: (tagId: string) => void;
  setPeriod: (period: PeriodKey | null) => void;
  resetFilters: () => void;
}

/** Bis es echte Nutzung gibt, stehen die drei Begriffe aus Blatt `3c` im Verlauf. */
const initialRecent = ['annuität', 'kündigungsfrist', 'cloud'];

/** Mehr als sechs Begriffe braeuchten eine zweite Zeile ohne Nutzen. */
const RECENT_MAX = 6;

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  submitted: '',
  recentQueries: initialRecent,
  filters: noFilters,

  setQuery: (query) => set({ query }),

  submit: (query) =>
    set((state) => {
      const next = (query ?? state.query).trim();
      if (!next) return { query: '', submitted: '' };
      return {
        query: next,
        submitted: next,
        recentQueries: [
          next,
          ...state.recentQueries.filter((entry) => entry.toLowerCase() !== next.toLowerCase()),
        ].slice(0, RECENT_MAX),
      };
    }),

  clear: () => set({ query: '', submitted: '' }),

  setFolderFilter: (folderName) =>
    set((state) => ({ filters: { ...state.filters, folderName } })),

  toggleTagFilter: (tagId) =>
    set((state) => ({
      filters: {
        ...state.filters,
        tagIds: state.filters.tagIds.includes(tagId)
          ? state.filters.tagIds.filter((entry) => entry !== tagId)
          : [...state.filters.tagIds, tagId],
      },
    })),

  setPeriod: (period) => set((state) => ({ filters: { ...state.filters, period } })),

  resetFilters: () => set({ filters: noFilters }),
}));

/** Wie viele Filter gerade greifen — die Leerdarstellung nennt die Zahl. */
export function activeFilterCount(filters: SearchFilters): number {
  return (
    (filters.folderName === null ? 0 : 1) +
    (filters.period === null ? 0 : 1) +
    filters.tagIds.length
  );
}
