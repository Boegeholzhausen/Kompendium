/**
 * Zustand der Synchronisierung.
 *
 * Handoff-Dokument, State Management: "`status: 'idle' | 'syncing' | 'pending'
 * | 'error'`, `lastSyncedAt` — steuert Sync-Indikator und Streifen."
 *
 * Bis Schritt 6 stand der Zustand als Konstante im Beispiel-Bestand; die
 * Einstellungen (Blatt `3i`) brauchen ihn jetzt als Zustand: die Statuszeile
 * nennt ihn in Worten, und "Jetzt synchronisieren" muss ihn aendern koennen.
 *
 * Was hier NICHT passiert: mit Supabase reden. Der Client steht
 * (`data/supabase.ts`), das Schema liegt in `supabase/schema.sql` — der
 * Abgleich selbst ist eine eigene Aufgabe und gehoert nicht in Schritt 7.
 * `sync()` fuehrt deshalb den Zustandsverlauf vor, den der echte Abgleich
 * spaeter erzeugt, und sagt das an dieser Stelle deutlich, statt ihn
 * vorzutaeuschen.
 */
import { create } from 'zustand';

import type { SyncStatus } from '../ui/SyncIndicator';

/** Wie lange der vorgefuehrte Abgleich dauert. */
const DEMO_DURATION = 1400;

interface SyncState {
  status: SyncStatus;
  lastSyncedAt: number | null;
  setStatus: (status: SyncStatus) => void;
  sync: () => void;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  // Beim Start liegen die Aenderungen der letzten Sitzung noch lokal: `pending`
  // ist der ehrliche Ausgangszustand, solange es keinen Abgleich gibt.
  status: 'pending',
  lastSyncedAt: null,

  setStatus: (status) => set({ status }),

  sync: () => {
    if (get().status === 'syncing') return;
    set({ status: 'syncing' });
    setTimeout(() => {
      set({ status: 'idle', lastSyncedAt: Date.now() });
    }, DEMO_DURATION);
  },
}));

/** Die Statuszeile in den Einstellungen — Wort und Zeitpunkt. */
export const syncLabels: Record<SyncStatus, string> = {
  idle: 'Synchron',
  syncing: 'Wird synchronisiert',
  pending: 'Änderungen offen',
  error: 'Sync fehlgeschlagen',
};
