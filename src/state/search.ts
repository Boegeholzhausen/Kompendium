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
 *
 * Der Verlauf ueberdauert seit Paket B auch den Neustart: er liegt als
 * JSON-Array in der vorhandenen `settings`-Tabelle. Er startet dabei LEER —
 * die drei Begriffe aus Blatt `3c` waren eine Beschriftung des Entwurfs, keine
 * Nutzung. Eine App, die beim ersten Start behauptet, man habe schon nach
 * "annuität" gesucht, erzaehlt eine Vergangenheit, die es nicht gibt.
 */
import { create } from 'zustand';

import { persist } from '../data/db/persist';
import { setSetting } from '../data/db/repository';
// Die Filterdefinition selbst liegt in `data/` — hier stehen nur die gerade
// gewaehlten Werte. Weitergereicht, damit die Screens sie wie bisher aus
// diesem Modul beziehen koennen.
import {
  periodDays,
  periodLabels,
  type PeriodKey,
  type SearchFilters,
} from '../data/searchFilters';

export { periodDays, periodLabels };
export type { PeriodKey, SearchFilters };

const noFilters: SearchFilters = { folderName: null, period: null };

interface SearchState {
  /** Was im Feld steht. */
  query: string;
  /** Was zuletzt abgeschickt wurde — die Ergebnisliste haengt daran. */
  submitted: string;
  recentQueries: string[];
  filters: SearchFilters;

  /** Gespeicherten Verlauf uebernehmen; kaputtes JSON → leerer Verlauf. */
  hydrate: (settings: Record<string, string>) => void;

  setQuery: (query: string) => void;
  /** Absenden: Begriff uebernehmen und in den Verlauf legen. */
  submit: (query?: string) => void;
  /** Feld leeren; der Screen faellt auf "Zuletzt gesucht" zurueck. */
  clear: () => void;
  /** "Verlauf leeren" unter der Chip-Reihe. */
  clearRecent: () => void;

  setFolderFilter: (folderName: string | null) => void;
  setPeriod: (period: PeriodKey | null) => void;
  resetFilters: () => void;
}

/** Mehr als sechs Begriffe braeuchten eine zweite Zeile ohne Nutzen. */
const RECENT_MAX = 6;

export const SETTING_RECENT_QUERIES = 'search.recentQueries';

function storeRecent(recentQueries: string[]): void {
  persist(() => setSetting(SETTING_RECENT_QUERIES, JSON.stringify(recentQueries)));
}

export const useSearchStore = create<SearchState>((set) => ({
  query: '',
  submitted: '',
  recentQueries: [],
  filters: noFilters,

  hydrate: (settings) => {
    const raw = settings[SETTING_RECENT_QUERIES];
    if (raw === undefined) return;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      set({
        recentQueries: parsed
          .filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '')
          .slice(0, RECENT_MAX),
      });
    } catch {
      // Kaputtes JSON ist kein Grund, den Start abzubrechen — dann steht der
      // Verlauf eben leer da, genau wie beim ersten Start.
    }
  },

  setQuery: (query) => set({ query }),

  submit: (query) =>
    set((state) => {
      const next = (query ?? state.query).trim();
      if (!next) return { query: '', submitted: '' };
      const recentQueries = [
        next,
        ...state.recentQueries.filter((entry) => entry.toLowerCase() !== next.toLowerCase()),
      ].slice(0, RECENT_MAX);
      storeRecent(recentQueries);
      return { query: next, submitted: next, recentQueries };
    }),

  clear: () => set({ query: '', submitted: '' }),

  clearRecent: () => {
    storeRecent([]);
    set({ recentQueries: [] });
  },

  setFolderFilter: (folderName) =>
    set((state) => ({ filters: { ...state.filters, folderName } })),

  setPeriod: (period) => set((state) => ({ filters: { ...state.filters, period } })),

  resetFilters: () => set({ filters: noFilters }),
}));

/** Wie viele Filter gerade greifen — die Leerdarstellung nennt die Zahl. */
export function activeFilterCount(filters: SearchFilters): number {
  return (
    (filters.folderName === null ? 0 : 1) + (filters.period === null ? 0 : 1)
  );
}
