/**
 * Womit sich ein Suchergebnis einschraenken laesst — Ordner und Zeitraum
 * (Blatt `3d`).
 *
 * Das steht in `data/` und nicht im Zustand, obwohl der Zustand die gewaehlten
 * Werte haelt: eine Filterdefinition beschreibt, wonach gesucht werden KANN,
 * und das ist eine Eigenschaft des Suchlaufs. Der Zustand merkt sich nur, was
 * der Nutzer davon gerade gewaehlt hat.
 *
 * Vorher stand beides in `state/search.ts`, und `data/search.ts` importierte
 * von dort — die einzige Stelle im Projekt, an der eine Schicht nach oben
 * griff. Die Blickrichtung ist jetzt wieder einheitlich: `state/` kennt
 * `data/`, nie andersherum.
 */

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
  period: PeriodKey | null;
}
