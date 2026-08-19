/**
 * Zustand der Synchronisierung.
 *
 * Handoff-Dokument, State Management: "`status: 'idle' | 'syncing' | 'pending'
 * | 'error'`, `lastSyncedAt` — steuert Sync-Indikator und Streifen."
 *
 * Bis hierher fuehrte `sync()` den Zustandsverlauf nur vor, weil es nichts
 * abzugleichen gab. Jetzt ruft es den echten Abruf (`data/remote/pull`) und
 * laedt die Zustaende danach aus der lokalen Datenbank neu — die bleibt die
 * Wahrheitsquelle fuer jeden Screen, auch waehrend abgeglichen wird.
 *
 * Beide Richtungen laufen, und zwar in dieser Reihenfolge: erst hochschicken
 * (`data/remote/push`), dann abrufen (`data/remote/pull`). Andersherum holte
 * man sich den alten Stand zurueck, den man gerade ueberschreiben will.
 *
 * `pending` bedeutet seitdem, was das Wort sagt: die Outbox ist nicht leer.
 * Vorher war es eine Vermutung nach jeder Aenderung am Handy — jetzt ist es
 * eine Auskunft (`countOutbox`).
 */
import { create } from 'zustand';

import { isSupabaseConfigured } from '../data/supabase';
import { pullChanges } from '../data/remote/pull';
import { pushChanges } from '../data/remote/push';
import { countOutbox } from '../data/db/repository';
import type { SyncStatus } from '../ui/SyncIndicator';
import { useNetworkStore } from './network';
import { reloadStores } from './hydrate';

interface SyncState {
  status: SyncStatus;
  lastSyncedAt: number | null;
  /** Was schiefging — die Einstellungen zeigen es unter der Statuszeile. */
  lastError: string | null;
  setStatus: (status: SyncStatus) => void;
  sync: () => Promise<void>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  // Bis `hydrateStores()` die Outbox gezaehlt hat, ist `pending` die
  // vorsichtige Annahme: lieber einmal zu viel "Änderungen offen" zeigen als
  // "Synchron" behaupten, bevor jemand nachgesehen hat.
  status: 'pending',
  lastSyncedAt: null,
  lastError: null,

  setStatus: (status) => set({ status }),

  sync: async () => {
    if (get().status === 'syncing') return;

    // Ohne Zugangsdaten laeuft die App rein lokal. Dann gibt es nichts
    // abzugleichen, und "Sync fehlgeschlagen" waere eine Falschaussage ueber
    // etwas, das gar nicht versucht wurde.
    if (!isSupabaseConfigured) {
      set({ status: 'idle', lastError: null });
      return;
    }

    // Ohne Netz gibt es nichts abzugleichen. Das ist der eine Weg in den
    // Zustand `error`, der keinen Serverfehler braucht (Blatt `4c`).
    if (!useNetworkStore.getState().isOnline) {
      set({ status: 'error', lastError: 'Keine Verbindung.' });
      return;
    }

    set({ status: 'syncing', lastError: null });

    try {
      // Erst die eigene Wahrheit hoch, dann lesen. Der Abruf achtet auf offene
      // Outbox-Eintraege (`applyRemote`), aber eine Zeile, die schon oben
      // steht, kommt sauber zurueck statt geschuetzt zu werden.
      await pushChanges();
      const result = await pullChanges();
      // Nur neu einlesen, wenn sich wirklich etwas geaendert hat: ein Abruf
      // ohne Ergebnis soll keine Liste neu aufbauen, durch die der Nutzer
      // gerade scrollt.
      if (result.changed > 0) await reloadStores();
      // Blieb etwas liegen — ein Ordner, den es oben noch nicht gibt —, ist
      // `pending` die richtige Auskunft und nicht `idle`.
      const open = await countOutbox();
      set({
        status: open === 0 ? 'idle' : 'pending',
        lastSyncedAt: Date.now(),
        lastError: null,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn('[kompendium] Abgleich fehlgeschlagen:', message);
      set({ status: 'error', lastError: message });
    }
  },
}));

/** Die Statuszeile in den Einstellungen — Wort und Zeitpunkt. */
export const syncLabels: Record<SyncStatus, string> = {
  idle: 'Synchron',
  syncing: 'Wird synchronisiert',
  pending: 'Änderungen offen',
  error: 'Sync fehlgeschlagen',
};
