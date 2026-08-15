/**
 * Der Netzzustand — `isOnline`.
 *
 * Handoff-Dokument, State Management: "**Netz:** `isOnline` (NetInfo) — steuert
 * Offline-Streifen und die Viewer-Ansicht ohne Cache."
 *
 * Zwei Screens haengen daran (Blaetter `4c` und `4d`), und beide muessen sich
 * einig sein. Deshalb liegt der Wert in einem Zustand und nicht in je einem
 * Hook pro Screen: ein Hook je Screen hiesse zwei Abonnements, die in
 * verschiedenen Sekunden umschalten.
 *
 * Was hier bewusst NICHT passiert: aus `isOnline` einen Abgleich starten. Der
 * Sync-Zustand (`state/sync.ts`) liest den Netzzustand, wenn er gefragt wird —
 * ein Abgleich, der von allein losrennt, sobald das WLAN wackelt, waere in
 * einer App ohne Serverteil eine Behauptung.
 */
import { useCallback } from 'react';
import { create } from 'zustand';

import { isUnavailable } from '../data/library';
import { watchNetwork } from './networkSource';

interface NetworkState {
  isOnline: boolean;
  setOnline: (value: boolean) => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  /**
   * Bis die erste Meldung kommt, gilt "online". Andersherum blitzte bei jedem
   * Start kurz der Offline-Streifen auf — eine Fehlmeldung in genau dem
   * Moment, in dem der Nutzer sie am wenigsten pruefen kann.
   */
  isOnline: true,
  setOnline: (isOnline) => set({ isOnline }),
}));

/**
 * Abonniert die Netzmeldungen; die Rueckgabe beendet das Abonnement wieder.
 *
 * Woher sie kommen, entscheidet die Plattform (`networkSource`): auf dem
 * Geraet NetInfo, im Web-Export die Ereignisse des Browsers.
 */
export function subscribeNetwork(): () => void {
  return watchNetwork((isOnline) => useNetworkStore.getState().setOnline(isOnline));
}

/**
 * "Ist dieses Dokument gerade nicht zu oeffnen?" — die Frage, die jede Liste
 * und der Viewer stellen. Als Hook, damit der Netzzustand die Screens auch
 * wirklich neu zeichnet, wenn er umschlaegt.
 */
export function useUnavailable(): (document: { cached: boolean }) => boolean {
  const isOnline = useNetworkStore((state) => state.isOnline);
  return useCallback((document) => isUnavailable(document, isOnline), [isOnline]);
}
